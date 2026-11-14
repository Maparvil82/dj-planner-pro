import { useDarkPalette } from '../../contexts/ThemeContext';
import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import type { Session } from '../../types/session';
import { useTranslation } from '../../i18n/useTranslation';
import { useUpdateSessionMutation } from '../../hooks/useSessionsQuery';
import {
    sessionEarnings,
    sessionBalance,
    sessionDuration,
} from '../../utils/sessionPlanning';
import { confirmAction } from '../../utils/confirmAction';
import { useTheme } from '../../contexts/ThemeContext';

export function SessionPayments({ session, embedded = false }: { session: Session; embedded?: boolean }) {
    const darkPalette = useDarkPalette();
    const { t, formatMoney, numberLocale } = useTranslation();
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    const update = useUpdateSessionMutation();
    const [received, setReceived] = useState(String(session.amount_paid || 0));
    useEffect(() => {
        setReceived(String(session.amount_paid || 0));
    }, [session.id, session.amount_paid]);
    const total = Math.round(sessionEarnings(session) * 100) / 100;
    const unsettled =
        session.earning_type === 'agreement' && !session.fee_agreement?.settled;
    const cancelled = session.status === 'cancelled';
    const money = (value: number) =>
        formatMoney(value, session.currency || '€');
    const save = async (amount: number) => {
        if (!Number.isFinite(amount) || amount < 0 || amount > 9999999999.99) {
            Alert.alert(t('error'), t('paymentState.invalid'));
            return;
        }
        try {
            await update.mutateAsync({
                sessionId: session.id,
                input: { amount_paid: Math.round(amount * 100) / 100 },
            });
        } catch {
            Alert.alert(t('error'), t('error_saving_session'));
        }
    };
    if (session.is_guest) return null;
    const fg = dark ? darkPalette.text : '#222438';
    const muted = dark ? darkPalette.muted : '#737b8d';
    const button = {
        borderRadius: 14,
        paddingVertical: 13,
        paddingHorizontal: 16,
        alignItems: 'center' as const,
        opacity: update.isPending ? 0.5 : 1,
    };
    return (
        <View
            style={{
                marginBottom: embedded ? 0 : 24,
                borderRadius: 22,
                borderWidth: embedded || dark ? 0 : 1,
                borderColor: dark ? darkPalette.border : '#e9eaf2',
                backgroundColor: dark ? darkPalette.surface : '#fff',
                padding: embedded ? 0 : 20,
                gap: 16,
            }}
        >
            {!embedded && <Text style={[{ fontSize: 17, fontWeight: '800', color: fg }, dark && { color: darkPalette.onSurface }]}>
                {t('paymentState.title')}
            </Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                {[
                    [t('paymentState.agreed'), total],
                    [t('payment_received'), Number(session.amount_paid || 0)],
                    ...(!cancelled
                        ? [[t('payment_outstanding'), sessionBalance(session)]]
                        : []),
                ].map(([label, value]) => (
                    <View key={String(label)} style={{ flexGrow: 1 }}>
                        <Text
                            style={[{
                                fontSize: 11,
                                color: muted,
                                marginBottom: 5,
                            }, dark && { color: darkPalette.onSurface }]}
                        >
                            {String(label)}
                        </Text>
                        <Text
                            style={[{
                                fontSize: 18,
                                fontWeight: '800',
                                color: fg,
                            }, dark && { color: darkPalette.onSurface }]}
                        >
                            {unsettled && label !== t('payment_received')
                                ? '—'
                                : money(Number(value))}
                        </Text>
                    </View>
                ))}
            </View>
            <Text style={[{ color: muted, fontSize: 12, lineHeight: 18 }, dark && { color: darkPalette.onSurface }]}>
                {session.earning_type === 'agreement'
                    ? t(unsettled ? 'agreement.pending' : 'agreement.settled')
                    : session.earning_type === 'hourly'
                      ? t('calc_hourly', {
                            amount: money(session.earning_amount),
                            hours: new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 }).format(sessionDuration(session)),
                        })
                      : t(
                            session.earning_type === 'free'
                                ? 'calc_free'
                                : 'calc_fixed',
                        )}
            </Text>
            {cancelled && (
                <Text style={[{ fontSize: 12, lineHeight: 18, color: muted }, dark && { color: darkPalette.onSurface }]}>
                    {t('paymentState.cancelledMoney')}
                </Text>
            )}
            {(total > 0 || Number(session.amount_paid) > 0) && (
                <>
                    <Text style={[{ fontSize: 12, color: muted }, dark && { color: darkPalette.onSurface }]}>
                        {t('paymentState.receivedHint')}
                    </Text>
                    <TextInput
                        value={received}
                        onChangeText={setReceived}
                        keyboardType="decimal-pad"
                        editable={!update.isPending}
                        accessibilityLabel={t('payment_total_received')}
                        style={{
                            borderWidth: 1,
                            borderColor: dark ? darkPalette.raised : '#e5e7ef',
                            borderRadius: 13,
                            padding: 14,
                            fontSize: 16,
                            color: fg,
                        }}
                    />
                    <TouchableOpacity
                        disabled={update.isPending}
                        accessibilityRole="button"
                        onPress={() =>
                            save(
                                /^\d+(?:[.,]\d{1,2})?$/.test(received.trim())
                                    ? Number(received.replace(',', '.'))
                                    : NaN,
                            )
                        }
                        style={{
                            ...button,
                            backgroundColor: dark ? darkPalette.tint : '#f0edff',
                        }}
                    >
                        <Text
                            style={{
                                color: dark ? darkPalette.primary : '#6954df',
                                fontWeight: '700',
                            }}
                        >
                            {t('paymentState.save')}
                        </Text>
                    </TouchableOpacity>
                    {!cancelled && sessionBalance(session) > 0 && (
                        <TouchableOpacity
                            disabled={update.isPending}
                            accessibilityRole="button"
                            onPress={async () => {
                                if (
                                    await confirmAction(
                                        t('payment_mark_paid'),
                                        t('payment_confirm_paid', {
                                            amount: money(total),
                                        }),
                                        t('cancel'),
                                        t('payment_mark_paid'),
                                    )
                                )
                                    await save(total);
                            }}
                            style={{ ...button, backgroundColor: dark ? darkPalette.primary : '#6954df' }}
                        >
                            <Text style={{ color: dark ? darkPalette.onPrimary : '#fff', fontWeight: '700' }}>
                                {t('payment_mark_paid')}
                            </Text>
                        </TouchableOpacity>
                    )}
                </>
            )}

        </View>
    );
}
