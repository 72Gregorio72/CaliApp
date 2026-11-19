// Local notifications: rest-over alarm (rings with the screen locked, where JS timers are paused) and weekly workout reminders.
import type * as NotificationsT from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

// no-op in Expo Go (importing it there logs a red push-notification error on Android) and in dev builds made before it was added
let Notifications: typeof NotificationsT | null = null;
if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
  try {
    Notifications = require('expo-notifications');
  } catch {}
}

const REMINDER = 'reminder_';
// in foreground the session screen rings its own rest alarm, so only reminders are shown
Notifications?.setNotificationHandler({
  handleNotification: async n => {
    const show = n.request.identifier.startsWith(REMINDER);
    return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
  },
});

/** False in Expo Go and in dev builds without the native module: reminders can't be scheduled there. */
export const notificationsAvailable = !!Notifications;

const CHANNEL = 'rest_done';
let scheduled: string | null = null;
// schedule/cancel are async: chain them so a fast pause right after start can't leave a stray alarm
let chain: Promise<unknown> = Promise.resolve();
const run = (f: (n: typeof NotificationsT) => Promise<unknown>) => (chain = chain.then(() => Notifications && f(Notifications)).catch(e => console.error('Notifica recupero:', e)));

export const setupRestNotifications = () =>
  run(async Notifications => {
    // Android 13+ only shows the permission prompt once a channel exists
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Fine recupero',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 600, 400, 600, 400, 600],
        sound: 'default',
      });
    }
    await Notifications.requestPermissionsAsync();
  });

const cancel = async (Notifications: typeof NotificationsT) => {
  if (!scheduled) return;
  const id = scheduled;
  scheduled = null;
  await Notifications.cancelScheduledNotificationAsync(id);
};

export const cancelRestEnd = () => run(cancel);

export const scheduleRestEnd = (seconds: number, exercise: string) =>
  run(async Notifications => {
    await cancel(Notifications);
    if (seconds < 1) return;
    scheduled = await Notifications.scheduleNotificationAsync({
      content: { title: 'Recupero finito!', body: `Prossima serie: ${exercise}`, sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(seconds), channelId: CHANNEL },
    });
  });

/** "18:30", "7.05" -> [18, 30]; anything else -> undefined */
export const parseTime = (t: string) => {
  const m = t.trim().match(/^([01]?d|2[0-3])[:.]([0-5]d)$/);
  return m ? ([Number(m[1]), Number(m[2])] as const) : undefined;
};

/**
 * Replaces all reminders with one weekly notification per entry.
 * dayIndex: 0 = Monday (WEEK_DAYS order).
 */
export const syncReminders = (entries: { dayIndex: number; time: string; title: string }[]) =>
  run(async Notifications => {
    const old = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(old.filter(n => n.identifier.startsWith(REMINDER)).map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    if (!entries.length) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminders', { name: 'Promemoria allenamento', importance: Notifications.AndroidImportance.HIGH });
    }
    if (!(await Notifications.requestPermissionsAsync()).granted) return;
    for (const e of entries) {
      const t = parseTime(e.time);
      if (!t) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${REMINDER}${e.dayIndex}`,
        content: { title: `Oggi: ${e.title}`, body: 'È ora di allenarsi 💪', sound: 'default' },
        // expo weekday: 1 = Sunday … 7 = Saturday
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: ((e.dayIndex + 1) % 7) + 1, hour: t[0], minute: t[1], channelId: 'reminders' },
      });
    }
  });
