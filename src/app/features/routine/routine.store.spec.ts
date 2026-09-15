import { TestBed } from '@angular/core/testing';
import { RoutineStore } from './routine.store';

describe('RoutineStore', () => {
  it('starts idle with no error', () => {
    const store = TestBed.inject(RoutineStore);
    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeNull();
  });
});
