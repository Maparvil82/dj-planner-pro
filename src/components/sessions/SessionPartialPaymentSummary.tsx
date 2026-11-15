import { Text, View } from 'react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';
import darkPalette from '../../theme/darkPalette.json';
import { PARTIAL_PAYMENT_COLORS } from '../../theme/paymentColors';
import { sessionBalance, sessionEarnings, sessionPaymentState } from '../../utils/sessionPlanning';
import type { Session } from '../../types/session';

export function SessionPartialPaymentSummary({ session, showDivider = true }: { session: Session; showDivider?: boolean }) {
    const { t, formatMoney } = useTranslation();
    const { activeTheme } = useTheme();
    if (sessionPaymentState(session) !== 'partial') return null;
    const dark = activeTheme === 'dark';
    const text = dark ? darkPalette.onSurface : '#202538';
    const orange = PARTIAL_PAYMENT_COLORS[dark ? 'dark' : 'light'];
    const format = (value: number) => formatMoney(value, session.currency || '€');
    const amounts = [
        { label: t('paymentState.total'), amount: sessionEarnings(session) },
        { label: t('payment_received'), amount: Number(session.amount_paid || 0) },
        { label: t('paymentState.remaining'), amount: sessionBalance(session) },
    ];
    return <View testID="session-partial-payment" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: showDivider ? 12 : 0, borderTopWidth: showDivider ? 1 : 0, borderTopColor: dark ? darkPalette.border : '#e9ecf3' }}>
        {amounts.map((item, index) => <View key={item.label} style={{ flex: 1, minWidth: 70, gap: 4 }}>
            <Text style={{ color: dark ? text : '#6d7588', fontSize: 11, lineHeight: 15 }}>{item.label}</Text>
            <Text style={{ color: index === 2 ? orange : text, fontSize: 14, lineHeight: 19, fontWeight: '800' }}>{format(item.amount)}</Text>
        </View>)}
    </View>;
}
