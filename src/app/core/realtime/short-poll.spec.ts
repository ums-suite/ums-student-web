import { of } from 'rxjs';
import { shortPoll } from './short-poll';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('shortPoll', () => {
  it('emits immediately, then again every intervalMs', async () => {
    let callCount = 0;
    const values: number[] = [];

    const sub = shortPoll(() => {
      callCount++;
      return of(callCount);
    }, 20).subscribe((v) => values.push(v));

    await wait(5);
    expect(values).toEqual([1]);

    await wait(30);
    expect(values.length).toBeGreaterThanOrEqual(2);

    sub.unsubscribe();
  });

  it('stops emitting once unsubscribed', async () => {
    const values: string[] = [];
    const sub = shortPoll(() => of('tick'), 15).subscribe((v) => values.push(v));

    await wait(5);
    sub.unsubscribe();
    const countAtUnsubscribe = values.length;

    await wait(40);
    expect(values.length).toBe(countAtUnsubscribe);
  });

  it('abandons a slow in-flight tick (switchMap) rather than accumulating values out of order', async () => {
    const values: string[] = [];
    const sub = shortPoll(() => of('tick'), 15).subscribe((v) => values.push(v));

    await wait(50);
    expect(values.every((v) => v === 'tick')).toBeTrue();
    expect(values.length).toBeGreaterThan(1);

    sub.unsubscribe();
  });
});
