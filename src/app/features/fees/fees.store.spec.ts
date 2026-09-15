import { TestBed } from '@angular/core/testing';
import { FeesStore } from './fees.store';

describe('FeesStore', () => {
  it('starts idle with no error', () => {
    const store = TestBed.inject(FeesStore);
    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeNull();
  });
});
