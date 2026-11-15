import fc from 'fast-check';
import { PAYMENT_OPTIONS, PRODUCT_IDS, type Payment, type ProductId, type StoryEvent } from '../../src/core';

export const productId: fc.Arbitrary<ProductId> = fc.constantFrom(...PRODUCT_IDS);

export const payment: fc.Arbitrary<Payment> = fc.oneof(
  fc.constantFrom(...PAYMENT_OPTIONS.time).map((option) => ({ kind: 'time' as const, option })),
  fc.constantFrom(...PAYMENT_OPTIONS.age).map((option) => ({ kind: 'age' as const, option })),
  fc.constantFrom(...PAYMENT_OPTIONS.memory).map((option) => ({ kind: 'memory' as const, option })),
);

const invalidPayment: fc.Arbitrary<Payment> = fc.record({
  kind: fc.constantFrom('time' as const, 'age' as const, 'memory' as const),
  option: fc.string({ maxLength: 12 }),
});

/** Story events weighted so that runs often reach the Haunted state, checkout and the ending. */
export const event: fc.Arbitrary<StoryEvent> = fc.oneof(
  { weight: 3, arbitrary: fc.constant({ type: 'BAT_CAUGHT' as const }) },
  { weight: 3, arbitrary: fc.constant({ type: 'REVEAL_DONE' as const }) },
  {
    weight: 8,
    arbitrary: fc.record({
      type: fc.constant('ADD_TO_CART' as const),
      id: productId,
      qty: fc.option(fc.integer({ min: -2, max: 12 }), { nil: undefined }),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      type: fc.constant('SET_QTY' as const),
      id: productId,
      qty: fc.integer({ min: -1, max: 12 }),
    }),
  },
  { weight: 2, arbitrary: fc.record({ type: fc.constant('REMOVE' as const), id: productId }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('SNEAK_INTO_CART' as const), id: productId }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('CATALOG_EXTRA' as const), id: productId }) },
  { weight: 3, arbitrary: fc.constant({ type: 'OPEN_CHECKOUT' as const }) },
  { weight: 3, arbitrary: fc.constant({ type: 'CLOSING_DONE' as const }) },
  {
    weight: 3,
    arbitrary: fc.record({
      type: fc.constant('SET_PAYMENT' as const),
      payment: fc.oneof(payment, invalidPayment, fc.constant(null)),
    }),
  },
  { weight: 3, arbitrary: fc.record({ type: fc.constant('SET_AGREEMENT' as const), agreed: fc.boolean() }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('SET_GIFT_WRAP' as const), on: fc.boolean() }) },
  { weight: 1, arbitrary: fc.constant({ type: 'DECLINE' as const }) },
  { weight: 3, arbitrary: fc.constant({ type: 'ACCEPT' as const }) },
  { weight: 2, arbitrary: fc.constant({ type: 'RETURN_DONE' as const }) },
  {
    weight: 2,
    arbitrary: fc.record({
      type: fc.constant('MARK_ADDED' as const),
      mark: fc.record({
        id: fc.string({ minLength: 1, maxLength: 6 }),
        kind: fc.constantFrom('footprint', 'blood-print', 'ash', 'wax'),
        x: fc.double({ min: 0, max: 4000, noNaN: true }),
        y: fc.double({ min: 0, max: 12000, noNaN: true }),
        rotation: fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }),
        scale: fc.double({ min: 0.2, max: 3, noNaN: true }),
        product: fc.option(productId, { nil: null }),
      }),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant('ECHO_LOADED' as const),
      echo: fc.option(
        fc.record({ product: productId, condition: fc.constantFrom('haunted' as const, 'taken' as const) }),
        { nil: null },
      ),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant('SETTINGS' as const),
      settings: fc.record(
        { motion: fc.constantFrom('system' as const, 'reduced' as const, 'full' as const), sound: fc.boolean() },
        { requiredKeys: [] },
      ),
    }),
  },
);

/**
 * Purely random events rarely get past the Day state (measured: about 5% of runs reached
 * the Haunted state). So sequences mix random events with scripted story chunks that a
 * real visitor would perform, which keeps the properties from passing vacuously.
 */
const revealChunk: fc.Arbitrary<StoryEvent[]> = fc.constant([
  { type: 'BAT_CAUGHT' as const },
  { type: 'REVEAL_DONE' as const },
]);

const buyChunk: fc.Arbitrary<StoryEvent[]> = fc.array(
  productId.map((id): StoryEvent => ({ type: 'ADD_TO_CART', id })),
  { minLength: 1, maxLength: 4 },
);

const checkoutChunk: fc.Arbitrary<StoryEvent[]> = fc
  .tuple(payment, fc.boolean(), fc.boolean())
  .map(([p, agree, finish]): StoryEvent[] => [
    { type: 'OPEN_CHECKOUT' },
    { type: 'CLOSING_DONE' },
    { type: 'SET_PAYMENT', payment: p },
    { type: 'SET_AGREEMENT', agreed: agree },
    { type: 'ACCEPT' },
    ...(finish ? [{ type: 'RETURN_DONE' as const }] : []),
  ]);

export const events: fc.Arbitrary<StoryEvent[]> = fc
  .array(
    fc.oneof(
      { weight: 6, arbitrary: event.map((e) => [e]) },
      { weight: 2, arbitrary: revealChunk },
      { weight: 3, arbitrary: buyChunk },
      { weight: 2, arbitrary: checkoutChunk },
    ),
    { minLength: 3, maxLength: 30 },
  )
  .map((chunks) => chunks.flat());
