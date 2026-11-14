import { Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ToolsLayout } from '../src/components/sessionTools/ToolsLayout';
import { CurrencyPicker } from '../src/components/ui/CurrencyPicker';
import { useCurrencyPreference } from '../src/store/useCurrencyPreference';
import { useAuthStore } from '../src/store/useAuthStore';
import { useTranslation } from '../src/i18n/useTranslation';
import { useCommunityColors } from '../src/components/community/communityColors';
export default function CurrencySettings() {
    const { t, defaultCurrency } = useTranslation();
    const c = useCommunityColors();
    const router = useRouter();
    const userId = useAuthStore(state => state.session?.user.id || 'guest');
    const setCurrency = useCurrencyPreference(state => state.setCurrency);
    return <ToolsLayout title={t('currencySettings.title')} onBack={() => router.back()}>
        <Text style={{ color: c.muted, lineHeight: 22 }}>{t('currencySettings.hint')}</Text>
        <CurrencyPicker value={defaultCurrency} onChange={value => setCurrency(userId, value)} />
        <TouchableOpacity accessibilityRole="button" onPress={() => setCurrency(userId, null)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.accent }}>{t('currencySettings.automatic')}</Text></TouchableOpacity>
    </ToolsLayout>;
}
