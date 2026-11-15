import { Platform } from 'react-native';
import { useSubscription } from '../../hooks/useSubscription';
import { subscriptionManagementUrl } from '../../utils/billingPresentation';
import { Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import * as Linking from 'expo-linking';
import { useTranslation } from '../../i18n/useTranslation';
import { useSessionUsage } from '../../hooks/useSessionUsage';
import { SessionFormSection } from '../sessions/SessionFormLayout';
import { CommunityButton, useCommunityColors } from '../community/CommunityUI';
export function SubscriptionPlan() {
    const { t, dateLocale } = useTranslation();
    const c = useCommunityColors();
    const router = useRouter();
    const usage = useSessionUsage();
    const { customerInfo } = useSubscription();
    useFocusEffect(
        useCallback(() => {
            void usage.refetch();
        }, [usage.refetch]),
    );
    return (
        <SessionFormSection title={t('billing.myPlan')} kind="account">
            {usage.data ? (
                <>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            gap: 12,
                        }}
                    >
                        <Text
                            style={{
                                color: c.fg,
                                fontSize: 20,
                                fontWeight: '900',
                            }}
                        >
                            {t(
                                usage.data.isPro
                                    ? 'billing.proPlan'
                                    : 'billing.freePlan',
                            )}
                        </Text>
                        <Text
                            style={{
                                color: c.accent,
                                fontSize: 14,
                                fontWeight: '800',
                            }}
                        >
                            {t(
                                usage.data.isPro
                                    ? 'billing.proUsage'
                                    : 'billing.limitUsage',
                                {
                                    count: usage.data.count,
                                    limit: usage.data.limit,
                                },
                            )}
                        </Text>
                    </View>
                    {!usage.data.isPro && (
                        <View
                            style={{
                                height: 5,
                                backgroundColor: c.tint,
                                borderRadius: 3,
                                overflow: 'hidden',
                            }}
                        >
                            <View
                                style={{
                                    height: 5,
                                    width: `${Math.min(100, (usage.data.count / usage.data.limit) * 100)}%`,
                                    backgroundColor: c.accent,
                                }}
                            />
                        </View>
                    )}
                    {usage.data.trial && usage.data.trial.status !== 'available' && <Text testID="account-trial-status" style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>{t(usage.data.trial.status === 'active' ? 'trial.activeUntil' : 'trial.expired', { date: usage.data.trial.expiresAt ? new Date(usage.data.trial.expiresAt).toLocaleDateString(dateLocale) : '' })} {t('trial.noRenewal')}</Text>}
                    <Text
                        style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}
                    >
                        {t(
                            usage.data.isPro
                                ? 'billing.proHint'
                                : 'billing.countHint',
                        )}
                    </Text>
                    <CommunityButton
                        secondary
                        label={t(
                            usage.data.paidPro
                                ? 'billing.manage'
                                : 'billing.seePro',
                        )}
                        onPress={() =>
                            usage.data?.paidPro
                                ? void Linking.openURL(
                                      subscriptionManagementUrl(Platform.OS, customerInfo?.managementURL),
                                  )
                                : router.push('/paywall')
                        }
                    />
                </>
            ) : (
                <>
                    <Text style={{ color: c.muted }}>
                        {t(usage.isError ? 'billing.usageError' : 'loading')}
                    </Text>
                    {usage.isError && (
                        <CommunityButton
                            secondary
                            label={t('retry')}
                            onPress={() => void usage.refetch()}
                        />
                    )}
                </>
            )}
        </SessionFormSection>
    );
}
