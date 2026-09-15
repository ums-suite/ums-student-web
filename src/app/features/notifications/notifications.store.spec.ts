import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../../core/config/app-config';
import { NotificationsStore } from './notifications.store';

describe('NotificationsStore', () => {
  let store: NotificationsStore;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:8080';

  function flushInitialLoad(notices: unknown[] = [], inbox: unknown[] = [], unreadCount = 0): void {
    httpMock.expectOne((r) => r.url === `${baseUrl}/api/v1/content/notices/feed`).flush(notices);
    httpMock.expectOne((r) => r.url === `${baseUrl}/api/v1/notifications/me/`).flush(inbox);
    httpMock.expectOne(`${baseUrl}/api/v1/notifications/me/unread-count`).flush({ unreadCount });
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: baseUrl, pollIntervalMs: 10_000 } },
      ],
    });
    store = TestBed.inject(NotificationsStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('starts idle', () => {
    expect(store.loading()).toBeFalse();
    expect(store.notices()).toEqual([]);
  });

  it('loads notices/inbox/unread count', () => {
    store.load();
    flushInitialLoad([{ id: 'n1', languageCode: 'en' }], [{ id: 'in1' }], 3);

    expect(store.notices().length).toBe(1);
    expect(store.inbox().length).toBe(1);
    expect(store.unreadCount()).toBe(3);
    expect(store.fetchedAt()).not.toBeNull();
  });

  it('flags a Notice shown in a fallback language different from the requested locale', () => {
    store.load();
    flushInitialLoad([
      { id: 'n1', languageCode: 'en' },
      { id: 'n2', languageCode: 'bn' },
    ]);
    // default LocaleService locale is 'en' in a fresh TestBed
    expect(store.noticesShownInFallbackLanguage().has('n2')).toBeTrue();
    expect(store.noticesShownInFallbackLanguage().has('n1')).toBeFalse();
  });

  it('marks one notification read and reloads', () => {
    store.markRead('in1');
    const req = httpMock.expectOne(`${baseUrl}/api/v1/notifications/me/in1/read`);
    expect(req.request.method).toBe('PATCH');
    req.flush(null);
    flushInitialLoad();
  });

  it('marks all notifications read and reloads', () => {
    store.markAllRead();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/notifications/me/read-all`);
    expect(req.request.method).toBe('PATCH');
    req.flush(null);
    flushInitialLoad();
  });

  it('toggles a client-local channel preference for the sole opt-outable category', () => {
    expect(store.preferences()['Informational']['Email']).toBeTrue();
    store.toggleChannel('Informational', 'Email');
    expect(store.preferences()['Informational']['Email']).toBeFalse();
  });

  it('refuses to toggle a mandatory category', () => {
    const before = store.preferences();
    store.toggleChannel('SecurityAlert', 'Email');
    expect(store.preferences()).toBe(before);
  });
});
