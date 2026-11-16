import { createHash, randomBytes } from 'node:crypto';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { CONDITIONS, PRODUCTS } from './allowlist.js';
import { EchoStore } from './store.js';

export interface AppOptions {
  dbPath: string;
  /** Writes allowed per client per minute (Requirement 24.5). */
  writesPerMinute?: number;
  /** Origin allowed to call the API from a browser on another host. */
  allowOrigin?: string;
}

/**
 * The Echo service (Requirement 24, design: Echo service).
 * GET  /api/echo  → newest echoes, ids and product/condition only
 * POST /api/echo  → { product, condition } from fixed allowlists, returns { id }
 */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    // Requirement 24.4: never log IP addresses or user agents. Fastify's default
    // per-request logs include remoteAddress, so they are turned off.
    disableRequestLogging: true,
    bodyLimit: 1024,
    // Fastify's default strips unknown fields and accepts the request. Reject them instead
    // (found by the allowlist property test).
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });
  const store = new EchoStore(options.dbPath);
  app.addHook('onClose', async () => store.close());

  // Rate limiting keeps a short-lived, in-memory counter keyed by a salted hash of the
  // client address. The salt changes on every start; nothing is written to disk or logs.
  const salt = randomBytes(16);
  await app.register(rateLimit, {
    global: false,
    keyGenerator: (req) => createHash('sha256').update(salt).update(req.ip).digest('base64url'),
  });

  if (options.allowOrigin) {
    app.addHook('onSend', async (_req, reply) => {
      reply.header('access-control-allow-origin', options.allowOrigin);
      reply.header('vary', 'origin');
    });
  }

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/echo', async (_req, reply) => {
    reply.header('cache-control', 'no-store');
    return store.latest(5);
  });

  app.post(
    '/api/echo',
    {
      config: { rateLimit: { max: options.writesPerMinute ?? 5, timeWindow: '1 minute' } },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['product', 'condition'],
          properties: {
            product: { type: 'string', enum: [...PRODUCTS] },
            condition: { type: 'string', enum: [...CONDITIONS] },
          },
        },
      },
    },
    async (req, reply) => {
      const { product, condition } = req.body as { product: string; condition: string };
      const id = store.add(product, condition);
      reply.code(201);
      return { id };
    },
  );

  return app;
}
