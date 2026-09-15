import { Injectable, inject } from '@angular/core';
import { IdentityApiService, TokenStorageService, type UmsTokenPair } from '@ums/shared';
import { Observable, tap } from 'rxjs';

/**
 * This app's own login/logout facade over `@ums/shared`'s session primitives (SWEB-4,
 * requirement-spec.md §2 Auth row, §5, ADR-0005). `@ums/shared` deliberately does not ship this
 * facade itself, to stay out of domain/flow logic per ADR-0017.
 *
 * Session mechanics (established by `@ums/shared`, not re-derived here): a signed access/refresh
 * token pair, held in `TokenStorageService`'s signal; `authInterceptor` attaches the bearer token
 * and single-flights refresh-on-401; `AuthRefreshCoordinator` owns the actual rotation call. This
 * app never parses or attaches a token by hand outside that existing machinery.
 *
 * The generated `IdentityApiService`'s auth methods are untyped (`Observable<any>`); this service
 * is the one place that risk is contained, casting the response to {@link UmsTokenPair}.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly identityApi = inject(IdentityApiService);
  private readonly tokenStorage = inject(TokenStorageService);

  /** `POST /api/v1/identity/auth/login`. Stores the returned token pair on success. */
  login(identifier: string, password: string): Observable<UmsTokenPair> {
    return (
      this.identityApi.apiV1IdentityAuthLoginPost({
        identifier,
        password,
      }) as Observable<UmsTokenPair>
    ).pipe(tap((pair) => this.tokenStorage.setTokens(pair)));
  }

  /**
   * `POST /api/v1/identity/auth/logout` (this session only). Clears local session state
   * regardless of whether the server call succeeds -- a logout that fails server-side must never
   * leave the student looking logged-in on their own device. Also clears every other piece of
   * this-tab-scoped durable storage this app owns (e.g. a future in-flight payment idempotency
   * key, design-decisions.md "Payment Idempotency-Key Persistence") so nothing survives a logout.
   */
  logout(): Observable<unknown> {
    return this.identityApi
      .apiV1IdentityAuthLogoutPost()
      .pipe(tap({ next: () => this.tokenStorage.clear(), error: () => this.tokenStorage.clear() }));
  }

  /** `POST /api/v1/identity/auth/logout-all` (every session/device) -- same local-clear guarantee as {@link logout}. */
  logoutAll(): Observable<unknown> {
    return this.identityApi
      .apiV1IdentityAuthLogoutAllPost()
      .pipe(tap({ next: () => this.tokenStorage.clear(), error: () => this.tokenStorage.clear() }));
  }
}
