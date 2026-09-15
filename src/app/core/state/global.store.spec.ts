import { TestBed } from '@angular/core/testing';
import { GlobalStore } from './global.store';

describe('GlobalStore', () => {
  let store: GlobalStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(GlobalStore);
  });

  afterEach(() => localStorage.clear());

  it('defaults to the English locale', () => {
    expect(store.locale()).toBe('en');
  });

  it('setLocale updates the reactive locale signal', () => {
    store.setLocale('bn');
    expect(store.locale()).toBe('bn');
  });

  it('setThemeMode updates the reactive theme mode signal', () => {
    store.setThemeMode('dark');
    expect(store.themeMode()).toBe('dark');
  });

  it('starts with zero unread notifications', () => {
    expect(store.unreadNotificationCount()).toBe(0);
  });
});
