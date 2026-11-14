import { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../i18n/useTranslation';
import { moneyCurrencyCode } from '../../i18n/money';
import { useCommunityColors } from '../community/communityColors';
export const CURRENCIES = ['EUR','USD','GBP','BRL','MXN','ARS','CLP','COP','PEN','CAD','CHF','JPY','AUD','NZD','CNY','INR','SEK','NOK','DKK','PLN','CZK'] as const;
export function CurrencyPicker({ value, onChange }: { value: string; onChange: (currency: string) => void }) {
    const [open, setOpen] = useState(false);
    const { t, numberLocale } = useTranslation();
    const c = useCommunityColors();
    const code = moneyCurrencyCode(value);
    const label = (currency: string) => `${currency} · ${new Intl.NumberFormat(numberLocale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(0).replace(/0/g, '').trim()}`;
    return <>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${t('currencySettings.choose')}: ${code}`} onPress={() => setOpen(true)} style={{ minHeight: 44, justifyContent: 'center', paddingVertical: 10 }}>
            <Text style={{ color: c.accent, fontSize: 14, fontWeight: '600' }}>{t('currencySettings.choose')} · {code} ›</Text>
        </TouchableOpacity>
        <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)} presentationStyle="pageSheet">
            <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
                <View style={{ padding: 20, gap: 12 }}>
                    <Text style={{ color: c.fg, fontSize: 18, fontWeight: '700' }}>{t('currencySettings.choose')}</Text>
                    <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(false)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.accent }}>{t('cancel')}</Text></TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}>
                    {[...new Set([code, ...CURRENCIES])].map(currency => <TouchableOpacity key={currency} accessibilityRole="radio" accessibilityState={{ checked: currency === code }} onPress={() => { onChange(currency); setOpen(false); }} style={{ paddingVertical: 16, borderBottomWidth: 1, borderColor: c.border }}>
                        <Text style={{ color: currency === code ? c.accent : c.fg, fontSize: 16 }}>{label(currency)}{currency === code ? ' ✓' : ''}</Text>
                    </TouchableOpacity>)}
                </ScrollView>
            </SafeAreaView>
        </Modal>
    </>;
}
