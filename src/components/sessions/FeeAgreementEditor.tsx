import { useRef, useState } from 'react';
import {
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    View,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../i18n/useTranslation';
import { CommunityButton, useCommunityColors } from '../community/CommunityUI';
import {
    FeeAgreement,
    FeeResults,
    emptyFeeAgreement,
    calculateFeeAgreement,
    validateFeeAgreement,
} from '../../utils/feeAgreement';
import { SessionFormHeader } from './SessionFormLayout';

export function FeeAgreementEditor({
    value,
    currency,
    canSettle = false,
    onSave,
    onClose,
    names = [],
}: {
    value: FeeAgreement | null;
    currency: string;
    canSettle?: boolean;
    onSave: (a: FeeAgreement) => void | Promise<unknown>;
    onClose: () => void;
    names?: string[];
}) {
    const { t, currentLanguage } = useTranslation();
    const c = useCommunityColors();
    const initial = value || {
        ...emptyFeeAgreement(),
        participants: [
            { name: '', share: 0 },
            ...names.map((name) => ({ name, share: 0 })),
        ],
    };
    const [agreement, setAgreement] = useState(initial);
    const [actual, setActual] = useState(initial.settled);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const money = (v: number) =>
        `${new Intl.NumberFormat(currentLanguage, { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v)} ${currency}`;
    const result = (() => {
        try {
            return calculateFeeAgreement(agreement, actual);
        } catch {
            return null;
        }
    })();
    const number = (
        key: string,
        label: string,
        value: number,
        change: (n: number) => void,
        integer = false,
    ) => (
        <View key={key} style={{ gap: 7 }}>
            <Text style={{ color: c.fg, fontSize: 13, fontWeight: '600' }}>
                {label}
            </Text>
            <TextInput
                accessibilityLabel={label}
                value={drafts[key] ?? (value ? String(value) : '')}
                keyboardType={integer ? 'number-pad' : 'decimal-pad'}
                placeholder="0"
                placeholderTextColor={c.muted}
                maxLength={12}
                onChangeText={(s) => {
                    if (
                        !/^\d*(?:[.,]\d{0,2})?$/.test(s) ||
                        (integer && /[.,]/.test(s))
                    )
                        return;
                    setDrafts((d) => ({ ...d, [key]: s }));
                    change(Number(s.replace(',', '.')) || 0);
                    setError('');
                }}
                style={{
                    backgroundColor: c.card,
                    color: c.fg,
                    minHeight: 50,
                    paddingHorizontal: 15,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: c.border,
                    fontSize: 16,
                }}
            />
        </View>
    );
    const term = (
        key:
            | 'fixed'
            | 'perTicket'
            | 'entryPercent'
            | 'barPercent'
            | 'minimum'
            | 'expenses',
    ) =>
        number(key, t(`agreement.${key}`), agreement[key], (n) =>
            setAgreement((a) => ({ ...a, [key]: n })),
        );
    const group = (title: string, children: React.ReactNode) => (
        <View
            style={{
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.border,
                padding: 20,
                borderRadius: 24,
                gap: 16,
            }}
        >
            <Text style={{ color: c.fg, fontWeight: '800', fontSize: 19 }}>
                {title}
            </Text>
            {children}
        </View>
    );
    const save = async () => {
        if (savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        try {
            validateFeeAgreement(agreement);
            if (actual) calculateFeeAgreement(agreement, true);
            await onSave({ ...agreement, settled: actual });
        } catch (e) {
            const message =
                e instanceof Error
                    ? e.message
                    : (e as { message?: string })?.message;
            setError(
                message?.startsWith('agreement.')
                    ? message
                    : 'error_saving_session',
            );
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };
    const bases = actual ? agreement.actual : agreement.estimate;
    const base = (key: keyof FeeResults) =>
        number(
            `${actual ? 'actual' : 'estimate'}.${key}`,
            t(`agreement.${key}`),
            bases[key],
            (n) =>
                setAgreement((a) => ({
                    ...a,
                    [actual ? 'actual' : 'estimate']: { ...bases, [key]: n },
                })),
            key === 'tickets',
        );
    return (
        <Modal
            visible
            animationType="slide"
            onRequestClose={() => {
                if (!saving) onClose();
            }}
        >
            <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
                <SessionFormHeader
                    title={t('agreement.title')}
                    subtitle={t('agreement.editorHint')}
                    onClose={() => {
                        if (!saving) onClose();
                    }}
                />
                <ScrollView
                    automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    contentContainerStyle={{
                        padding: 20,
                        paddingBottom: 32,
                        gap: 16,
                    }}
                >
                    {group(
                        t('agreement.terms'),
                        <>
                            <Text style={{ color: c.muted, lineHeight: 21 }}>
                                {t('agreement.termsHint')}
                            </Text>
                            {term('fixed')}
                            {term('perTicket')}
                            {term('entryPercent')}
                            {term('barPercent')}
                            {term('minimum')}
                            <Text
                                style={{
                                    color: c.muted,
                                    lineHeight: 20,
                                    fontSize: 12,
                                }}
                            >
                                {t('agreement.minimumHint')}
                            </Text>
                            {term('expenses')}
                            <Text
                                style={{
                                    color: c.muted,
                                    lineHeight: 20,
                                    fontSize: 12,
                                }}
                            >
                                {t('agreement.expensesHint')}
                            </Text>
                        </>,
                    )}
                    {group(
                        t('agreement.distribution'),
                        <>
                            <Text style={{ color: c.muted, lineHeight: 21 }}>
                                {t('agreement.privateHint')}
                            </Text>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    flexWrap: 'wrap',
                                    gap: 8,
                                }}
                            >
                                {(['equal', 'percent', 'fixed'] as const).map(
                                    (mode) => (
                                        <Pressable
                                            key={mode}
                                            accessibilityRole="radio"
                                            accessibilityState={{
                                                checked:
                                                    agreement.split === mode,
                                            }}
                                            onPress={() =>
                                                setAgreement((a) => ({
                                                    ...a,
                                                    split: mode,
                                                }))
                                            }
                                            style={{
                                                padding: 12,
                                                borderRadius: 14,
                                                backgroundColor:
                                                    agreement.split === mode
                                                        ? c.tint
                                                        : c.bg,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color:
                                                        agreement.split === mode
                                                            ? c.accent
                                                            : c.muted,
                                                    fontWeight: '700',
                                                }}
                                            >
                                                {t(`agreement.split_${mode}`)}
                                            </Text>
                                        </Pressable>
                                    ),
                                )}
                            </View>
                            {agreement.participants.map((p, i) => (
                                <View
                                    key={i}
                                    style={{
                                        gap: 8,
                                        paddingVertical: 10,
                                        borderBottomWidth: 1,
                                        borderColor: c.border,
                                    }}
                                >
                                    <TextInput
                                        accessibilityLabel={
                                            i === 0
                                                ? t('agreement.you')
                                                : t('agreement.djName')
                                        }
                                        placeholder={
                                            i === 0
                                                ? t('agreement.you')
                                                : t('agreement.djName')
                                        }
                                        placeholderTextColor={c.muted}
                                        value={p.name}
                                        maxLength={100}
                                        onChangeText={(name) =>
                                            setAgreement((a) => ({
                                                ...a,
                                                participants:
                                                    a.participants.map(
                                                        (item, j) =>
                                                            j === i
                                                                ? {
                                                                      ...item,
                                                                      name,
                                                                  }
                                                                : item,
                                                    ),
                                            }))
                                        }
                                        style={{
                                            color: c.fg,
                                            minHeight: 44,
                                            fontWeight: '700',
                                            fontSize: 15,
                                        }}
                                    />
                                    {i === 0 && (
                                        <Text
                                            style={{
                                                color: c.muted,
                                                fontSize: 12,
                                            }}
                                        >
                                            {t('agreement.ownerHint')}
                                        </Text>
                                    )}
                                    {agreement.split !== 'equal' &&
                                        number(
                                            `share.${i}`,
                                            t(
                                                agreement.split === 'percent'
                                                    ? 'agreement.sharePercent'
                                                    : 'agreement.shareFixed',
                                            ),
                                            p.share,
                                            (n) =>
                                                setAgreement((a) => ({
                                                    ...a,
                                                    participants:
                                                        a.participants.map(
                                                            (item, j) =>
                                                                j === i
                                                                    ? {
                                                                          ...item,
                                                                          share: n,
                                                                      }
                                                                    : item,
                                                        ),
                                                })),
                                        )}
                                    {i > 0 && (
                                        <CommunityButton
                                            secondary
                                            label={t('agreement.removeDj')}
                                            onPress={() => {
                                                setDrafts({});
                                                setAgreement((a) => ({
                                                    ...a,
                                                    participants:
                                                        a.participants.filter(
                                                            (_, j) => j !== i,
                                                        ),
                                                }));
                                            }}
                                        />
                                    )}
                                </View>
                            ))}
                            {agreement.participants.length < 20 && (
                                <CommunityButton
                                    secondary
                                    label={t('agreement.addDj')}
                                    onPress={() =>
                                        setAgreement((a) => ({
                                            ...a,
                                            participants: [
                                                ...a.participants,
                                                { name: '', share: 0 },
                                            ],
                                        }))
                                    }
                                />
                            )}
                        </>,
                    )}
                    {group(
                        t(actual ? 'agreement.actual' : 'agreement.estimate'),
                        <>
                            {canSettle && (
                                <View style={{ gap: 8 }}>
                                    <CommunityButton
                                        secondary
                                        label={t(
                                            actual
                                                ? 'agreement.useEstimate'
                                                : 'agreement.useActual',
                                        )}
                                        onPress={() => setActual(!actual)}
                                    />
                                </View>
                            )}
                            <Text style={{ color: c.muted, lineHeight: 21 }}>
                                {t(
                                    actual
                                        ? 'agreement.actualHint'
                                        : 'agreement.estimateHint',
                                )}
                            </Text>
                            {agreement.perTicket > 0 && base('tickets')}
                            {agreement.entryPercent > 0 && base('entries')}
                            {agreement.barPercent > 0 && base('bar')}
                        </>,
                    )}
                    {group(
                        t('agreement.breakdown'),
                        result ? (
                            <>
                                <Text
                                    style={{
                                        color: c.accent,
                                        fontSize: 30,
                                        fontWeight: '800',
                                    }}
                                >
                                    {money(result.owner)}
                                </Text>
                                <Text style={{ color: c.muted }}>
                                    {t('agreement.yourFee')}
                                </Text>
                                {[
                                    ['fixed', result.fixed],
                                    ['perTicket', result.tickets],
                                    ['entryPercent', result.entries],
                                    ['barPercent', result.bar],
                                    ['minimum', result.minimumAdjustment],
                                    ['expenses', -agreement.expenses],
                                ]
                                    .filter(([, v]) => v !== 0)
                                    .map(([key, v]) => (
                                        <View
                                            key={String(key)}
                                            style={{
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                gap: 12,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: c.muted,
                                                    flex: 1,
                                                }}
                                            >
                                                {t(`agreement.${key}`)}
                                            </Text>
                                            <Text
                                                style={{
                                                    color: c.fg,
                                                    fontWeight: '600',
                                                }}
                                            >
                                                {money(Number(v))}
                                            </Text>
                                        </View>
                                    ))}
                                <Text
                                    style={{ color: c.fg, fontWeight: '700' }}
                                >
                                    {t('agreement.total')}:{' '}
                                    {money(result.total)}
                                </Text>
                                {result.shares.map((n, i) => (
                                    <Text key={i} style={{ color: c.muted }}>
                                        {agreement.participants[i].name ||
                                            t(
                                                i === 0
                                                    ? 'agreement.you'
                                                    : 'agreement.djName',
                                            )}
                                        : {money(n)}
                                    </Text>
                                ))}
                            </>
                        ) : (
                            <Text style={{ color: c.muted, lineHeight: 21 }}>
                                {t('agreement.calculationHint')}
                            </Text>
                        ),
                    )}
                    {!!error && (
                        <Text
                            accessibilityRole="alert"
                            style={{ color: '#dc4545' }}
                        >
                            {t(error)}
                        </Text>
                    )}
                    <Text
                        style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}
                    >
                        {t(
                            actual
                                ? 'agreement.settleHint'
                                : 'agreement.estimateHint',
                        )}
                    </Text>
                    <CommunityButton
                        busy={saving}
                        label={t(
                            actual ? 'agreement.settle' : 'agreement.save',
                        )}
                        onPress={save}
                    />
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
}
