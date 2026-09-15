import { TestBed } from '@angular/core/testing';
import { LibraryStore } from './library.store';

describe('LibraryStore', () => {
  it('starts idle with no error', () => {
    const store = TestBed.inject(LibraryStore);
    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeNull();
  });
});
