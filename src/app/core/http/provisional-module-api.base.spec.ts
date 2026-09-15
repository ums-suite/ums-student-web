import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { ProvisionalModuleApiBase } from './provisional-module-api.base';

@Injectable()
class FakeAcademicApi extends ProvisionalModuleApiBase {
  ping() {
    return this.http.get(this.apiUrl('academic/ping'));
  }

  fails() {
    return this.normalizeErrors(throwError(() => new Error('boom')));
  }

  succeeds() {
    return this.normalizeErrors(of('ok'));
  }
}

describe('ProvisionalModuleApiBase', () => {
  let api: FakeAcademicApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: APP_CONFIG,
          useValue: { apiBaseUrl: 'http://localhost:8080', pollIntervalMs: 10_000 },
        },
        FakeAcademicApi,
      ],
    });
    TestBed.inject(HttpClient);
    api = TestBed.inject(FakeAcademicApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('builds URLs as {baseUrl}/api/v1/{path}, matching the generated client convention', () => {
    api.ping().subscribe();
    const req = httpMock.expectOne('http://localhost:8080/api/v1/academic/ping');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('normalizes a failure through toUmsApiError', async () => {
    await expectAsync(firstValueFrom(api.fails())).toBeRejectedWith(
      jasmine.objectContaining({ status: 0, message: 'boom' }),
    );
  });

  it('passes a successful value through unchanged', async () => {
    await expectAsync(firstValueFrom(api.succeeds())).toBeResolvedTo('ok');
  });
});
