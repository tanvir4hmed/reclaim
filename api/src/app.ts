import Fastify, { type FastifyInstance } from 'fastify';

export interface AppOptions {
  dbPath: string;
}

/**
 * Builds the Echo service. Endpoints are added in task 10.4; for now it only
 * exposes a health check so Docker and the dev proxy can be verified.
 */
export async function buildApp(_options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    // Requirement 24.4: never log IP addresses or user agents. Fastify's default
    // per-request logs include remoteAddress, so they are turned off.
    disableRequestLogging: true,
    bodyLimit: 1024,
  });

  app.get('/api/health', async () => ({ ok: true }));

  return app;
}
