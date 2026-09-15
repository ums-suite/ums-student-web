import { TestBed } from '@angular/core/testing';
import { ConnectivityReconciliationService } from './connectivity-reconciliation.service';

describe('ConnectivityReconciliationService', () => {
  let service: ConnectivityReconciliationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConnectivityReconciliationService);
  });

  it('emits on reconciled$ when the browser reports online', () => {
    const next = jasmine.createSpy('next');
    service.reconciled$.subscribe(next);

    window.dispatchEvent(new Event('online'));

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not emit on an offline event', () => {
    const next = jasmine.createSpy('next');
    service.reconciled$.subscribe(next);

    window.dispatchEvent(new Event('offline'));

    expect(next).not.toHaveBeenCalled();
  });
});
