import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../config/app-config';
import { DocumentsApi } from './documents.api';

describe('DocumentsApi', () => {
  let api: DocumentsApi;
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
    api = TestBed.inject(DocumentsApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists my documents scoped to ownerId, optionally filtered by type', async () => {
    const result$ = new Promise((resolve) =>
      api.listMyDocuments('student-1', 'Transcript').subscribe(resolve),
    );
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/api/v1/documents` &&
        r.params.get('ownerId') === 'student-1' &&
        r.params.get('type') === 'Transcript',
    );
    req.flush([{ id: 'doc-1' }]);
    expect(await result$).toEqual([jasmine.objectContaining({ id: 'doc-1' })]);
  });

  it('omits the type param when not given', () => {
    api.listMyDocuments('student-1').subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/api/v1/documents` && r.params.get('ownerId') === 'student-1',
    );
    expect(req.request.params.has('type')).toBeFalse();
    req.flush([]);
  });

  it('gets a document by id', async () => {
    const result$ = new Promise((resolve) => api.getDocument('doc-1').subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/documents/doc-1`).flush({ id: 'doc-1', status: 'Ready' });
    expect(await result$).toEqual(jasmine.objectContaining({ status: 'Ready' }));
  });

  it('verifies a document by verification id', async () => {
    const result$ = new Promise((resolve) => api.verifyDocument('verify-1').subscribe(resolve));
    httpMock
      .expectOne(`${baseUrl}/api/v1/documents/verify/verify-1`)
      .flush({ digitalVerificationId: 'verify-1', isValid: true });
    expect(await result$).toEqual(jasmine.objectContaining({ isValid: true }));
  });
});
