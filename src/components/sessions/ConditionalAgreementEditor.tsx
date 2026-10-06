import { useRef, useState } from 'react';
import {
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeyboardVisible } from '../../hooks/useKeyboardVisible';
import { useTranslation } from '../../i18n/useTranslation';
import {
    type ConditionalAgreement,
    type ConditionalResults,
    emptyConditionalAgreement,
    calculateConditionalAgreement,
    validateConditionalAgreement,
} from '../../utils/feeAgreement';
import { CommunityButton, useCommunityColors } from '../community/CommunityUI';
import { SessionFormHeader } from './SessionFormLayout';

export function ConditionalAgreementEditor({
    value,
    currency,
    names = [],
    canSettle = false,
    onSave,
    onClose,
}: {
    value: ConditionalAgreement | null;
    currency: string;
    names?: string[];
    canSettle?: boolean;
    onSave: (value: ConditionalAgreement) => void | Promise<unknown>;
    onClose: () => void;
}) {
    const c = useCommunityColors(),
        { t, currentLanguage } = useTranslation();
    const keyboard = useKeyboardVisible();
    const [a, setA] = useState<ConditionalAgreement>(
        () =>
            value || {
                ...emptyConditionalAgreement(),
                ticketMode: 'percent',
                ticketValue: 0,
                tickets: [
                    {
                        name: t('conditional.general'),
                        price: 0,
                        estimate: 0,
                        sold: 0,
                        refunded: 0,
                        invited: 0,
                    },
                ],
                participants: [
                    { name: '', share: 0 },
                    ...names.map((name) => ({ name, share: 0 })),
                ],
            },
    );
    const [step, setStep] = useState(value?.settled ? 2 : 0);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false),
        [error, setError] = useState('');
    const saving = useRef(false);
    const scroll = useRef<ScrollView>(null);
    const money = (n: number) =>
        `${new Intl.NumberFormat(currentLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${currency}`;
    const field = {
        color: c.fg,
        backgroundColor: c.field,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 14,
        padding: 14,
        minHeight: 48,
        fontSize: 16,
    };
    const number = (
        key: string,
        label: string,
        n: number,
        change: (n: number) => void,
        integer = false,
    ) => (
        <View key={key} style={{ gap: 7 }}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>
                {label}
            </Text>
            <TextInput
                accessibilityLabel={label}
                value={drafts[key] ?? (n ? String(n) : '')}
                placeholder="0"
                placeholderTextColor={c.muted}
                editable={!busy}
                keyboardType={integer ? 'number-pad' : 'decimal-pad'}
                maxLength={12}
                style={field}
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
            />
        </View>
    );
    const choices = <K extends string>(
        key: string,
        options: K[],
        selected: K,
        change: (value: K) => void,
    ) => (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {options.map((option) => (
                <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected === option }}
                    disabled={busy}
                    onPress={() => {
                        change(option);
                        setError('');
                    }}
                    style={{
                        minHeight: 44,
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: selected === option ? c.tint : c.field,
                        justifyContent: 'center',
                    }}
                >
                    <Text
                        style={{
                            color: selected === option ? c.accent : c.muted,
                            fontWeight: '600',
                            fontSize: 13,
                        }}
                    >
                        {t(`conditional.${key}_${option}`)}
                    </Text>
                </Pressable>
            ))}
        </View>
    );
    const section = (title: string, content: React.ReactNode) => (
        <View
            style={{
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 24,
                padding: 18,
                gap: 14,
            }}
        >
            <Text style={{ color: c.fg, fontWeight: '800', fontSize: 18 }}>
                {title}
            </Text>
            {content}
        </View>
    );
    let result: ReturnType<typeof calculateConditionalAgreement> | undefined;
    let calculationError = '';
    try {
        result = calculateConditionalAgreement(a, step === 2);
    } catch (e) {
        calculationError = e instanceof Error ? e.message : 'agreement.invalid';
    }
    const changeRow = (
        i: number,
        changes: Partial<ConditionalAgreement['tickets'][number]>,
    ) =>
        setA((current) => ({
            ...current,
            tickets: current.tickets.map((row, j) =>
                j === i ? { ...row, ...changes } : row,
            ),
        }));
    const inputs = (actual: boolean) => {
        const key = actual ? 'actual' : 'estimate';
        const data = a[key];
        const dataField = (name: keyof ConditionalResults) =>
            number(
                `${key}.${name}`,
                t(`conditional.${name === 'bar' ? 'barRevenue' : name}`),
                data[name],
                (n) =>
                    setA((current) => ({
                        ...current,
                        [key]: { ...current[key], [name]: n },
                    })),
            );
        return (
            <>
                {(a.ticketMode !== 'none' || a.bonusAmount > 0) &&
                    section(
                        t('conditional.ticketSales'),
                        <>
                            {a.tickets.map((row, i) => (
                                <View
                                    key={i}
                                    style={{
                                        gap: 12,
                                        paddingBottom: 12,
                                        borderBottomWidth: 1,
                                        borderColor: c.border,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: c.fg,
                                            fontWeight: '700',
                                        }}
                                    >
                                        {row.name} · {money(row.price)}
                                    </Text>
                                    {number(
                                        `${key}.qty.${i}`,
                                        t(
                                            actual
                                                ? 'conditional.sold'
                                                : 'conditional.expected',
                                        ),
                                        actual ? row.sold : row.estimate,
                                        (n) =>
                                            changeRow(
                                                i,
                                                actual
                                                    ? { sold: n }
                                                    : { estimate: n },
                                            ),
                                        true,
                                    )}
                                    {actual && (
                                        <>
                                            {number(
                                                `refund.${i}`,
                                                t('conditional.refunded'),
                                                row.refunded,
                                                (n) =>
                                                    changeRow(i, {
                                                        refunded: n,
                                                    }),
                                                true,
                                            )}
                                            {number(
                                                `invited.${i}`,
                                                t('conditional.invited'),
                                                row.invited,
                                                (n) =>
                                                    changeRow(i, {
                                                        invited: n,
                                                    }),
                                                true,
                                            )}
                                        </>
                                    )}
                                </View>
                            ))}
                            {a.ticketBasis === 'net' &&
                                a.ticketMode !== 'dj_fixed' &&
                                dataField('ticketDeductions')}
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 12,
                                    lineHeight: 18,
                                }}
                            >
                                {t('conditional.countHint')}
                            </Text>
                        </>,
                    )}
                {a.barPercent > 0 &&
                    section(
                        t('conditional.barSales'),
                        <>
                            {dataField('bar')}
                            {a.barBasis === 'net' && dataField('barDeductions')}
                        </>,
                    )}
                {section(
                    t('conditional.costs'),
                    <>
                        {dataField('expenses')}
                        <Text
                            style={{
                                color: c.muted,
                                fontSize: 12,
                                lineHeight: 18,
                            }}
                        >
                            {t('conditional.expenseHint')}
                        </Text>
                    </>,
                )}
            </>
        );
    };
    const save = async () => {
        if (saving.current) return;
        saving.current = true;
        setBusy(true);
        setError('');
        try {
            const next = { ...a, settled: a.settled || step === 2 };
            validateConditionalAgreement(next);
            if (next.settled) calculateConditionalAgreement(next, true);
            await onSave(next);
        } catch (e) {
            const message =
                e instanceof Error
                    ? e.message
                    : (e as { message?: string })?.message;
            setError(
                message?.startsWith('conditional.') ||
                    message?.startsWith('agreement.')
                    ? message
                    : 'error_saving_session',
            );
        } finally {
            saving.current = false;
            setBusy(false);
        }
    };
    return (
        <Modal
            visible
            animationType="slide"
            onRequestClose={() => {
                if (!busy) onClose();
            }}
        >
            <SafeAreaView
                edges={
                    keyboard
                        ? ['top', 'left', 'right']
                        : ['top', 'bottom', 'left', 'right']
                }
                style={{ flex: 1, backgroundColor: c.bg }}
            >
                <SessionFormHeader
                    title={t('conditional.title')}
                    badge="PRO"
                    subtitle={t('conditional.editorIntro')}
                    onClose={() => {
                        if (!busy) onClose();
                    }}
                />
                <View
                    style={{
                        flexDirection: 'row',
                        paddingHorizontal: 20,
                        gap: 8,
                        paddingBottom: 14,
                    }}
                >
                    {['terms', 'forecast', 'close'].map((tab, i) => (
                        <Pressable
                            key={tab}
                            accessibilityRole="tab"
                            accessibilityState={{
                                selected: step === i,
                                disabled: i === 2 && !canSettle,
                            }}
                            disabled={busy || (i === 2 && !canSettle)}
                            onPress={() => {
                                setStep(i);
                                setError('');
                                scroll.current?.scrollTo({
                                    y: 0,
                                    animated: false,
                                });
                            }}
                            style={{
                                flex: 1,
                                minHeight: 44,
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderRadius: 12,
                                backgroundColor: step === i ? c.tint : c.field,
                                opacity: i === 2 && !canSettle ? 0.45 : 1,
                            }}
                        >
                            <Text
                                style={{
                                    color: step === i ? c.accent : c.muted,
                                    fontWeight: '700',
                                    fontSize: 13,
                                }}
                            >
                                {t(`conditional.${tab}`)}
                            </Text>
                        </Pressable>
                    ))}
                </View>
                <ScrollView
                    ref={scroll}
                    style={{ flex: 1 }}
                    automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    contentContainerStyle={{
                        padding: 20,
                        paddingTop: 0,
                        gap: 16,
                        paddingBottom: 24,
                    }}
                >
                    {step === 0 ? (
                        <>
                            {section(
                                t('conditional.templates'),
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        flexWrap: 'wrap',
                                        gap: 8,
                                    }}
                                >
                                    {(
                                        [
                                            'venue',
                                            'percent',
                                            'bar',
                                            'combined',
                                        ] as const
                                    ).map((template) => (
                                        <CommunityButton
                                            key={template}
                                            compact
                                            secondary
                                            disabled={busy}
                                            label={t(
                                                `conditional.template_${template}`,
                                            )}
                                            onPress={() => {
                                                setDrafts({});
                                                setA((current) => ({
                                                    ...current,
                                                    ticketMode:
                                                        template === 'bar'
                                                            ? 'none'
                                                            : template ===
                                                                'venue'
                                                              ? 'venue_fixed'
                                                              : 'percent',
                                                    ticketValue:
                                                        template === 'venue'
                                                            ? 3
                                                            : template === 'bar'
                                                              ? 0
                                                              : 70,
                                                    barPercent:
                                                        template === 'combined'
                                                            ? 10
                                                            : template === 'bar'
                                                              ? 10
                                                              : 0,
                                                    tickets:
                                                        current.tickets.map(
                                                            (row, i) =>
                                                                i === 0
                                                                    ? {
                                                                          ...row,
                                                                          price:
                                                                              row.price ||
                                                                              10,
                                                                      }
                                                                    : row,
                                                        ),
                                                }));
                                            }}
                                        />
                                    ))}
                                </View>,
                            )}
                            {section(
                                t('conditional.tickets'),
                                <>
                                    {choices(
                                        'ticketMode',
                                        [
                                            'none',
                                            'venue_fixed',
                                            'dj_fixed',
                                            'percent',
                                        ],
                                        a.ticketMode,
                                        (ticketMode) => {
                                            setDrafts({});
                                            setA((current) => ({
                                                ...current,
                                                ticketMode,
                                                ticketValue: 0,
                                                estimate: {
                                                    ...current.estimate,
                                                    ticketDeductions: 0,
                                                },
                                                actual: {
                                                    ...current.actual,
                                                    ticketDeductions: 0,
                                                },
                                            }));
                                        },
                                    )}
                                    {(a.ticketMode !== 'none' ||
                                        a.bonusAmount > 0) && (
                                        <>
                                            {a.ticketMode !== 'none' &&
                                                number(
                                                    'ticketValue',
                                                    t(
                                                        `conditional.value_${a.ticketMode}`,
                                                    ),
                                                    a.ticketValue,
                                                    (n) =>
                                                        setA((current) => ({
                                                            ...current,
                                                            ticketValue: n,
                                                        })),
                                                )}
                                            {a.ticketMode !== 'none' &&
                                                a.ticketMode !== 'dj_fixed' &&
                                                choices(
                                                    'basis',
                                                    ['gross', 'net'],
                                                    a.ticketBasis,
                                                    (ticketBasis) =>
                                                        setA((current) => ({
                                                            ...current,
                                                            ticketBasis,
                                                        })),
                                                )}
                                            {a.tickets.map((row, i) => (
                                                <View
                                                    key={i}
                                                    style={{
                                                        gap: 10,
                                                        paddingTop: 12,
                                                        borderTopWidth: 1,
                                                        borderColor: c.border,
                                                    }}
                                                >
                                                    <TextInput
                                                        accessibilityLabel={`${t('conditional.ticketName')} ${i + 1}`}
                                                        value={row.name}
                                                        placeholder={t(
                                                            'conditional.ticketName',
                                                        )}
                                                        placeholderTextColor={
                                                            c.muted
                                                        }
                                                        maxLength={80}
                                                        editable={!busy}
                                                        style={field}
                                                        onChangeText={(name) =>
                                                            changeRow(i, {
                                                                name,
                                                            })
                                                        }
                                                    />
                                                    {number(
                                                        `price.${i}`,
                                                        t(
                                                            'conditional.ticketPrice',
                                                        ),
                                                        row.price,
                                                        (n) =>
                                                            changeRow(i, {
                                                                price: n,
                                                            }),
                                                    )}
                                                    {a.tickets.length > 1 && (
                                                        <CommunityButton
                                                            secondary
                                                            compact
                                                            disabled={busy}
                                                            label={t(
                                                                'conditional.removeTicket',
                                                            )}
                                                            onPress={() => {
                                                                setDrafts({});
                                                                setA(
                                                                    (
                                                                        current,
                                                                    ) => ({
                                                                        ...current,
                                                                        tickets:
                                                                            current.tickets.filter(
                                                                                (
                                                                                    _,
                                                                                    j,
                                                                                ) =>
                                                                                    j !==
                                                                                    i,
                                                                            ),
                                                                    }),
                                                                );
                                                            }}
                                                        />
                                                    )}
                                                </View>
                                            ))}
                                            {a.tickets.length < 30 && (
                                                <CommunityButton
                                                    secondary
                                                    disabled={busy}
                                                    label={t(
                                                        'conditional.addTicket',
                                                    )}
                                                    onPress={() =>
                                                        setA((current) => ({
                                                            ...current,
                                                            tickets: [
                                                                ...current.tickets,
                                                                {
                                                                    name: '',
                                                                    price: 0,
                                                                    estimate: 0,
                                                                    sold: 0,
                                                                    refunded: 0,
                                                                    invited: 0,
                                                                },
                                                            ],
                                                        }))
                                                    }
                                                />
                                            )}
                                        </>
                                    )}
                                </>,
                            )}
                            {section(
                                t('conditional.bar'),
                                <>
                                    {number(
                                        'barPercent',
                                        t('conditional.barPercent'),
                                        a.barPercent,
                                        (n) =>
                                            setA((current) => ({
                                                ...current,
                                                barPercent: n,
                                            })),
                                    )}
                                    {a.barPercent > 0 &&
                                        choices(
                                            'basis',
                                            ['gross', 'net'],
                                            a.barBasis,
                                            (barBasis) =>
                                                setA((current) => ({
                                                    ...current,
                                                    barBasis,
                                                })),
                                        )}
                                    <Text
                                        style={{
                                            color: c.muted,
                                            fontSize: 12,
                                            lineHeight: 18,
                                        }}
                                    >
                                        {t('conditional.barHint')}
                                    </Text>
                                </>,
                            )}
                            {section(
                                t('conditional.guarantees'),
                                <>
                                    {number(
                                        'fixed',
                                        t('conditional.fixed'),
                                        a.fixed,
                                        (n) =>
                                            setA((current) => ({
                                                ...current,
                                                fixed: n,
                                            })),
                                    )}
                                    {a.fixed > 0 &&
                                        choices(
                                            'fixedMode',
                                            ['add', 'versus'],
                                            a.fixedMode,
                                            (fixedMode) =>
                                                setA((current) => ({
                                                    ...current,
                                                    fixedMode,
                                                })),
                                        )}
                                    {number(
                                        'minimum',
                                        t('conditional.minimum'),
                                        a.minimum,
                                        (n) =>
                                            setA((current) => ({
                                                ...current,
                                                minimum: n,
                                            })),
                                    )}
                                    {number(
                                        'maximum',
                                        t('conditional.maximum'),
                                        a.maximum,
                                        (n) =>
                                            setA((current) => ({
                                                ...current,
                                                maximum: n,
                                            })),
                                    )}
                                    {number(
                                        'bonusThreshold',
                                        t('conditional.bonusThreshold'),
                                        a.bonusThreshold,
                                        (n) =>
                                            setA((current) => ({
                                                ...current,
                                                bonusThreshold: n,
                                            })),
                                        true,
                                    )}
                                    {a.bonusThreshold > 0 &&
                                        number(
                                            'bonusAmount',
                                            t('conditional.bonusAmount'),
                                            a.bonusAmount,
                                            (n) =>
                                                setA((current) => ({
                                                    ...current,
                                                    bonusAmount: n,
                                                })),
                                        )}
                                </>,
                            )}
                            {section(
                                t('conditional.distribution'),
                                <>
                                    {choices(
                                        'split',
                                        ['equal', 'percent', 'fixed'],
                                        a.split,
                                        (split) => {
                                            setDrafts({});
                                            setA((current) => ({
                                                ...current,
                                                split,
                                            }));
                                        },
                                    )}
                                    {a.participants.map((person, i) => (
                                        <View key={i} style={{ gap: 10 }}>
                                            {i === 0 ? (
                                                <Text
                                                    style={{
                                                        color: c.fg,
                                                        fontWeight: '700',
                                                    }}
                                                >
                                                    {t('agreement.you')}
                                                </Text>
                                            ) : (
                                                <TextInput
                                                    accessibilityLabel={`${t('agreement.djName')} ${i}`}
                                                    value={person.name}
                                                    maxLength={100}
                                                    editable={!busy}
                                                    placeholder={t(
                                                        'agreement.djName',
                                                    )}
                                                    placeholderTextColor={
                                                        c.muted
                                                    }
                                                    style={field}
                                                    onChangeText={(name) =>
                                                        setA((current) => ({
                                                            ...current,
                                                            participants:
                                                                current.participants.map(
                                                                    (p, j) =>
                                                                        j === i
                                                                            ? {
                                                                                  ...p,
                                                                                  name,
                                                                              }
                                                                            : p,
                                                                ),
                                                        }))
                                                    }
                                                />
                                            )}
                                            {(a.split === 'percent' ||
                                                (a.split === 'fixed' &&
                                                    i > 0)) &&
                                                number(
                                                    `share.${i}`,
                                                    t(
                                                        a.split === 'percent'
                                                            ? 'agreement.sharePercent'
                                                            : 'agreement.shareFixed',
                                                    ),
                                                    person.share,
                                                    (n) =>
                                                        setA((current) => ({
                                                            ...current,
                                                            participants:
                                                                current.participants.map(
                                                                    (p, j) =>
                                                                        j === i
                                                                            ? {
                                                                                  ...p,
                                                                                  share: n,
                                                                              }
                                                                            : p,
                                                                ),
                                                        })),
                                                )}
                                            {i > 0 && (
                                                <CommunityButton
                                                    secondary
                                                    compact
                                                    disabled={busy}
                                                    label={t(
                                                        'agreement.removeDj',
                                                    )}
                                                    onPress={() => {
                                                        setDrafts({});
                                                        setA((current) => ({
                                                            ...current,
                                                            participants:
                                                                current.participants.filter(
                                                                    (_, j) =>
                                                                        j !== i,
                                                                ),
                                                        }));
                                                    }}
                                                />
                                            )}
                                        </View>
                                    ))}
                                    {a.split === 'fixed' && (
                                        <Text
                                            style={{
                                                color: c.muted,
                                                fontSize: 12,
                                                lineHeight: 18,
                                            }}
                                        >
                                            {t('conditional.fixedSplitHint')}
                                        </Text>
                                    )}
                                    {a.participants.length < 20 && (
                                        <CommunityButton
                                            secondary
                                            disabled={busy}
                                            label={t('agreement.addDj')}
                                            onPress={() =>
                                                setA((current) => ({
                                                    ...current,
                                                    participants: [
                                                        ...current.participants,
                                                        { name: '', share: 0 },
                                                    ],
                                                }))
                                            }
                                        />
                                    )}
                                </>,
                            )}
                            {section(
                                t('conditional.notes'),
                                <TextInput
                                    accessibilityLabel={t('conditional.notes')}
                                    value={a.notes}
                                    multiline
                                    maxLength={2000}
                                    editable={!busy}
                                    style={[
                                        field,
                                        {
                                            minHeight: 90,
                                            textAlignVertical: 'top',
                                        },
                                    ]}
                                    onChangeText={(notes) =>
                                        setA((current) => ({
                                            ...current,
                                            notes,
                                        }))
                                    }
                                />,
                            )}
                        </>
                    ) : (
                        <>
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 13,
                                    lineHeight: 20,
                                }}
                            >
                                {t(
                                    step === 2
                                        ? 'conditional.closeHint'
                                        : 'conditional.forecastHint',
                                )}
                            </Text>
                            {inputs(step === 2)}
                        </>
                    )}
                    {section(
                        t(
                            step === 2
                                ? 'conditional.actualBreakdown'
                                : 'conditional.forecastBreakdown',
                        ),
                        result ? (
                            <>
                                <Text
                                    style={{
                                        color: c.accent,
                                        fontSize: 34,
                                        fontWeight: '800',
                                    }}
                                >
                                    {money(result.owner)}
                                </Text>
                                <Text style={{ color: c.muted }}>
                                    {t('agreement.yourFee')}
                                </Text>
                                {[
                                    ['ticketGross', result.ticketGross],
                                    ['venueRetention', result.venueRetention],
                                    [
                                        'ticketDeductions',
                                        a.ticketBasis === 'net'
                                            ? (step === 2
                                                  ? a.actual
                                                  : a.estimate
                                              ).ticketDeductions
                                            : 0,
                                    ],
                                    ['ticketsFee', result.tickets],
                                    [
                                        'barDeductions',
                                        a.barBasis === 'net'
                                            ? (step === 2
                                                  ? a.actual
                                                  : a.estimate
                                              ).barDeductions
                                            : 0,
                                    ],
                                    ['barFee', result.bar],
                                    ['fixed', result.fixed],
                                    ['bonusAmount', result.bonus],
                                    ['expenses', result.expenses],
                                    ['pool', result.total],
                                ].map(([key, amount]) => (
                                    <View
                                        key={String(key)}
                                        style={{
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            gap: 12,
                                        }}
                                    >
                                        <Text
                                            style={{ color: c.muted, flex: 1 }}
                                        >
                                            {t(`conditional.${key}`)}
                                        </Text>
                                        <Text
                                            style={{
                                                color: c.fg,
                                                fontWeight: '600',
                                            }}
                                        >
                                            {money(Number(amount))}
                                        </Text>
                                    </View>
                                ))}
                                {result.minimumAdjustment > 0 && (
                                    <Text style={{ color: c.muted }}>
                                        {t('conditional.minimumApplied')}:{' '}
                                        {money(result.minimumAdjustment)}
                                    </Text>
                                )}
                                {result.capAdjustment > 0 && (
                                    <Text style={{ color: c.muted }}>
                                        {t('conditional.capApplied')}: −
                                        {money(result.capAdjustment)}
                                    </Text>
                                )}
                                {result.shares.map((share, i) => (
                                    <View
                                        key={i}
                                        style={{
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            gap: 12,
                                        }}
                                    >
                                        <Text style={{ color: c.fg, flex: 1 }}>
                                            {a.participants[i].name ||
                                                t('agreement.you')}
                                        </Text>
                                        <Text
                                            style={{
                                                color: c.fg,
                                                fontWeight: '700',
                                            }}
                                        >
                                            {money(share)}
                                        </Text>
                                    </View>
                                ))}
                            </>
                        ) : (
                            <Text style={{ color: c.muted, lineHeight: 20 }}>
                                {t(calculationError)}
                            </Text>
                        ),
                    )}
                    {!canSettle && (
                        <Text
                            style={{
                                color: c.muted,
                                fontSize: 12,
                                lineHeight: 18,
                            }}
                        >
                            {t('conditional.availableAfter')}
                        </Text>
                    )}
                    <Text
                        style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}
                    >
                        {t('conditional.privateHint')}
                    </Text>
                </ScrollView>
                {!keyboard && (
                    <View
                        style={{
                            padding: 20,
                            paddingTop: 12,
                            gap: 8,
                            borderTopWidth: 1,
                            borderColor: c.border,
                        }}
                    >
                        {!!error && (
                            <Text
                                accessibilityRole="alert"
                                style={{ color: '#d76f7d' }}
                            >
                                {t(error)}
                            </Text>
                        )}
                        <CommunityButton
                            busy={busy}
                            label={t(
                                step === 2 || a.settled
                                    ? 'conditional.settle'
                                    : 'conditional.saveTerms',
                            )}
                            onPress={() => void save()}
                        />
                    </View>
                )}
            </SafeAreaView>
        </Modal>
    );
}
