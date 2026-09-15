import { DEFAULT_LOW_SEAT_THRESHOLD, seatGaugeTone, seatsRemaining } from './seat-gauge';

describe('seatsRemaining', () => {
  it('computes capacity minus enrolledCount', () => {
    expect(seatsRemaining({ capacity: 30, enrolledCount: 25 })).toBe(5);
  });

  it('never goes negative even if over-enrolled', () => {
    expect(seatsRemaining({ capacity: 30, enrolledCount: 35 })).toBe(0);
  });
});

describe('seatGaugeTone', () => {
  it('is danger when the offering has no available seats', () => {
    expect(seatGaugeTone({ capacity: 30, enrolledCount: 30, hasAvailableSeats: false })).toBe(
      'danger',
    );
  });

  it('is warning at or under the low-seat threshold', () => {
    expect(
      seatGaugeTone({
        capacity: 30,
        enrolledCount: 30 - DEFAULT_LOW_SEAT_THRESHOLD,
        hasAvailableSeats: true,
      }),
    ).toBe('warning');
  });

  it('is success comfortably above the threshold', () => {
    expect(seatGaugeTone({ capacity: 30, enrolledCount: 5, hasAvailableSeats: true })).toBe(
      'success',
    );
  });

  it('respects a custom threshold', () => {
    expect(seatGaugeTone({ capacity: 30, enrolledCount: 20, hasAvailableSeats: true }, 10)).toBe(
      'warning',
    );
  });
});
