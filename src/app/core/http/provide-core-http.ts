import { EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  authInterceptor,
  correlationIdInterceptor,
  localeInterceptor,
  provideApi,
  UMS_AUTH_CONFIG,
} from '@ums/shared';
import { APP_CONFIG, DEFAULT_APP_CONFIG } from '../config/app-config';
import { environment } from '../../../environments/environment';

/**
 * Wires this app's entire HTTP/API-client layer (SWEB-5, requirement-spec.md §2/§4 Observability
 * row/§6).
 *
 * Interceptor order matters, mirroring `@ums/shared`'s own README ("Wiring it up"):
 * 1. {@link correlationIdInterceptor} first, so even a 401-triggered retry's very first attempt
 *    still carries a correlation id (threaded through to backend logs/traces on every
 *    registration and payment call per requirement-spec.md §4).
 * 2. {@link localeInterceptor} next, so every call (including the retry) carries the active
 *    locale (ADR-0011).
 * 3. {@link authInterceptor} last of the three -- it's the one that clones the request again for
 *    a retry and reads/attaches the bearer token; `authInterceptor`'s own third-party-origin
 *    token-leak bug is already fixed upstream (checks the request's origin against
 *    `config.baseUrl` before attaching), so it is used here with no workaround.
 *
 * `provideApi` wires `@ums/shared`'s generated OpenAPI client (Identity/Audit/Organization today)
 * with the same base URL as {@link UMS_AUTH_CONFIG}, so the generated client, the refresh
 * coordinator, and the interceptor chain above are all always pointed at the same origin.
 */
export function provideCoreHttp(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: APP_CONFIG,
      useValue: { ...DEFAULT_APP_CONFIG, apiBaseUrl: environment.apiBaseUrl },
    },
    provideHttpClient(
      withInterceptors([correlationIdInterceptor, localeInterceptor, authInterceptor]),
    ),
    {
      provide: UMS_AUTH_CONFIG,
      useFactory: () => ({ baseUrl: inject(APP_CONFIG).apiBaseUrl }),
    },
    provideApi({ basePath: environment.apiBaseUrl }),
  ]);
}
