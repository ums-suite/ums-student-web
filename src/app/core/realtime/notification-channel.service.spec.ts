import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../config/app-config';
import { NotificationChannelService } from './notification-channel.service';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(
    public readonly url: string,
    public readonly options?: EventSourceInit,
  ) {
    FakeEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }
}

describe('NotificationChannelService', () => {
  let service: NotificationChannelService;
  let originalEventSource: typeof EventSource;

  beforeEach(() => {
    originalEventSource = (globalThis as { EventSource: typeof EventSource }).EventSource;
    (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
    FakeEventSource.instances = [];

    TestBed.configureTestingModule({
      providers: [
        {
          provide: APP_CONFIG,
          useValue: { apiBaseUrl: 'http://localhost:8080', pollIntervalMs: 10_000 },
        },
      ],
    });
    service = TestBed.inject(NotificationChannelService);
  });

  afterEach(() => {
    service.disconnect();
    (globalThis as unknown as { EventSource: unknown }).EventSource = originalEventSource;
  });

  it('starts with an unread count of zero and disconnected', () => {
    expect(service.unreadCount()).toBe(0);
    expect(service.connected()).toBeFalse();
  });

  it('connects to the assumed notifications stream endpoint', () => {
    service.connect();
    expect(FakeEventSource.instances.length).toBe(1);
    expect(FakeEventSource.instances[0].url).toBe(
      'http://localhost:8080/api/v1/notifications/stream',
    );
  });

  it('marks connected on open and updates unread count on a valid message', () => {
    service.connect();
    const source = FakeEventSource.instances[0];

    source.onopen?.();
    expect(service.connected()).toBeTrue();

    source.onmessage?.({ data: JSON.stringify({ unreadCount: 3 }) } as MessageEvent<string>);
    expect(service.unreadCount()).toBe(3);
  });

  it('ignores a malformed message without throwing', () => {
    service.connect();
    const source = FakeEventSource.instances[0];

    expect(() => source.onmessage?.({ data: 'not json' } as MessageEvent<string>)).not.toThrow();
    expect(service.unreadCount()).toBe(0);
  });

  it('marks disconnected and closes the source on error', () => {
    service.connect();
    const source = FakeEventSource.instances[0];
    source.onopen?.();

    source.onerror?.();

    expect(service.connected()).toBeFalse();
    expect(source.closed).toBeTrue();
  });

  it('clearUnread resets the badge count', () => {
    service.connect();
    const source = FakeEventSource.instances[0];
    source.onmessage?.({ data: JSON.stringify({ unreadCount: 5 }) } as MessageEvent<string>);

    service.clearUnread();

    expect(service.unreadCount()).toBe(0);
  });

  it('disconnect closes the source and is idempotent', () => {
    service.connect();
    const source = FakeEventSource.instances[0];

    service.disconnect();
    expect(source.closed).toBeTrue();

    expect(() => service.disconnect()).not.toThrow();
  });
});
