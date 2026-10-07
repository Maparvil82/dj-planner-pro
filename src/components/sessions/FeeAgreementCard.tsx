import { conditionalSummary } from '../../utils/conditionalPresentation';
import { FEATURES } from '../../config/features';
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionUsage } from '../../hooks/useSessionUsage';
import { useTranslation } from '../../i18n/useTranslation';
import { ConditionalAgreementEditor } from './ConditionalAgreementEditor';
import { FeeAgreementEditor } from './FeeAgreementEditor';
import { FeeAgreement, calculateFeeAgreement } from '../../utils/feeAgreement';
import { CommunityButton, useCommunityColors } from '../community/CommunityUI';
export function ProLabel() {
    const c = useCommunityColors();
    return (
        <Text
            style={{
                color: c.accent,
                backgroundColor: c.tint,
                fontSize: 10,
                fontWeight: '800',
                paddingHorizontal: 7,
                paddingVertical: 3,
                borderRadius: 6,
            }}
        >
            PRO
        </Text>
    );
}
export function FeeAgreementCard({
    value,
    onChange,
    currency,
    names = [],
    canSettle = false,
    onCurrency,
    conditional = false,
}: {
    value: FeeAgreement | null;
    onChange: (a: FeeAgreement) => void | Promise<unknown>;
    currency: string;
    names?: string[];
    canSettle?: boolean;
    onCurrency?: (s: string) => void;
    conditional?: boolean;
}) {
    const { t, currentLanguage } = useTranslation();
    const c = useCommunityColors();
    const router = useRouter();
    const usage = useSessionUsage();
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState(false);
    const [editorMode, setEditorMode] = useState<'terms' | 'actual'>('terms');
    const modern = conditional || value?.version === 2;
    const openEditor = async (mode: 'terms' | 'actual') => {
        setError(false);
        if (usage.data?.isPro && !usage.isError) {
            setEditorMode(mode);
            setEditing(true);
            return;
        }
        const verified = await usage.refetch();
        if (verified.isError) {
            setError(true);
            return;
        }
        if (verified.data?.isPro) {
            setEditorMode(mode);
            setEditing(true);
        } else router.push('/paywall?reason=conditional');
    };
    if (!FEATURES.feeAgreements && !conditional && value?.version !== 2)
        return null;
    let amount: number | null = null;
    try {
        if (value) amount = calculateFeeAgreement(value, value.settled).owner;
    } catch {}
    return (
        <View
            style={{
                backgroundColor: c.tint,
                padding: 18,
                borderRadius: 20,
                gap: 12,
                marginBottom: 16,
            }}
        >
            <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
                <Text style={{ color: c.fg, fontWeight: '800', fontSize: 17 }}>
                    {t(
                        conditional || value?.version === 2
                            ? 'conditional.title'
                            : 'agreement.title',
                    )}
                </Text>
                <ProLabel />
            </View>
            <Text style={{ color: c.muted, lineHeight: 21 }}>
                {t(
                    value?.settled
                        ? 'agreement.settled'
                        : value
                          ? 'agreement.pending'
                          : 'agreement.configureHint',
                )}
            </Text>
            {value?.version === 2 && (
                <Text style={{ color: c.fg, lineHeight: 23 }}>
                    {conditionalSummary(
                        value,
                        t,
                        (n) =>
                            `${new Intl.NumberFormat(currentLanguage, { maximumFractionDigits: 2 }).format(n)} ${currency}`,
                    )}
                </Text>
            )}
            {value?.version === 1 && (
                <Text style={{ color: c.fg, lineHeight: 21 }}>
                    {t('agreement.fixed')}: {value.fixed} {currency} ·{' '}
                    {value.perTicket} {currency} / {t('agreement.tickets')} ·{' '}
                    {value.entryPercent}% {t('agreement.entries')} ·{' '}
                    {value.barPercent}% {t('agreement.bar')}
                </Text>
            )}
            {amount !== null && (!modern || value?.settled) && (
                <Text
                    style={{ color: c.accent, fontWeight: '800', fontSize: 21 }}
                >
                    {new Intl.NumberFormat(currentLanguage, {
                        maximumFractionDigits: 2,
                    }).format(amount)}{' '}
                    {currency} ·{' '}
                    {t(
                        value?.settled
                            ? 'agreement.yourFee'
                            : 'agreement.estimate',
                    )}
                </Text>
            )}
            {onCurrency && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {['€', '$', '£'].map((symbol) => (
                        <Pressable
                            key={symbol}
                            accessibilityRole="radio"
                            accessibilityState={{
                                checked: currency === symbol,
                            }}
                            onPress={() => onCurrency(symbol)}
                            style={{
                                padding: 12,
                                borderRadius: 12,
                                backgroundColor:
                                    currency === symbol ? c.card : c.tint,
                            }}
                        >
                            <Text
                                style={{ color: c.accent, fontWeight: '800' }}
                            >
                                {symbol}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            )}
            {error && (
                <Text accessibilityRole="alert" style={{ color: '#dc4545' }}>
                    {t('error_saving_session')}
                </Text>
            )}
            <CommunityButton
                secondary
                label={t(
                    modern
                        ? value
                            ? 'conditionalFlow.editAgreement'
                            : 'conditionalFlow.defineAgreement'
                        : canSettle
                          ? 'agreement.calculate'
                          : value
                            ? 'agreement.edit'
                            : 'agreement.configure',
                )}
                onPress={() => void openEditor('terms')}
            />
            {modern && value && canSettle && (
                <CommunityButton
                    label={t(
                        value.settled
                            ? 'conditionalFlow.adjustResult'
                            : 'conditionalFlow.calculate',
                    )}
                    onPress={() => void openEditor('actual')}
                />
            )}
            {editing && (conditional || value?.version === 2) && (
                <ConditionalAgreementEditor
                    value={value?.version === 2 ? value : null}
                    names={names}
                    initialMode={editorMode}
                    currency={currency}
                    canSettle={canSettle}
                    onClose={() => setEditing(false)}
                    onSave={async (a) => {
                        await onChange(a);
                        setEditing(false);
                    }}
                />
            )}
            {editing && !conditional && value?.version !== 2 && (
                <FeeAgreementEditor
                    value={value}
                    names={names}
                    currency={currency}
                    canSettle={canSettle}
                    onClose={() => setEditing(false)}
                    onSave={async (a) => {
                        await onChange(a);
                        setEditing(false);
                    }}
                />
            )}
        </View>
    );
}
