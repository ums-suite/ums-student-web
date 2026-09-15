import {
  NOTIFICATION_CHANNELS,
  type LocalNotificationPreferences,
  type NotificationCategory,
} from '../../core/api/notifications.types';

const STORAGE_KEY = 'ums-student-web:notifications:preferences';

/** `Informational` is the sole opt-out-able category server-side (confirmed, `RecipientNotificationPreference`) -- every other category is mandatory and always shown as on, never a real toggle. */
export const OPT_OUTABLE_CATEGORIES: readonly NotificationCategory[] = ['Informational'];

const ALL_CATEGORIES: readonly NotificationCategory[] = [
  'Otp',
  'SecurityAlert',
  'Payment',
  'Result',
  'Transactional',
  'Informational',
];

/** Every category defaults to every channel "on" -- matching the server's own "absence of a row means not opted out" default (`RecipientPreferenceService`, confirmed). */
export function defaultLocalNotificationPreferences(): LocalNotificationPreferences {
  const prefs: Record<string, Record<string, boolean>> = {};
  for (const category of ALL_CATEGORIES) {
    prefs[category] = Object.fromEntries(NOTIFICATION_CHANNELS.map((c) => [c, true]));
  }
  return prefs as LocalNotificationPreferences;
}

/**
 * **Confirmed gap, not a real backend contract** (`notifications.types.ts`
 * `LocalNotificationPreferences` doc): no preference read/write HTTP endpoint exists anywhere in
 * `ums-core` today, so this is a client-local approximation only, never synced to a server.
 */
export function readLocalNotificationPreferences(): LocalNotificationPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? { ...defaultLocalNotificationPreferences(), ...(JSON.parse(raw) as object) }
      : defaultLocalNotificationPreferences();
  } catch {
    return defaultLocalNotificationPreferences();
  }
}

export function writeLocalNotificationPreferences(prefs: LocalNotificationPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Best-effort only.
  }
}

/** Toggling a mandatory category's channel is a no-op -- the UI must not even offer this, but the pure logic itself refuses defensively too. */
export function toggleChannelPreference(
  prefs: LocalNotificationPreferences,
  category: NotificationCategory,
  channel: (typeof NOTIFICATION_CHANNELS)[number],
): LocalNotificationPreferences {
  if (!OPT_OUTABLE_CATEGORIES.includes(category)) {
    return prefs;
  }
  const current = prefs[category]?.[channel] ?? true;
  return {
    ...prefs,
    [category]: { ...prefs[category], [channel]: !current },
  };
}
