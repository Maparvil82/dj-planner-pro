import PostHog, { PostHogPersistedProperty } from 'posthog-react-native';
import { useAnalyticsConsent } from './consent';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { safeProperties, type AnalyticsEvent } from './privacy';

const token = process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN;
const development = typeof __DEV__ !== 'undefined' && __DEV__;
export const analyticsConfigured = Boolean(token?.startsWith('phc_')) && (!development || process.env.EXPO_PUBLIC_POSTHOG_DEV_ENABLED === 'true');
let client: PostHog | undefined;
let owner: string | undefined;
let generation = 0;

export async function configureAnalytics(userId?: string, consent = false) {
    const revision = ++generation;
    owner = undefined;
    const previous = client;
    client = undefined;
    if (previous) {
        // Stop capture and discard queued events on logout, account change or withdrawal.
        void previous.optOut().catch(() => {});
        previous.setPersistedProperty(PostHogPersistedProperty.Queue, []);
        void previous.shutdown().catch(() => {});
    }
    if (!analyticsConfigured || !userId || !consent) return;
    try {
        const distinctId = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `djplanner-analytics-v1:${userId}`);
        if (revision !== generation || useAuthStore.getState().session?.user.id !== userId || useAnalyticsConsent.getState().choices[userId] !== true) return;
        const next = new PostHog(token!, {
            host: 'https://eu.i.posthog.com',
            persistence: 'memory',
            captureAppLifecycleEvents: false,
            enableSessionReplay: false,
            disableGeoip: true,
            disableSurveys: true,
            disableRemoteConfig: true,
            disableRemoteFeatureFlags: true,
            preloadFeatureFlags: false,
            customAppProperties: {},
            flushAt: 5,
            flushInterval: 10000,
            maxQueueSize: 100,
            before_send: (event) => {
                if (revision !== generation || useAuthStore.getState().session?.user.id !== userId || useAnalyticsConsent.getState().choices[userId] !== true) return null;
                const properties = safeProperties(event.event, event.properties);
                if (!properties) return null;
                return { event: event.event, uuid: event.uuid, timestamp: event.timestamp, properties: {
                    ...properties,
                    token: token!,
                    distinct_id: distinctId,
                    $process_person_profile: false,
                    $geoip_disable: true,
                    platform: Platform.OS,
                    environment: development ? 'development' : 'production',
                } };
            },
        });
        next.identify(distinctId);
        client = next;
        owner = userId;
        captureAnalytics('app_opened');
    } catch { /* Analytics must never interrupt the application. */ }
}

export function captureAnalytics(event: AnalyticsEvent, properties: Record<string, unknown> = {}, actorId = useAuthStore.getState().session?.user.id) {
    if (!client || !owner || useAnalyticsConsent.getState().choices[owner] !== true || owner !== actorId || owner !== useAuthStore.getState().session?.user.id) return false;
    const safe = safeProperties(event, properties);
    if (!safe) return false;
    try { client.capture(event, safe); return true; } catch { return false; }
}
