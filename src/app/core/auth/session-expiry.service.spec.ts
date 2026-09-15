import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TokenStorageService } from '@ums/shared';
import { AUTH_ROUTES, RETURN_URL_QUERY_PARAM } from './auth-routes.constants';
import { SessionExpiryService } from './session-expiry.service';

describe('SessionExpiryService', () => {
  let tokenStorage: TokenStorageService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    tokenStorage = TestBed.inject(TokenStorageService);
    router = TestBed.inject(Router);
    // Constructor-time subscription: instantiate only once the test's own spies are in place.
    TestBed.inject(SessionExpiryService);
  });

  afterEach(() => localStorage.clear());

  it('navigates to login with a returnUrl the instant the session expires', () => {
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    spyOnProperty(router, 'url', 'get').and.returnValue('/registration');

    tokenStorage.notifySessionExpired();

    expect(navigateSpy).toHaveBeenCalledWith([AUTH_ROUTES.login], {
      queryParams: { [RETURN_URL_QUERY_PARAM]: '/registration' },
    });
  });

  it('does not navigate on a deliberate clear() (only on the sessionExpired$ event)', () => {
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);

    tokenStorage.clear();

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
