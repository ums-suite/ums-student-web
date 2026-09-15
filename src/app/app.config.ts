import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideCoreHttp } from './core/http/provide-core-http';
import { routes } from './app.routes';

/**
 * SWEB-7: the service worker is registered `registerWhenStable:30000` (Angular CLI's own
 * PWA-schematic default) so it never competes with the initial bundle for bandwidth/CPU on first
 * paint -- installability and offline caching are a retention lever (requirement-spec.md §2
 * Installability row), not a first-load requirement. `ngsw-config.json`'s `dataGroups` only lists
 * genuinely read-only, already-fetched Dashboard sources (student profile, invoices, hostel
 * allocation) with a `freshness` (network-first) strategy -- registration/enrollment and every
 * payment/hostel/library mutation endpoint is deliberately absent, so those calls are never served
 * from cache and a mutating request made while offline fails as a real network error (surfaced by
 * `ConnectivityService`, not silently queued -- Invariant §8.3).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideCoreHttp(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
