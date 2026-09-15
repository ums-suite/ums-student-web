import {
  WAITLIST_CONFIRM_SAFETY_MARGIN_MS,
  canDispatchWaitlistConfirm,
  computeWaitlistCountdown,
} from './waitlist-countdown';

describe('computeWaitlistCountdown', () => {
  it('reports the exact remaining time well before the margin', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const expiresAt = '2026-01-01T00:00:10Z';
    const state = computeWaitlistCountdown(expiresAt, now);

    expect(state.remainingMs).toBe(10_000);
    expect(state.remainingSeconds).toBe(10);
    expect(state.withinSafetyMargin).toBeFalse();
    expect(state.expired).toBeFalse();
  });

  it('flags withinSafetyMargin exactly at the margin boundary', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const expiresAt = new Date(now.getTime() + WAITLIST_CONFIRM_SAFETY_MARGIN_MS).toISOString();
    const state = computeWaitlistCountdown(expiresAt, now);

    expect(state.withinSafetyMargin).toBeTrue();
    expect(state.expired).toBeFalse();
  });

  it('flags withinSafetyMargin just inside the margin', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const expiresAt = new Date(now.getTime() + WAITLIST_CONFIRM_SAFETY_MARGIN_MS - 1).toISOString();
    const state = computeWaitlistCountdown(expiresAt, now);
    expect(state.withinSafetyMargin).toBeTrue();
  });

  it('does not flag withinSafetyMargin just outside the margin', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const expiresAt = new Date(now.getTime() + WAITLIST_CONFIRM_SAFETY_MARGIN_MS + 1).toISOString();
    const state = computeWaitlistCountdown(expiresAt, now);
    expect(state.withinSafetyMargin).toBeFalse();
  });

  it('clamps remainingMs to zero and marks expired once the deadline has passed', () => {
    const now = new Date('2026-01-01T00:00:10Z');
    const expiresAt = '2026-01-01T00:00:00Z';
    const state = computeWaitlistCountdown(expiresAt, now);

    expect(state.remainingMs).toBe(0);
    expect(state.remainingSeconds).toBe(0);
    expect(state.expired).toBeTrue();
    expect(state.withinSafetyMargin).toBeTrue();
  });
});

describe('canDispatchWaitlistConfirm', () => {
  it('allows dispatch outside the safety margin', () => {
    expect(
      canDispatchWaitlistConfirm({
        remainingMs: 10_000,
        remainingSeconds: 10,
        withinSafetyMargin: false,
        expired: false,
      }),
    ).toBeTrue();
  });

  it('blocks dispatch inside the safety margin', () => {
    expect(
      canDispatchWaitlistConfirm({
        remainingMs: 1_000,
        remainingSeconds: 1,
        withinSafetyMargin: true,
        expired: false,
      }),
    ).toBeFalse();
  });
});
