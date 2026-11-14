import { View, Text, Switch } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from '../i18n/useTranslation';
import { useCommunityColors } from '../components/community/communityColors';
import { useAnalyticsConsent } from './consent';
import { analyticsConfigured } from './index';

export function AnalyticsPreferences() {
    const userId = useAuthStore((state) => state.session?.user.id);
    const { choices, choose, hydrated } = useAnalyticsConsent();
    const { t } = useTranslation();
    const c = useCommunityColors();
    if (!userId || !analyticsConfigured || !hydrated) return null;
    return <View style={{ padding: 16, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ flex: 1, color: c.fg, fontSize: 15 }}>{t('analytics.title')}</Text>
            <Switch accessibilityLabel={t('analytics.title')} value={choices[userId] === true} onValueChange={(value) => choose(userId, value)} />
        </View>
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{t('analytics.description')}</Text>
    </View>;
}
