import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../i18n/useTranslation';
import type { Session } from '../../types/session';
import { sessionBalance, sessionRange } from '../../utils/sessionPlanning';

export function PaymentOverview({ sessions }: { sessions: Session[] }) {
    const { t, currentLanguage } = useTranslation();
    const router = useRouter();
    const now = new Date();
    const totals: Record<string, { paid: number; pending: number }> = {};
    const outstanding = sessions.filter(session => session.status !== 'cancelled' && session.status !== 'pending' && session.earning_type !== 'free');
    outstanding.forEach(session => {
        const currency = session.currency || '€';
        totals[currency] ||= { paid: 0, pending: 0 };
        totals[currency].paid += Number(session.amount_paid || 0);
        totals[currency].pending += sessionBalance(session);
    });
    const unpaid = outstanding.filter(session => sessionBalance(session) > 0 && sessionRange(session).end <= now)
        .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    const money = (value: number, currency: string) => `${value.toLocaleString(currentLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
    return (
        <View className="mb-6 mx-2 rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">{t('payments_overview')}</Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">{t('payments_overview_hint')}</Text>
            {Object.entries(totals).map(([currency, total]) => (
                <View key={currency} className="flex-row gap-4 mb-3">
                    <View className="flex-1">
                        <Text className="text-xs text-gray-500 dark:text-gray-400">{t('payment_received')}</Text>
                        <Text className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{money(total.paid, currency)}</Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-xs text-gray-500 dark:text-gray-400">{t('payment_outstanding')}</Text>
                        <Text className="text-lg font-bold text-gray-900 dark:text-white">{money(total.pending, currency)}</Text>
                    </View>
                </View>
            ))}
            {Object.keys(totals).length === 0 && <Text className="text-sm text-gray-500 dark:text-gray-400">{t('payments_empty')}</Text>}
            {unpaid.length > 0 && (
                <View className="mt-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                    <Text className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2">{t('payments_to_collect', { count: unpaid.length })}</Text>
                    {unpaid.slice(0, 3).map(session => (
                        <TouchableOpacity key={session.id} onPress={() => router.push(`/session/${session.id}`)} accessibilityRole="button" className="py-3 flex-row items-center gap-3">
                            <View className="flex-1">
                                <Text numberOfLines={1} className="font-semibold text-gray-900 dark:text-white">{session.title}</Text>
                                <Text numberOfLines={1} className="text-xs text-gray-500 dark:text-gray-400">{session.venue} · {session.date}</Text>
                            </View>
                            <Text className="font-bold text-amber-700 dark:text-amber-400">{money(sessionBalance(session), session.currency || '€')} ›</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}
