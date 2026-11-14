import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from '../i18n/useTranslation';
import { useAnalyticsConsent } from './consent';
import { analyticsConfigured, configureAnalytics, captureAnalytics } from './index';

export function AnalyticsSync() {
    const userId = useAuthStore((state) => state.session?.user.id);
    const initialized = useAuthStore((state) => state.initialized);
    const { choices, hydrated, choose } = useAnalyticsConsent();
    const { t } = useTranslation();
    const consent = userId ? choices[userId] : undefined;
    useEffect(() => {
        void configureAnalytics(userId, hydrated && consent === true);
        return () => { void configureAnalytics(); };
    }, [userId, hydrated, consent]);
    useEffect(() => {
        if (!analyticsConfigured || !initialized || !hydrated || !userId || consent !== undefined) return;
        Alert.alert(t('analytics.title'), t('analytics.description'), [
            { text: t('analytics.decline'), onPress: () => choose(userId, false), style: 'cancel' },
            { text: t('analytics.accept'), onPress: () => choose(userId, true) },
        ], { cancelable: false });
    }, [initialized, hydrated, userId, consent, choose, t]);
    useEffect(() => {
        let previous = AppState.currentState;
        const listener = AppState.addEventListener('change', (state) => {
            if (state === 'active' && previous !== 'active') captureAnalytics('app_opened');
            previous = state;
        });
        return () => listener.remove();
    }, []);
    return null;
}
