import { TestBed } from '@angular/core/testing';
import { PushOptInService } from './push-opt-in.service';

describe('PushOptInService', () => {
  let service: PushOptInService;
  let originalNotification: unknown;

  beforeEach(() => {
    localStorage.clear();
    originalNotification = (window as unknown as { Notification?: unknown }).Notification;
  });

  afterEach(() => {
    localStorage.clear();
    (window as unknown as { Notification?: unknown }).Notification = originalNotification;
  });

  function stubNotification(permission: 'default' | 'granted' | 'denied', resolvesTo?: string) {
    (window as unknown as { Notification: unknown }).Notification = {
      permission,
      requestPermission: () => Promise.resolve(resolvesTo ?? permission),
    };
  }

  it('starts opted out, never defaulted on', () => {
    stubNotification('default');
    service = TestBed.inject(PushOptInService);
    expect(service.optedIn()).toBeFalse();
  });

  it('opts in only after an explicit request resolves to granted', async () => {
    stubNotification('default', 'granted');
    service = TestBed.inject(PushOptInService);

    await service.requestOptIn();

    expect(service.optedIn()).toBeTrue();
    expect(service.permissionState()).toBe('granted');
  });

  it('does not opt in when permission is denied', async () => {
    stubNotification('default', 'denied');
    service = TestBed.inject(PushOptInService);

    await service.requestOptIn();

    expect(service.optedIn()).toBeFalse();
    expect(service.permissionState()).toBe('denied');
  });

  it('reports unsupported when Notification does not exist on this runtime', async () => {
    delete (window as unknown as { Notification?: unknown }).Notification;
    service = TestBed.inject(PushOptInService);

    await service.requestOptIn();

    expect(service.permissionState()).toBe('unsupported');
    expect(service.optedIn()).toBeFalse();
  });

  it('optOut clears a previously granted opt-in', async () => {
    stubNotification('default', 'granted');
    service = TestBed.inject(PushOptInService);
    await service.requestOptIn();
    expect(service.optedIn()).toBeTrue();

    service.optOut();
    expect(service.optedIn()).toBeFalse();
  });

  it('persists the opt-in choice to localStorage', async () => {
    stubNotification('default', 'granted');
    service = TestBed.inject(PushOptInService);
    await service.requestOptIn();

    expect(localStorage.getItem('ums-student-web:notifications:push-opt-in')).toBe('true');
  });
});
