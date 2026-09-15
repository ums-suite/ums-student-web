import {
  generateIdempotencyKey,
  isConfirmedPaymentStatus,
  isTerminalPaymentStatus,
} from './payment-idempotency';
import type { PaymentStatus } from '../../core/api/finance.types';

describe('payment-idempotency', () => {
  describe('isTerminalPaymentStatus', () => {
    it('is true for Successful, Failed, Reconciled', () => {
      (['Successful', 'Failed', 'Reconciled'] as PaymentStatus[]).forEach((status) =>
        expect(isTerminalPaymentStatus(status)).toBeTrue(),
      );
    });

    it('is false for Initiated and Pending', () => {
      (['Initiated', 'Pending'] as PaymentStatus[]).forEach((status) =>
        expect(isTerminalPaymentStatus(status)).toBeFalse(),
      );
    });
  });

  describe('isConfirmedPaymentStatus', () => {
    it('is true only for Successful and Reconciled', () => {
      expect(isConfirmedPaymentStatus('Successful')).toBeTrue();
      expect(isConfirmedPaymentStatus('Reconciled')).toBeTrue();
    });

    it('is false for Failed -- a completed failure is never a confirmed success', () => {
      expect(isConfirmedPaymentStatus('Failed')).toBeFalse();
    });

    it('is false for Initiated and Pending', () => {
      expect(isConfirmedPaymentStatus('Initiated')).toBeFalse();
      expect(isConfirmedPaymentStatus('Pending')).toBeFalse();
    });
  });

  describe('generateIdempotencyKey', () => {
    it('generates a non-empty string', () => {
      expect(generateIdempotencyKey().length).toBeGreaterThan(0);
    });

    it('generates a different key on each call', () => {
      const a = generateIdempotencyKey();
      const b = generateIdempotencyKey();
      expect(a).not.toBe(b);
    });

    it('falls back to a timestamp+random string when crypto.randomUUID is unavailable', () => {
      const original = crypto.randomUUID;
      // @ts-expect-error -- deliberately simulating an older runtime without randomUUID
      crypto.randomUUID = undefined;
      try {
        const key = generateIdempotencyKey();
        expect(key.startsWith('idempotency-')).toBeTrue();
      } finally {
        crypto.randomUUID = original;
      }
    });
  });
});
