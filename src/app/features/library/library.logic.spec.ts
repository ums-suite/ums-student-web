import { classifyReservationError, daysUntilDue, isClaimWindowExpired } from './library.logic';

describe('library.logic', () => {
  describe('classifyReservationError', () => {
    it('classifies reservation.copy_available', () => {
      expect(classifyReservationError({ code: 'reservation.copy_available' } as never)).toBe(
        'copyNowAvailable',
      );
    });

    it('classifies reservation.already_queued', () => {
      expect(classifyReservationError({ code: 'reservation.already_queued' } as never)).toBe(
        'alreadyQueued',
      );
    });

    it('falls back to generic for an unknown code', () => {
      expect(classifyReservationError({ code: 'something.else' } as never)).toBe('generic');
    });

    it('falls back to generic when there is no code at all', () => {
      expect(classifyReservationError({} as never)).toBe('generic');
    });
  });

  describe('daysUntilDue', () => {
    it('returns a positive count for a future due date', () => {
      const now = new Date('2026-01-01T00:00:00Z');
      expect(daysUntilDue('2026-01-04T00:00:00Z', now)).toBe(3);
    });

    it('returns a negative count for a past due date', () => {
      const now = new Date('2026-01-10T00:00:00Z');
      expect(daysUntilDue('2026-01-04T00:00:00Z', now)).toBe(-6);
    });

    it('returns 0 for a due date that is exactly now', () => {
      const now = new Date('2026-01-01T00:00:00Z');
      expect(daysUntilDue('2026-01-01T00:00:00Z', now)).toBe(0);
    });
  });

  describe('isClaimWindowExpired', () => {
    it('is false when there is no claim window at all', () => {
      expect(isClaimWindowExpired(null, new Date())).toBeFalse();
    });

    it('is false before expiry', () => {
      const now = new Date('2026-01-01T00:00:00Z');
      expect(isClaimWindowExpired('2026-01-02T00:00:00Z', now)).toBeFalse();
    });

    it('is true after expiry', () => {
      const now = new Date('2026-01-03T00:00:00Z');
      expect(isClaimWindowExpired('2026-01-02T00:00:00Z', now)).toBeTrue();
    });
  });
});
