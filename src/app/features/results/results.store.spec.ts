import { TestBed } from '@angular/core/testing';
import { ResultsStore } from './results.store';

describe('ResultsStore', () => {
  it('starts idle with no error', () => {
    const store = TestBed.inject(ResultsStore);
    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeNull();
  });
});
