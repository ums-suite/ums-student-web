import {
  clearPendingPaymentAttempt,
  readPendingPaymentAttempt,
  writePendingPaymentAttempt,
} from './payment-session-storage.util';

describe('payment-session-storage.util', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('reads null when nothing was ever written', () => {
    expect(readPendingPaymentAttempt('fees')).toBeNull();
  });

  it('round-trips a written attempt', () => {
    writePendingPaymentAttempt('fees', {
      idempotencyKey: 'key-1',
      invoiceId: 'inv-1',
      amount: 500,
      currency: 'BDT',
      paymentId: null,
    });
    expect(readPendingPaymentAttempt('fees')).toEqual({
      idempotencyKey: 'key-1',
      invoiceId: 'inv-1',
      amount: 500,
      currency: 'BDT',
      paymentId: null,
    });
  });

  it('keeps different namespaces isolated (fees vs. hostel-fee)', () => {
    writePendingPaymentAttempt('fees', {
      idempotencyKey: 'key-fees',
      invoiceId: 'inv-1',
      amount: 500,
      currency: 'BDT',
      paymentId: null,
    });
    writePendingPaymentAttempt('hostel-fee', {
      idempotencyKey: 'key-hostel',
      invoiceId: 'inv-2',
      amount: 3000,
      currency: 'BDT',
      paymentId: null,
    });

    expect(readPendingPaymentAttempt('fees')?.idempotencyKey).toBe('key-fees');
    expect(readPendingPaymentAttempt('hostel-fee')?.idempotencyKey).toBe('key-hostel');
  });

  it('clears a written attempt', () => {
    writePendingPaymentAttempt('fees', {
      idempotencyKey: 'key-1',
      invoiceId: 'inv-1',
      amount: 500,
      currency: 'BDT',
      paymentId: null,
    });
    clearPendingPaymentAttempt('fees');
    expect(readPendingPaymentAttempt('fees')).toBeNull();
  });

  it('degrades to null on malformed stored JSON', () => {
    sessionStorage.setItem('ums-student-web:fees:pending-payment', '{not json');
    expect(readPendingPaymentAttempt('fees')).toBeNull();
  });

  it('write and clear are best-effort and never throw even if storage fails', () => {
    spyOn(sessionStorage, 'setItem').and.callFake(() => {
      throw new DOMException('quota exceeded');
    });
    expect(() =>
      writePendingPaymentAttempt('fees', {
        idempotencyKey: 'k',
        invoiceId: 'i',
        amount: 1,
        currency: 'BDT',
        paymentId: null,
      }),
    ).not.toThrow();

    spyOn(sessionStorage, 'removeItem').and.callFake(() => {
      throw new DOMException('failed');
    });
    expect(() => clearPendingPaymentAttempt('fees')).not.toThrow();
  });
});
