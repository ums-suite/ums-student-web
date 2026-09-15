import { TestBed } from '@angular/core/testing';
import { HostelStore } from './hostel.store';

describe('HostelStore', () => {
  it('starts idle with no error', () => {
    const store = TestBed.inject(HostelStore);
    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeNull();
  });
});
