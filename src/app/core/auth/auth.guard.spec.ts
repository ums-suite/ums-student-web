import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TokenStorageService } from '@ums/shared';
import { authGuard, guestGuard } from './auth.guard';
import { AUTH_ROUTES, RETURN_URL_QUERY_PARAM } from './auth-routes.constants';

const tokenPair = {
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-01-01T00:15:00Z',
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: '2026-01-08T00:00:00Z',
  sessionId: 'session-1',
};

describe('authGuard / guestGuard', () => {
  let tokenStorage: TokenStorageService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    tokenStorage = TestBed.inject(TokenStorageService);
    router = TestBed.inject(Router);
  });

  afterEach(() => localStorage.clear());

  describe('authGuard', () => {
    it('allows an authenticated student through', () => {
      tokenStorage.setTokens(tokenPair);
      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as never, { url: '/registration' } as never),
      );
      expect(result).toBeTrue();
    });

    it('redirects an unauthenticated student to login with a returnUrl', () => {
      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as never, { url: '/registration' } as never),
      );
      const tree = router.serializeUrl(result as ReturnType<Router['createUrlTree']>);
      expect(tree).toContain(AUTH_ROUTES.login);
      expect(tree).toContain(`${RETURN_URL_QUERY_PARAM}=%2Fregistration`);
    });
  });

  describe('guestGuard', () => {
    it('allows an unauthenticated visitor through', () => {
      const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));
      expect(result).toBeTrue();
    });

    it('redirects an already-authenticated student away from the guest-only screen', () => {
      tokenStorage.setTokens(tokenPair);
      const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));
      const tree = router.serializeUrl(result as ReturnType<Router['createUrlTree']>);
      expect(tree).toContain(AUTH_ROUTES.authenticatedHome);
    });
  });
});
