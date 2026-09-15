import {
  OPT_OUTABLE_CATEGORIES,
  defaultLocalNotificationPreferences,
  readLocalNotificationPreferences,
  toggleChannelPreference,
  writeLocalNotificationPreferences,
} from './notification-preferences.util';

describe('notification-preferences.util', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('defaults every category+channel to on', () => {
    const prefs = defaultLocalNotificationPreferences();
    expect(prefs['Otp']['Email']).toBeTrue();
    expect(prefs['Informational']['Push']).toBeTrue();
  });

  it('reads the default when nothing was ever written', () => {
    expect(readLocalNotificationPreferences()).toEqual(defaultLocalNotificationPreferences());
  });

  it('round-trips written preferences', () => {
    const prefs = toggleChannelPreference(
      defaultLocalNotificationPreferences(),
      'Informational',
      'Email',
    );
    writeLocalNotificationPreferences(prefs);
    expect(readLocalNotificationPreferences()['Informational']['Email']).toBeFalse();
  });

  it('degrades to the default on malformed stored JSON', () => {
    localStorage.setItem('ums-student-web:notifications:preferences', '{not json');
    expect(readLocalNotificationPreferences()).toEqual(defaultLocalNotificationPreferences());
  });

  describe('toggleChannelPreference', () => {
    it('flips the given category+channel', () => {
      const prefs = defaultLocalNotificationPreferences();
      const toggled = toggleChannelPreference(prefs, 'Informational', 'InApp');
      expect(toggled['Informational']['InApp']).toBeFalse();
      const toggledAgain = toggleChannelPreference(toggled, 'Informational', 'InApp');
      expect(toggledAgain['Informational']['InApp']).toBeTrue();
    });

    it('only Informational is confirmed opt-outable', () => {
      expect(OPT_OUTABLE_CATEGORIES).toEqual(['Informational']);
    });

    it('is a no-op for a mandatory category', () => {
      const prefs = defaultLocalNotificationPreferences();
      const attempted = toggleChannelPreference(prefs, 'SecurityAlert', 'Email');
      expect(attempted).toBe(prefs);
    });
  });
});
