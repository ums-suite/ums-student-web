import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../config/app-config';
import { NotificationsApi } from './notifications.api';

describe('NotificationsApi', () => {
  let api: NotificationsApi;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:8080';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: baseUrl, pollIntervalMs: 10_000 } },
      ],
    });
    api = TestBed.inject(NotificationsApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists my notifications with skip/take', async () => {
    const result$ = new Promise((resolve) => api.listMyNotifications(0, 20).subscribe(resolve));
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/api/v1/notifications/me/` &&
        r.params.get('skip') === '0' &&
        r.params.get('take') === '20',
    );
    req.flush([{ id: 'n1' }]);
    expect(await result$).toEqual([jasmine.objectContaining({ id: 'n1' })]);
  });

  it('gets the unread count, unwrapped to a plain number', async () => {
    const result$ = new Promise((resolve) => api.getUnreadCount().subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/notifications/me/unread-count`).flush({ unreadCount: 4 });
    expect(await result$).toBe(4);
  });

  it('marks one notification read', async () => {
    const done$ = new Promise((resolve) => api.markRead('notif-1').subscribe(resolve));
    const req = httpMock.expectOne(`${baseUrl}/api/v1/notifications/me/notif-1/read`);
    expect(req.request.method).toBe('PATCH');
    req.flush(null);
    await done$;
  });

  it('marks all notifications read', async () => {
    const done$ = new Promise((resolve) => api.markAllRead().subscribe(resolve));
    const req = httpMock.expectOne(`${baseUrl}/api/v1/notifications/me/read-all`);
    expect(req.request.method).toBe('PATCH');
    req.flush(null);
    await done$;
  });
});
