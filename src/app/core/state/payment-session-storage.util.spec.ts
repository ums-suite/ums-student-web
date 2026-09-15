import {
  clearPendingPaymentAttempt,
  readPendingPaymentAttempt,
  writePendingPaymentAttempt,
} from './payment-session-storage.util';

describe('payment-session-storage.util', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('reads null when nothing was ever written', () => {
    expect(readPendingPaymentAttempt()).toBeNull();
  });

  it('round-trips a written attempt', () => {
    writePendingPaymentAttempt({
      idempotencyKey: 'key-1',
      invoiceId: 'inv-1',
      amount: 500,
      currency: 'BDT',
      paymentId: null,
    });
    expect(readPendingPaymentAttempt()).toEqual({
      idempotencyKey: 'key-1',
      invoiceId: 'inv-1',
      amount: 500,
      currency: 'BDT',
      paymentId: null,
    });
  });

  it('clears a written attempt', () => {
    writePendingPaymentAttempt({
      idempotencyKey: 'key-1',
      invoiceId: 'inv-1',
      amount: 500,
      currency: 'BDT',
      paymentId: null,
    });
    clearPendingPaymentAttempt();
    expect(readPendingPaymentAttempt()).toBeNull();
  });

  it('degrades to null on malformed stored JSON', () => {
    sessionStorage.setItem('ums-student-web:fees:pending-payment', '{not json');
    expect(readPendingPaymentAttempt()).toBeNull();
  });

  it('write and clear are best-effort and never throw even if storage fails', () => {
    spyOn(sessionStorage, 'setItem').and.callFake(() => {
      throw new DOMException('quota exceeded');
    });
    expect(() =>
      writePendingPaymentAttempt({
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
    expect(() => clearPendingPaymentAttempt()).not.toThrow();
  });
});
