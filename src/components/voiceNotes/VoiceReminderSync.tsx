import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/useAuthStore';
import { useSessionUsage } from '../../hooks/useSessionUsage';
import { useTranslation } from '../../i18n/useTranslation';
import { voiceNotes } from '../../services/voiceNotes';
import { listSessionsForReview } from '../../services/postSessionReminders';
import { requestVoiceNotifications, syncSessionNotifications, voiceNotificationsAvailable } from '../../services/voiceNotifications';
import { postSessionReminderPlan, sessionNotificationTarget } from '../../utils/postSessionReminders';

export function VoiceReminderSync() {
    const userId = useAuthStore(s => s.session?.user.id);
    const usage = useSessionUsage();
    const { t } = useTranslation();
    const router = useRouter();
    const client = useQueryClient();
    const native = voiceNotificationsAvailable();
    const schedule = useQuery({ queryKey: ['voice-schedule', userId], enabled: !!userId && usage.data?.isPro === true,
        queryFn: () => voiceNotes.schedule(), refetchInterval: 60000, retry: 1 });
    const reviews = useQuery({ queryKey: ['session-review-schedule', userId], enabled: !!userId && native,
        queryFn: () => listSessionsForReview(userId!), refetchInterval: 60000, retry: 1 });
    useEffect(() => {
        return client.getQueryCache().subscribe(event => {
            if (event.type !== 'updated' || event.action.type !== 'invalidate') return;
            const key = String(event.query.queryKey[0]);
            if (['sessions','session-usage','voice-notes'].includes(key)) void client.invalidateQueries({ queryKey: ['voice-schedule'] });
            if (['sessions','session'].includes(key)) void client.invalidateQueries({ queryKey: ['session-review-schedule'] });
        });
    }, [client]);
    useEffect(() => {
        const sub = AppState.addEventListener('change', state => {
            if (state === 'active' && userId) { void schedule.refetch(); if (native) void reviews.refetch(); }
        });
        return () => sub.remove();
    }, [schedule.refetch, reviews.refetch, native, userId]);
    useEffect(() => {
        let active = true;
        const sync = async () => {
            if (userId && reviews.data && postSessionReminderPlan(reviews.data, userId).length && native) {
                const n = await import('expo-notifications');
                const permission = await n.getPermissionsAsync();
                // Ask once through the OS, without repeatedly prompting after a refusal.
                if (permission.status === 'undetermined') await requestVoiceNotifications();
            }
            if (!active) return;
            const voiceRows = !userId || usage.data?.isPro === false ? [] : schedule.data || null;
            await syncSessionNotifications(voiceRows, userId ? reviews.data || null : [], userId, {
                voiceTitle: t('voiceNotes.notificationTitle'), voiceBody: venue => t('voiceNotes.notificationBody', { venue }),
                reviewTitle: venue => t('sessionReview.question', { venue }), reviewBody: t('sessionReview.notificationBody'),
            });
        };
        void sync().catch(() => {});
        return () => { active = false; };
    }, [userId, usage.data?.isPro, schedule.data, reviews.data, native, t]);
    useEffect(() => {
        if (!native) return;
        let active = true;
        let remove: (() => void) | undefined;
        const seen = new Set<string>();
        const open = (response: import('expo-notifications').NotificationResponse | null) => {
            const target = sessionNotificationTarget(response?.notification.request.content.data, userId);
            if (!active || !target || !response) return false;
            const key = `${response.notification.request.identifier}:${response.notification.date}:${response.actionIdentifier}`;
            if (seen.has(key)) return false;
            seen.add(key);
            router.push(target);
            return true;
        };
        void import('expo-notifications').then(async n => {
            if (!active) return;
            n.setNotificationHandler({ handleNotification: async notification => {
                const own = !!sessionNotificationTarget(notification.request.content.data, userId);
                return { shouldShowBanner: own, shouldShowList: own, shouldPlaySound: false, shouldSetBadge: false };
            } });
            const listener = n.addNotificationResponseReceivedListener(response => {
                if (open(response)) void n.clearLastNotificationResponseAsync();
            });
            remove = () => listener.remove();
            if (open(await n.getLastNotificationResponseAsync())) await n.clearLastNotificationResponseAsync();
        }).catch(() => {});
        return () => { active = false; remove?.(); };
    }, [userId, router, native]);
    return null;
}
