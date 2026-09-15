import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../config/app-config';
import { ContentApi } from './content.api';

describe('ContentApi', () => {
  let api: ContentApi;
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
    api = TestBed.inject(ContentApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists the authenticated Student notice feed with skip/take', () => {
    api.listNoticesFeed('Student', 10, 5).subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/api/v1/content/notices/feed` &&
        r.params.get('audience') === 'Student' &&
        r.params.get('skip') === '10' &&
        r.params.get('take') === '5',
    );
    req.flush([]);
  });

  it('defaults skip/take when not given', () => {
    api.listNoticesFeed('Student').subscribe();
    const req = httpMock.expectOne(
      (r) => r.params.get('skip') === '0' && r.params.get('take') === '20',
    );
    req.flush([]);
  });

  it('gets a single notice by id', async () => {
    const result$ = new Promise((resolve) => api.getNotice('notice-1').subscribe(resolve));
    httpMock
      .expectOne(`${baseUrl}/api/v1/content/notices/notice-1`)
      .flush({ id: 'notice-1', languageCode: 'en' });
    expect(await result$).toEqual(jasmine.objectContaining({ languageCode: 'en' }));
  });

  it('propagates a 410 Gone when the notice is archived', async () => {
    const errorPromise = new Promise((resolve) =>
      api.getNotice('notice-1').subscribe({ error: resolve }),
    );
    httpMock
      .expectOne(`${baseUrl}/api/v1/content/notices/notice-1`)
      .flush({ title: 'Gone' }, { status: 410, statusText: 'Gone' });
    const error = (await errorPromise) as { status: number };
    expect(error.status).toBe(410);
  });
});
