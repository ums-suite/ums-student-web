import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TokenStorageService } from '@ums/shared';
import { AUTH_ROUTES } from './auth-routes.constants';
import { studentGuard } from './student.guard';

function tokenWithRoles(roles: readonly string[]): {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
} {
  const payload = { sub: 'user-1', sid: 'session-1', roles };
  const base64 = btoa(JSON.stringify(payload)).replace(/=+$/, '');
  return {
    accessToken: `header.${base64}.signature`,
    accessTokenExpiresAt: '2026-01-01T00:15:00Z',
    refreshToken: 'refresh-1',
    refreshTokenExpiresAt: '2026-01-08T00:00:00Z',
    sessionId: 'session-1',
  };
}

describe('studentGuard', () => {
  let tokenStorage: TokenStorageService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    tokenStorage = TestBed.inject(TokenStorageService);
    router = TestBed.inject(Router);
  });

  afterEach(() => localStorage.clear());

  it('allows a token carrying the Student role through', () => {
    tokenStorage.setTokens(tokenWithRoles(['Student']));
    const result = TestBed.runInInjectionContext(() => studentGuard({} as never, {} as never));
    expect(result).toBeTrue();
  });

  it('redirects a token with no Student role to login', () => {
    tokenStorage.setTokens(tokenWithRoles(['Faculty']));
    const result = TestBed.runInInjectionContext(() => studentGuard({} as never, {} as never));
    const tree = router.serializeUrl(result as ReturnType<Router['createUrlTree']>);
    expect(tree).toContain(AUTH_ROUTES.login);
  });
});
