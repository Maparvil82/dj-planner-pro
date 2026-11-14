import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { VOICE_NOTIFICATION_PREFIX, voiceReminderPlan } from '../utils/voiceReminders';
import { POST_SESSION_NOTIFICATION_PREFIX, postSessionReminderPlan, type ReviewSession } from '../utils/postSessionReminders';
import type { VoiceSchedule } from './voiceNotes';

export function voiceNotificationsAvailable() {
    return Platform.OS !== 'web' && !!requireOptionalNativeModule('ExpoNotificationScheduler');
}
export async function requestVoiceNotifications() {
    if (!voiceNotificationsAvailable()) return false;
    const n = await import('expo-notifications');
    if (Platform.OS === 'android') await n.setNotificationChannelAsync('voice-notes', { name: 'DJ Planner', importance: n.AndroidImportance.DEFAULT });
    const status = await n.getPermissionsAsync();
    if (status.granted || status.ios?.status === n.IosAuthorizationStatus.PROVISIONAL) return true;
    return (await n.requestPermissionsAsync()).granted;
}

interface DeviceReminder {
    identifier: string; at: Date; title: string; body: string; data: Record<string, string>;
}
let queue = Promise.resolve();
// One serialized queue and one shared budget for both reminder types.
function reconcile(prefixes: string[], desired: DeviceReminder[], userId?: string, preservePrefixes: string[] = []) {
    const next = queue.catch(() => {}).then(async () => {
        if (!voiceNotificationsAvailable()) return;
        const n = await import('expo-notifications');
        if (Platform.OS === 'android') await n.setNotificationChannelAsync('voice-notes', { name: 'DJ Planner', importance: n.AndroidImportance.DEFAULT });
        const all = await n.getAllScheduledNotificationsAsync();
        const managed = all.filter(x => prefixes.some(prefix => x.identifier.startsWith(prefix)));
        const held: DeviceReminder[] = [];
        for (const old of managed) {
            const data = old.content.data;
            if (!preservePrefixes.some(prefix => old.identifier.startsWith(prefix)) || data?.notificationUserId !== userId) continue;
            const date = data?.reminderAt || data?.voiceAt;
            if (typeof date !== 'string') continue;
            const at = new Date(date);
            if (at.getTime() > Date.now()) held.push({ identifier: old.identifier, at,
                title: old.content.title || '', body: old.content.body || '', data: data as Record<string, string> });
        }
        // iOS has a finite local notification budget. Leave room for unrelated alerts.
        const capacity = Math.max(0, 60 - (all.length - managed.length));
        const wanted = [...desired, ...held].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, capacity);
        const ids = new Set(wanted.map(item => item.identifier));
        for (const old of managed) if (!ids.has(old.identifier)) await n.cancelScheduledNotificationAsync(old.identifier);
        for (const item of wanted) {
            const old = managed.find(x => x.identifier === item.identifier);
            const oldAt = old?.content.data?.reminderAt || old?.content.data?.voiceAt;
            if (oldAt === item.at.toISOString() && old?.content.body === item.body && old.content.title === item.title &&
                (!userId || old.content.data?.notificationUserId === userId)) continue;
            await n.cancelScheduledNotificationAsync(item.identifier);
            await n.scheduleNotificationAsync({ identifier: item.identifier,
                content: { title: item.title, body: item.body, sound: 'default', data: item.data },
                trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: item.at, channelId: 'voice-notes' },
            });
        }
    });
    queue = next.catch(() => {});
    return next;
}

export function syncVoiceNotifications(rows: VoiceSchedule[], title: string, body: (venue: string) => string) {
    return reconcile([VOICE_NOTIFICATION_PREFIX], voiceReminderPlan(rows).map(item => ({ ...item, title, body: body(item.venue),
        data: { voiceSessionId: item.session_id, voiceAt: item.at.toISOString() } })));
}

export interface SessionReminderText {
    voiceTitle: string; voiceBody: (venue: string) => string;
    reviewTitle: (venue: string) => string; reviewBody: string;
}
// null means a request has not completed: keep that account's known alerts on network failure.
export function syncSessionNotifications(voiceRows: VoiceSchedule[] | null, reviewRows: ReviewSession[] | null,
    userId: string | undefined, text: SessionReminderText) {
    const desired: DeviceReminder[] = [];
    const preserve: string[] = [];
    if (userId) {
        if (voiceRows === null) preserve.push(VOICE_NOTIFICATION_PREFIX);
        else for (const item of voiceReminderPlan(voiceRows)) desired.push({ ...item, title: text.voiceTitle, body: text.voiceBody(item.venue),
            data: { voiceSessionId: item.session_id, reminderAt: item.at.toISOString(), notificationUserId: userId } });
        if (reviewRows === null) preserve.push(POST_SESSION_NOTIFICATION_PREFIX);
        else for (const item of postSessionReminderPlan(reviewRows, userId)) desired.push({ ...item, title: text.reviewTitle(item.venue), body: text.reviewBody,
            data: { sessionReviewId: item.id, reminderAt: item.at.toISOString(), notificationUserId: userId } });
    }
    return reconcile([VOICE_NOTIFICATION_PREFIX, POST_SESSION_NOTIFICATION_PREFIX], desired, userId, preserve);
}
