import { sessionDisplayTitle } from '../../utils/sessionNaming';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../i18n/useTranslation';
import { moneyCurrencyCode } from '../../i18n/money';
import type { Session } from '../../types/session';
import { sessionBalance, sessionRange } from '../../utils/sessionPlanning';

export function PaymentOverview({ sessions }: { sessions: Session[] }) {
    const { t, formatMoney } = useTranslation();
    const router = useRouter();
    const now = new Date();
    const totals: Record<string, { paid: number; pending: number }> = {};
    const outstanding = sessions.filter(session => session.status !== 'cancelled' && session.status !== 'pending' && session.earning_type !== 'free');
    outstanding.forEach(session => {
        const currency = moneyCurrencyCode(session.currency || 'EUR');
        totals[currency] ||= { paid: 0, pending: 0 };
        totals[currency].paid += Number(session.amount_paid || 0);
        totals[currency].pending += sessionBalance(session);
    });
    const unpaid = outstanding.filter(session => sessionBalance(session) > 0 && sessionRange(session).end <= now)
        .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    const money = (value: number, currency: string) => formatMoney(value, currency);
    return (
        <View className="mb-6 mx-2 rounded-3xl bg-white dark:bg-djDark-surface border border-gray-100 dark:border-djDark-border p-5 dark:border-0">
            <Text className="text-lg font-bold text-gray-900  dark:text-djDark-onSurface">{t('payments_overview')}</Text>
            <Text className="text-xs text-gray-500  mt-1 mb-4 dark:text-djDark-onSurface">{t('payments_overview_hint')}</Text>
            {Object.entries(totals).map(([currency, total]) => (
                <View key={currency} className="flex-row gap-4 mb-3">
                    <View className="flex-1">
                        <Text className="text-xs text-gray-500  dark:text-djDark-onSurface">{t('payment_received')}</Text>
                        <Text className="text-lg font-bold text-emerald-700  dark:text-djDark-onSurface">{money(total.paid, currency)}</Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-xs text-gray-500  dark:text-djDark-onSurface">{t('payment_outstanding')}</Text>
                        <Text className="text-lg font-bold text-gray-900  dark:text-djDark-onSurface">{money(total.pending, currency)}</Text>
                    </View>
                </View>
            ))}
            {Object.keys(totals).length === 0 && <Text className="text-sm text-gray-500  dark:text-djDark-onSurface">{t('payments_empty')}</Text>}
            {unpaid.length > 0 && (
                <View className="mt-2 border-t border-gray-100 dark:border-djDark-border pt-3">
                    <Text className="text-xs font-bold text-amber-700  mb-2 dark:text-djDark-onSurface">{t('payments_to_collect', { count: unpaid.length })}</Text>
                    {unpaid.slice(0, 3).map(session => (
                        <TouchableOpacity key={session.id} onPress={() => router.push(`/session/${session.id}`)} accessibilityRole="button" className="py-3 flex-row items-center gap-3">
                            <View className="flex-1">
                                <Text numberOfLines={1} className="font-semibold text-gray-900  dark:text-djDark-onSurface">{sessionDisplayTitle(session, t)}</Text>
                                <Text numberOfLines={1} className="text-xs text-gray-500  dark:text-djDark-onSurface">{session.venue} · {session.date}</Text>
                            </View>
                            <Text className="font-bold text-amber-700  dark:text-djDark-onSurface">{money(sessionBalance(session), session.currency || '€')} ›</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}
