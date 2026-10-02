import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import type { Session } from '../../types/session';
import { useTranslation } from '../../i18n/useTranslation';
import { useUpdateSessionMutation } from '../../hooks/useSessionsQuery';
import { sessionEarnings, sessionBalance } from '../../utils/sessionPlanning';
import { confirmAction } from '../../utils/confirmAction';

export function SessionPayments({ session }: { session: Session }) {
    const { t, currentLanguage } = useTranslation();
    const update = useUpdateSessionMutation();
    const [received, setReceived] = useState(String(session.amount_paid || 0));
    useEffect(() => { setReceived(String(session.amount_paid || 0)); }, [session.id, session.amount_paid]);
    if (session.earning_type === 'free' || session.status === 'cancelled') return null;
    const total = Math.round(sessionEarnings(session) * 100) / 100;
    const money = (value: number) => `${value.toLocaleString(currentLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${session.currency || '€'}`;
    const save = async (amount: number) => {
        if (!Number.isFinite(amount) || amount < 0 || amount > total) {
            Alert.alert(t('error'), t('payment_invalid', { total: money(total) }));
            return;
        }
        try {
            await update.mutateAsync({ sessionId: session.id, input: { amount_paid: Math.round(amount * 100) / 100 } });
            Alert.alert(t('success'), t('payment_saved'));
        } catch {
            Alert.alert(t('error'), t('error_saving_session'));
        }
    };
    const markPaid = async () => {
        if (await confirmAction(t('payment_mark_paid'), t('payment_confirm_paid', { amount: money(total) }), t('cancel'), t('payment_mark_paid'))) await save(total);
    };
    return (
        <View className="mb-6 rounded-3xl bg-gray-50 dark:bg-gray-900 p-5">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">{t('payments_overview')}</Text>
            <View className="flex-row justify-between mt-3 mb-4 gap-3">
                <View className="flex-1"><Text className="text-xs text-gray-500 dark:text-gray-400">{t('payment_received')}</Text><Text className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{money(Number(session.amount_paid || 0))}</Text></View>
                <View className="flex-1"><Text className="text-xs text-gray-500 dark:text-gray-400">{t('payment_outstanding')}</Text><Text className="text-lg font-bold text-gray-900 dark:text-white">{money(sessionBalance(session))}</Text></View>
            </View>
            <Text className="text-sm text-gray-600 dark:text-gray-300 mb-2">{t('payment_total_received')}</Text>
            <View className="flex-row items-center gap-3">
                <TextInput value={received} onChangeText={setReceived} keyboardType="decimal-pad" editable={!update.isPending} accessibilityLabel={t('payment_total_received')} className="flex-1 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white" />
                <TouchableOpacity disabled={update.isPending} accessibilityRole="button" onPress={() => save(received.trim() ? Number(received.replace(',', '.')) : NaN)} className="bg-gray-900 dark:bg-blue-600 rounded-xl px-4 py-3" style={{ opacity: update.isPending ? 0.5 : 1 }}>
                    <Text className="text-white font-bold">{t('save_payment')}</Text>
                </TouchableOpacity>
            </View>
            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('payment_deposit_hint')}</Text>
            {sessionBalance(session) > 0 && <TouchableOpacity disabled={update.isPending} accessibilityRole="button" onPress={markPaid} className="mt-4 py-3 items-center bg-emerald-100 dark:bg-emerald-900/30 rounded-xl"><Text className="font-bold text-emerald-800 dark:text-emerald-300">{t('payment_mark_paid')}</Text></TouchableOpacity>}
        </View>
    );
}
