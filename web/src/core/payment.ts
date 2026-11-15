import type { Payment, PaymentKind } from './types';

/**
 * The only payments the haunted checkout accepts (Requirement 22.2–22.3).
 * Preset options only: the Shop never takes free text or personal data.
 */
export const PAYMENT_OPTIONS: Readonly<Record<PaymentKind, readonly string[]>> = {
  time: ['one-hour-every-night', 'every-christmas-morning', 'the-last-minute-of-each-year'],
  age: ['one-year', 'seven-years', 'the-age-you-were-happiest'],
  memory: ['your-first-snow', 'a-voice-you-no-longer-hear', 'the-way-home'],
};

export function isValidPayment(payment: Payment | null): payment is Payment {
  if (!payment) return false;
  const options = PAYMENT_OPTIONS[payment.kind];
  return Array.isArray(options) && options.includes(payment.option);
}
