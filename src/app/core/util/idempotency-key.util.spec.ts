import { generateIdempotencyKey } from './idempotency-key.util';

describe('idempotency-key.util', () => {
  it('generates a non-empty string', () => {
    expect(generateIdempotencyKey().length).toBeGreaterThan(0);
  });

  it('generates a different key on each call', () => {
    expect(generateIdempotencyKey()).not.toBe(generateIdempotencyKey());
  });

  it('falls back to a timestamp+random string when crypto.randomUUID is unavailable', () => {
    const original = crypto.randomUUID;
    // @ts-expect-error -- deliberately simulating an older runtime without randomUUID
    crypto.randomUUID = undefined;
    try {
      expect(generateIdempotencyKey().startsWith('idempotency-')).toBeTrue();
    } finally {
      crypto.randomUUID = original;
    }
  });
});
