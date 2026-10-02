import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { X } from 'lucide-react-native';
import { useTranslation } from '../src/i18n/useTranslation';
import { useSubscription } from '../src/hooks/useSubscription';
import { useAuthStore } from '../src/store/useAuthStore';
import {
    CommunityButton,
    useCommunityColors,
} from '../src/components/community/CommunityUI';
import { syncSubscriptionAccess } from '../src/services/subscriptionAccess';
import { showError } from '../src/utils/showError';
import { FREE_SESSION_LIMIT } from '../src/utils/sessionLimit';

export default function PaywallScreen() {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const router = useRouter();
    const client = useQueryClient();
    const session = useAuthStore((state) => state.session);
    const params = useLocalSearchParams<{
        reason?: string;
        count?: string;
        requested?: string;
    }>();
    const {
        purchaseMonthly,
        purchaseAnnual,
        restorePurchases,
        isLoading,
        isPro,
        monthlyPackage,
        annualPackage,
    } = useSubscription();
    const [selected, setSelected] = useState<'monthly' | 'yearly'>('yearly');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [verified, setVerified] = useState(false);
    const pkg = selected === 'monthly' ? monthlyPackage : annualPackage;
    const available = Platform.OS === 'ios' && !!pkg;
    const close = () =>
        router.canGoBack() ? router.back() : router.replace('/');
    const verify = async () => {
        const usage = await syncSubscriptionAccess();
        if (!usage.isPro) throw new Error('billing.verificationError');
        await client.invalidateQueries({ queryKey: ['session-usage'] });
        setVerified(true);
        setMessage(t('billing.activated'));
    };
    const act = async (restore = false) => {
        if (busy || isLoading) return;
        setBusy(true);
        setMessage('');
        try {
            const success = restore
                ? await restorePurchases()
                : isPro ||
                  (await (selected === 'monthly'
                      ? purchaseMonthly()
                      : purchaseAnnual()));
            if (success) await verify();
            else if (restore) setMessage(t('billing.noPurchases'));
        } catch (error) {
            const key =
                error instanceof Error && error.message.startsWith('billing.')
                    ? error.message
                    : 'billing.purchaseError';
            showError(t('error'), t(key));
        } finally {
            setBusy(false);
        }
    };
    if (!session) return <Redirect href="/(auth)/login" />;
    const saving =
        monthlyPackage && annualPackage
            ? Math.round(
                  (1 -
                      annualPackage.product.price /
                          (monthlyPackage.product.price * 12)) *
                      100,
              )
            : 0;
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
            <View
                style={{
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    alignItems: 'flex-end',
                }}
            >
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('close')}
                    onPress={close}
                    disabled={busy || isLoading}
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 16,
                        backgroundColor: c.tint,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <X size={22} color={c.fg} />
                </TouchableOpacity>
            </View>
            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingBottom: 40,
                    gap: 20,
                    width: '100%',
                    maxWidth: 600,
                    alignSelf: 'center',
                }}
            >
                <View style={{ gap: 10 }}>
                    <Text
                        style={{
                            color: c.accent,
                            fontWeight: '800',
                            fontSize: 12,
                            letterSpacing: 1,
                        }}
                    >
                        DJ PLANNER PRO
                    </Text>
                    <Text
                        style={{
                            color: c.fg,
                            fontSize: 32,
                            fontWeight: '900',
                            letterSpacing: -1,
                        }}
                    >
                        {t(
                            params.reason === 'session-limit'
                                ? 'billing.limitTitle'
                                : 'billing.title',
                        )}
                    </Text>
                    <Text
                        style={{ color: c.muted, fontSize: 15, lineHeight: 23 }}
                    >
                        {t('billing.intro', { limit: FREE_SESSION_LIMIT })}
                    </Text>
                </View>
                {params.reason === 'session-limit' && (
                    <View
                        style={{
                            backgroundColor: c.tint,
                            borderRadius: 20,
                            padding: 18,
                            gap: 7,
                        }}
                    >
                        <Text
                            style={{
                                color: c.accent,
                                fontSize: 17,
                                fontWeight: '800',
                            }}
                        >
                            {t('billing.limitUsage', {
                                count: Number(params.count) || 0,
                                limit: FREE_SESSION_LIMIT,
                            })}
                        </Text>
                        <Text
                            style={{
                                color: c.muted,
                                fontSize: 13,
                                lineHeight: 20,
                            }}
                        >
                            {t('billing.limitHint', {
                                requested: Number(params.requested) || 1,
                            })}
                        </Text>
                    </View>
                )}
                <View
                    style={{
                        backgroundColor: c.card,
                        borderColor: c.border,
                        borderWidth: 1,
                        borderRadius: 24,
                        padding: 20,
                        gap: 10,
                    }}
                >
                    <Text
                        style={{ color: c.fg, fontWeight: '800', fontSize: 20 }}
                    >
                        {t('billing.unlimited')}
                    </Text>
                    <Text
                        style={{ color: c.muted, lineHeight: 21, fontSize: 14 }}
                    >
                        {t('billing.benefit')}
                    </Text>
                </View>
                {(['monthly', 'yearly'] as const).map((plan) => {
                    const item =
                        plan === 'monthly' ? monthlyPackage : annualPackage;
                    return (
                        <TouchableOpacity
                            key={plan}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: selected === plan }}
                            disabled={busy || isLoading}
                            onPress={() => setSelected(plan)}
                            style={{
                                backgroundColor:
                                    selected === plan ? c.tint : c.card,
                                borderColor:
                                    selected === plan ? c.accent : c.border,
                                borderWidth: 2,
                                borderRadius: 22,
                                padding: 20,
                                gap: 8,
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    gap: 10,
                                }}
                            >
                                <Text
                                    style={{
                                        color: c.fg,
                                        fontWeight: '800',
                                        fontSize: 17,
                                    }}
                                >
                                    {t(
                                        plan === 'monthly'
                                            ? 'plan_monthly'
                                            : 'plan_yearly',
                                    )}
                                </Text>
                                {plan === 'yearly' && saving > 0 && (
                                    <Text
                                        style={{
                                            color: c.accent,
                                            fontWeight: '800',
                                        }}
                                    >
                                        {t('billing.saving', {
                                            percent: saving,
                                        })}
                                    </Text>
                                )}
                            </View>
                            <Text
                                style={{
                                    color: c.fg,
                                    fontWeight: '900',
                                    fontSize: 23,
                                }}
                            >
                                {item
                                    ? `${item.product.priceString} ${t(plan === 'monthly' ? 'billing.perMonth' : 'billing.perYear')}`
                                    : t('billing.priceUnavailable')}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
                {!!message && (
                    <Text
                        accessibilityRole="alert"
                        style={{
                            color: verified ? c.accent : c.muted,
                            fontSize: 14,
                            lineHeight: 21,
                        }}
                    >
                        {message}
                    </Text>
                )}
                {!available && !isLoading && !isPro && (
                    <Text
                        style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}
                    >
                        {t(
                            Platform.OS === 'ios'
                                ? 'billing.storeUnavailable'
                                : 'billing.platformUnavailable',
                        )}
                    </Text>
                )}
                <CommunityButton
                    label={t(
                        verified
                            ? 'billing.return'
                            : isPro
                              ? 'billing.verify'
                              : 'billing.subscribe',
                    )}
                    busy={busy || isLoading}
                    disabled={!verified && !isPro && !available}
                    onPress={verified ? close : () => void act()}
                />
                {!isPro && !verified && (
                    <CommunityButton
                        label={t('billing.stayFree')}
                        secondary
                        disabled={busy || isLoading}
                        onPress={close}
                    />
                )}
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>
                    {t('billing.renewal')}
                </Text>
                <TouchableOpacity
                    accessibilityRole="button"
                    disabled={busy || isLoading || Platform.OS !== 'ios'}
                    onPress={() => void act(true)}
                >
                    <Text
                        style={{
                            color: c.accent,
                            textAlign: 'center',
                            fontWeight: '700',
                            opacity: Platform.OS === 'ios' ? 1 : 0.5,
                        }}
                    >
                        {t('restore_purchases')}
                    </Text>
                </TouchableOpacity>
                <View
                    style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: 18,
                    }}
                >
                    <TouchableOpacity
                        onPress={() =>
                            void Linking.openURL(t('terms_of_use_url'))
                        }
                    >
                        <Text
                            style={{
                                color: c.muted,
                                fontSize: 12,
                                textDecorationLine: 'underline',
                            }}
                        >
                            {t('terms_of_use')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() =>
                            void Linking.openURL(t('privacy_policy_url'))
                        }
                    >
                        <Text
                            style={{
                                color: c.muted,
                                fontSize: 12,
                                textDecorationLine: 'underline',
                            }}
                        >
                            {t('privacy_policy')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
