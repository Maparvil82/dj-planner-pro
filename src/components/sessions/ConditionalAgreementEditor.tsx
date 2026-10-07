import { useRef, useState } from 'react';
import {
    Keyboard,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TextInput,
    View,
    type TextStyle,
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
import {
    activeAgreementExtras,
    agreementExtras,
    conditionalModel,
    conditionalSummary,
    type AgreementExtra,
    type ConditionalModel,
} from '../../utils/conditionalPresentation';
import { CommunityButton, useCommunityColors } from '../community/CommunityUI';
import { SessionFormHeader } from './SessionFormLayout';

type Mode = 'terms' | 'forecast' | 'actual';
export function ConditionalAgreementEditor({
    value,
    currency,
    names = [],
    canSettle = false,
    initialMode = 'terms',
    presentation = 'modal',
    onSave,
    onClose,
}: {
    value: ConditionalAgreement | null;
    currency: string;
    names?: string[];
    canSettle?: boolean;
    initialMode?: Mode;
    presentation?: 'modal' | 'screen';
    onSave: (value: ConditionalAgreement) => void | Promise<unknown>;
    onClose: () => void;
}) {
    const c = useCommunityColors(),
        { t, currentLanguage } = useTranslation(),
        keyboard = useKeyboardVisible();
    const [a, setA] = useState<ConditionalAgreement>(
        () =>
            value || {
                ...emptyConditionalAgreement(),
                ticketMode: 'none',
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
            },
    );
    const [model, setModel] = useState<ConditionalModel | null>(() =>
        value ? conditionalModel(value) : null,
    );
    const [modelChanged, setModelChanged] = useState(false);
    const [mode, setMode] = useState<Mode>(
        initialMode === 'actual' && !canSettle ? 'terms' : initialMode,
    );
    const [extras, setExtras] = useState<AgreementExtra[]>(() =>
        value ? activeAgreementExtras(value) : [],
    );
    const [choosingExtra, setChoosingExtra] = useState(false);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [adjustments, setAdjustments] = useState(
        () =>
            !!value?.tickets.some((row) => row.refunded > 0 || row.invited > 0),
    );
    const [busy, setBusy] = useState(false),
        [error, setError] = useState('');
    const saving = useRef(false),
        scroll = useRef<ScrollView>(null);
    const money = (n: number) =>
        `${new Intl.NumberFormat(currentLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${currency}`;
    const field: TextStyle = {
        color: c.fg,
        backgroundColor: c.field,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 14,
        padding: 14,
        minHeight: 48,
        fontSize: 16,
    };
    const text = (
        label: string,
        value: string,
        change: (s: string) => void,
        max = 100,
    ) => (
        <View style={{ gap: 7 }}>
            <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
            <TextInput
                accessibilityLabel={label}
                value={value}
                onChangeText={change}
                editable={!busy}
                maxLength={max}
                placeholder={label}
                placeholderTextColor={c.muted}
                style={field}
            />
        </View>
    );
    const number = (
        key: string,
        label: string,
        n: number,
        change: (n: number) => void,
        integer = false,
    ) => (
        <View key={key} style={{ gap: 7 }}>
            <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
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
    const section = (title: string, content: React.ReactNode) => (
        <View key={title} style={{ gap: 14, paddingVertical: 8 }}>
            <Text style={{ color: c.fg, fontSize: 18, fontWeight: '800' }}>
                {title}
            </Text>
            {content}
        </View>
    );
    const choices = <K extends string>(
        key: string,
        options: K[],
        selected: K,
        change: (s: K) => void,
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
    const link = (label: string, action: () => void) => (
        <CommunityButton
            key={label}
            secondary
            compact
            label={label}
            disabled={busy}
            onPress={action}
        />
    );
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
    const navigate = (next: Mode) => {
        Keyboard.dismiss();
        setMode(next);
        setError('');
        setDrafts({});
        scroll.current?.scrollTo({ y: 0, animated: false });
    };
    const chooseModel = (next: ConditionalModel) => {
        setModel(next);
        setModelChanged(true);
        setDrafts({});
        setError('');
        setA((current) => ({
            ...current,
            ticketMode:
                next === 'bar'
                    ? 'none'
                    : next === 'ticket'
                      ? 'dj_fixed'
                      : 'percent',
            ticketValue: 0,
            barPercent: 0,
            ticketBasis: 'gross',
            barBasis: 'gross',
            bonusAmount: next === 'bar' ? 0 : current.bonusAmount,
            bonusThreshold: next === 'bar' ? 0 : current.bonusThreshold,
            estimate: {
                ...current.estimate,
                ticketDeductions: 0,
                barDeductions: 0,
            },
            actual: {
                ...current.actual,
                ticketDeductions: 0,
                barDeductions: 0,
            },
        }));
    };
    const removeExtra = (key: AgreementExtra) => {
        setExtras((current) => current.filter((x) => x !== key));
        setDrafts({});
        setError('');
        setA((current) => ({
            ...current,
            ...(key === 'fixed' ? { fixed: 0, fixedMode: 'add' as const } : {}),
            ...(key === 'minimum' ? { minimum: 0 } : {}),
            ...(key === 'maximum' ? { maximum: 0 } : {}),
            ...(key === 'bonus' ? { bonusAmount: 0, bonusThreshold: 0 } : {}),
            ...(key === 'notes' ? { notes: '' } : {}),
            ...(key === 'expenses'
                ? {
                      estimate: { ...current.estimate, expenses: 0 },
                      actual: { ...current.actual, expenses: 0 },
                      expenseItems: [],
                  }
                : {}),
            ...(key === 'deductions'
                ? {
                      ticketBasis: 'gross' as const,
                      barBasis: 'gross' as const,
                      estimate: {
                          ...current.estimate,
                          ticketDeductions: 0,
                          barDeductions: 0,
                      },
                      actual: {
                          ...current.actual,
                          ticketDeductions: 0,
                          barDeductions: 0,
                      },
                  }
                : {}),
        }));
    };
    const toggleSplit = (enabled: boolean) => {
        setDrafts({});
        setA((current) => ({
            ...current,
            split: 'equal',
            participants: enabled
                ? [
                      current.participants[0],
                      ...(names.length
                          ? names.map((name) => ({ name, share: 0 }))
                          : [{ name: '', share: 0 }]),
                  ]
                : [{ ...current.participants[0], share: 0 }],
        }));
    };
    const summary = model ? conditionalSummary(a, t, money) : '';
    let result: ReturnType<typeof calculateConditionalAgreement> | undefined,
        calculationError = '';
    if (mode !== 'terms')
        try {
            result = calculateConditionalAgreement(a, mode === 'actual');
        } catch (e) {
            calculationError =
                e instanceof Error ? e.message : 'agreement.invalid';
        }
    const save = async () => {
        if (saving.current) return;
        setError('');
        try {
            if (!model) throw new Error('conditionalFlow.chooseModel');
            if (
                (!value || modelChanged) &&
                (model === 'bar' || model === 'combined') &&
                a.barPercent <= 0
            )
                throw new Error('conditionalFlow.enterBar');
            if (
                a.ticketMode !== 'none' &&
                !a.tickets.some((row) => row.price > 0) &&
                (!value || modelChanged)
            )
                throw new Error('conditionalFlow.enterPrice');
            if (
                (a.ticketMode === 'percent' || a.ticketMode === 'dj_fixed') &&
                a.ticketValue <= 0 &&
                (!value || modelChanged)
            )
                throw new Error('conditionalFlow.enterShare');
            const next = {
                ...a,
                enabledExtras: extras,
                settled: a.settled || mode === 'actual',
            };
            validateConditionalAgreement(next);
            if (next.settled) calculateConditionalAgreement(next, true);
            saving.current = true;
            setBusy(true);
            await onSave(next);
        } catch (e) {
            const message =
                e instanceof Error
                    ? e.message
                    : (e as { message?: string })?.message;
            setError(
                message?.startsWith('conditional') ||
                    message?.startsWith('agreement.')
                    ? message
                    : 'error_saving_session',
            );
        } finally {
            saving.current = false;
            setBusy(false);
        }
    };
    const dataKey = mode === 'actual' ? 'actual' : 'estimate',
        data = a[dataKey];
    const dataField = (name: keyof ConditionalResults) =>
        number(
            `${dataKey}.${name}`,
            t(`conditional.${name === 'bar' ? 'barRevenue' : name}`),
            data[name],
            (n) =>
                setA((current) => ({
                    ...current,
                    [dataKey]: { ...current[dataKey], [name]: n },
                })),
        );
    const expenseFields = () => (
        <View style={{ gap: 14 }}>
            {(a.expenseItems || []).map((item, i) => (
                <View
                    key={i}
                    style={{
                        gap: 10,
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: c.border,
                    }}
                >
                    {text(
                        t('conditionalCosts.concept'),
                        item.concept,
                        (concept) =>
                            setA((current) => ({
                                ...current,
                                expenseItems: current.expenseItems?.map(
                                    (row, j) =>
                                        j === i ? { ...row, concept } : row,
                                ),
                            })),
                    )}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {(['fixed', 'percent'] as const).map((type) => (
                            <Pressable
                                key={type}
                                accessibilityRole="radio"
                                accessibilityState={{
                                    checked: item.type === type,
                                }}
                                disabled={busy}
                                onPress={() => {
                                    setDrafts((d) => {
                                        const next = { ...d };
                                        delete next[`expense.${i}`];
                                        return next;
                                    });
                                    setA((current) => ({
                                        ...current,
                                        expenseItems: current.expenseItems?.map(
                                            (row, j) =>
                                                j === i
                                                    ? { ...row, type, value: 0 }
                                                    : row,
                                        ),
                                    }));
                                }}
                                style={{
                                    padding: 12,
                                    minHeight: 44,
                                    borderRadius: 12,
                                    backgroundColor:
                                        item.type === type ? c.tint : c.field,
                                }}
                            >
                                <Text style={{ color: c.fg }}>
                                    {t(`conditionalCosts.${type}`)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                    {number(
                        `expense.${i}`,
                        t(
                            item.type === 'fixed'
                                ? 'conditionalCosts.amount'
                                : 'conditionalCosts.percentage',
                        ),
                        item.value,
                        (value) =>
                            setA((current) => ({
                                ...current,
                                expenseItems: current.expenseItems?.map(
                                    (row, j) =>
                                        j === i ? { ...row, value } : row,
                                ),
                            })),
                    )}
                    {item.type === 'percent' && (
                        <Text
                            style={{
                                color: c.muted,
                                lineHeight: 18,
                                fontSize: 12,
                            }}
                        >
                            {t('conditionalCosts.basis')}
                        </Text>
                    )}
                    {link(t('conditionalCosts.remove'), () => {
                        setDrafts({});
                        setA((current) => ({
                            ...current,
                            expenseItems: current.expenseItems?.filter(
                                (_, j) => j !== i,
                            ),
                        }));
                    })}
                </View>
            ))}
            {a[dataKey].expenses > 0 && dataField('expenses')}
            {(a.expenseItems?.length || 0) < 30 &&
                link(t('conditionalCosts.add'), () =>
                    setA((current) => ({
                        ...current,
                        expenseItems: [
                            ...(current.expenseItems || []),
                            { concept: '', type: 'fixed', value: 0 },
                        ],
                    })),
                )}
        </View>
    );
    const ticketsNeeded = a.ticketMode !== 'none' || a.bonusAmount > 0;
    const modelLabel = model ? t(`conditionalFlow.model_${model}`) : '';
    const content = (
        <SafeAreaView
            edges={
                keyboard
                    ? ['top', 'left', 'right']
                    : ['top', 'bottom', 'left', 'right']
            }
            style={{ flex: 1, backgroundColor: c.bg }}
        >
            <SessionFormHeader
                title={t(
                    mode === 'terms'
                        ? 'conditional.title'
                        : mode === 'actual'
                          ? 'conditionalFlow.calculate'
                          : 'conditionalFlow.trySales',
                )}
                badge="PRO"
                subtitle={t(
                    mode === 'terms'
                        ? 'conditionalFlow.intro'
                        : mode === 'actual'
                          ? 'conditionalFlow.actualHint'
                          : 'conditionalFlow.forecastHint',
                )}
                onClose={() => {
                    if (!busy) onClose();
                }}
            />
            <ScrollView
                ref={scroll}
                style={{ flex: 1 }}
                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={{
                    paddingHorizontal: 24,
                    paddingBottom: 24,
                    gap: 22,
                }}
            >
                {mode === 'terms' ? (
                    <>
                        {section(
                            t('conditionalFlow.how'),
                            <>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        flexWrap: 'wrap',
                                        gap: 10,
                                    }}
                                >
                                    {(
                                        [
                                            'ticket',
                                            'boxOffice',
                                            'bar',
                                            'combined',
                                        ] as const
                                    ).map((item) => (
                                        <Pressable
                                            key={item}
                                            accessibilityRole="radio"
                                            accessibilityState={{
                                                checked: model === item,
                                            }}
                                            disabled={busy}
                                            onPress={() => {
                                                if (model !== item)
                                                    chooseModel(item);
                                            }}
                                            style={{
                                                width: '48%',
                                                aspectRatio: 1,
                                                justifyContent: 'center',
                                                padding: 14,
                                                borderRadius: 18,
                                                borderWidth: 1,
                                                borderColor:
                                                    model === item
                                                        ? c.accent
                                                        : c.border,
                                                backgroundColor:
                                                    model === item
                                                        ? c.tint
                                                        : c.card,
                                                gap: 7,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color:
                                                        model === item
                                                            ? c.accent
                                                            : c.fg,
                                                    fontWeight: '800',
                                                    fontSize: 15,
                                                }}
                                            >
                                                {t(
                                                    `conditionalFlow.model_${item}`,
                                                )}
                                            </Text>
                                            <Text
                                                style={{
                                                    color: c.muted,
                                                    fontSize: 12,
                                                    lineHeight: 17,
                                                }}
                                            >
                                                {t(
                                                    `conditionalFlow.example_${item}`,
                                                )}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </>,
                        )}
                        {model && (
                            <>
                                {ticketsNeeded &&
                                    section(
                                        t('conditionalFlow.ticketQuestion'),
                                        <>
                                            {a.ticketMode !== 'none' && (
                                                <>
                                                    {a.tickets.map((row, i) => (
                                                        <View
                                                            key={i}
                                                            style={{
                                                                gap: 12,
                                                            }}
                                                        >
                                                            {a.tickets.length >
                                                                1 &&
                                                                text(
                                                                    `${t('conditional.ticketName')} ${i + 1}`,
                                                                    row.name,
                                                                    (name) =>
                                                                        changeRow(
                                                                            i,
                                                                            {
                                                                                name,
                                                                            },
                                                                        ),
                                                                    80,
                                                                )}
                                                            {number(
                                                                `price.${i}`,
                                                                a.tickets
                                                                    .length > 1
                                                                    ? `${t('conditional.ticketPrice')} · ${row.name || i + 1}`
                                                                    : t(
                                                                          'conditionalFlow.price',
                                                                      ),
                                                                row.price,
                                                                (n) =>
                                                                    changeRow(
                                                                        i,
                                                                        {
                                                                            price: n,
                                                                        },
                                                                    ),
                                                            )}
                                                            {a.tickets.length >
                                                                1 &&
                                                                link(
                                                                    t(
                                                                        'conditional.removeTicket',
                                                                    ),
                                                                    () => {
                                                                        setDrafts(
                                                                            {},
                                                                        );
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
                                                                                            i !==
                                                                                            j,
                                                                                    ),
                                                                            }),
                                                                        );
                                                                    },
                                                                )}
                                                        </View>
                                                    ))}
                                                    {a.tickets.length < 30 &&
                                                        link(
                                                            t(
                                                                'conditionalFlow.morePrices',
                                                            ),
                                                            () =>
                                                                setA(
                                                                    (
                                                                        current,
                                                                    ) => ({
                                                                        ...current,
                                                                        tickets:
                                                                            [
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
                                                                    }),
                                                                ),
                                                        )}
                                                    {(model === 'combined' ||
                                                        a.ticketMode ===
                                                            'venue_fixed') &&
                                                        choices(
                                                            'ticketMode',
                                                            [
                                                                ...(a.ticketMode ===
                                                                    'venue_fixed' ||
                                                                value?.ticketMode ===
                                                                    'venue_fixed'
                                                                    ? [
                                                                          'venue_fixed' as const,
                                                                      ]
                                                                    : []),
                                                                'dj_fixed',
                                                                ...(model ===
                                                                'combined'
                                                                    ? [
                                                                          'percent' as const,
                                                                      ]
                                                                    : []),
                                                            ],
                                                            a.ticketMode as
                                                                | 'venue_fixed'
                                                                | 'dj_fixed'
                                                                | 'percent',
                                                            (ticketMode) => {
                                                                setDrafts({});
                                                                setA(
                                                                    (
                                                                        current,
                                                                    ) => ({
                                                                        ...current,
                                                                        ticketMode,
                                                                        ticketValue: 0,
                                                                    }),
                                                                );
                                                            },
                                                        )}
                                                    {number(
                                                        'ticketValue',
                                                        t(
                                                            `conditionalFlow.value_${a.ticketMode}`,
                                                        ),
                                                        a.ticketValue,
                                                        (n) =>
                                                            setA((current) => ({
                                                                ...current,
                                                                ticketValue: n,
                                                            })),
                                                    )}
                                                </>
                                            )}
                                        </>,
                                    )}
                                {(model === 'bar' || model === 'combined') &&
                                    section(
                                        t('conditionalFlow.barQuestion'),
                                        number(
                                            'barPercent',
                                            t('conditionalFlow.barPercent'),
                                            a.barPercent,
                                            (n) =>
                                                setA((current) => ({
                                                    ...current,
                                                    barPercent: n,
                                                })),
                                        ),
                                    )}
                                {extras.map((extra) =>
                                    section(
                                        t(`conditionalFlow.extra_${extra}`),
                                        <View key={extra} style={{ gap: 12 }}>
                                            {extra === 'fixed' && (
                                                <>
                                                    {number(
                                                        'fixed',
                                                        t(
                                                            'conditionalFlow.fixed',
                                                        ),
                                                        a.fixed,
                                                        (n) =>
                                                            setA((current) => ({
                                                                ...current,
                                                                fixed: n,
                                                            })),
                                                    )}
                                                    {choices(
                                                        'fixedMode',
                                                        ['add', 'versus'],
                                                        a.fixedMode,
                                                        (fixedMode) =>
                                                            setA((current) => ({
                                                                ...current,
                                                                fixedMode,
                                                            })),
                                                    )}
                                                </>
                                            )}
                                            {extra === 'minimum' &&
                                                number(
                                                    'minimum',
                                                    t(
                                                        'conditionalFlow.minimum',
                                                    ),
                                                    a.minimum,
                                                    (n) =>
                                                        setA((current) => ({
                                                            ...current,
                                                            minimum: n,
                                                        })),
                                                )}
                                            {extra === 'maximum' &&
                                                number(
                                                    'maximum',
                                                    t(
                                                        'conditionalFlow.maximum',
                                                    ),
                                                    a.maximum,
                                                    (n) =>
                                                        setA((current) => ({
                                                            ...current,
                                                            maximum: n,
                                                        })),
                                                )}
                                            {extra === 'bonus' && (
                                                <>
                                                    {number(
                                                        'bonusThreshold',
                                                        t(
                                                            'conditionalFlow.bonusThreshold',
                                                        ),
                                                        a.bonusThreshold,
                                                        (n) =>
                                                            setA((current) => ({
                                                                ...current,
                                                                bonusThreshold:
                                                                    n,
                                                            })),
                                                        true,
                                                    )}
                                                    {number(
                                                        'bonusAmount',
                                                        t(
                                                            'conditionalFlow.bonusAmount',
                                                        ),
                                                        a.bonusAmount,
                                                        (n) =>
                                                            setA((current) => ({
                                                                ...current,
                                                                bonusAmount: n,
                                                            })),
                                                    )}
                                                </>
                                            )}
                                            {extra === 'expenses' &&
                                                expenseFields()}
                                            {extra === 'deductions' && (
                                                <>
                                                    {a.ticketMode !== 'none' &&
                                                        a.ticketMode !==
                                                            'dj_fixed' && (
                                                            <>
                                                                <Text
                                                                    style={{
                                                                        color: c.fg,
                                                                    }}
                                                                >
                                                                    {t(
                                                                        'conditionalFlow.ticketBasis',
                                                                    )}
                                                                </Text>
                                                                {choices(
                                                                    'basis',
                                                                    [
                                                                        'gross',
                                                                        'net',
                                                                    ],
                                                                    a.ticketBasis,
                                                                    (
                                                                        ticketBasis,
                                                                    ) =>
                                                                        setA(
                                                                            (
                                                                                current,
                                                                            ) => ({
                                                                                ...current,
                                                                                ticketBasis,
                                                                            }),
                                                                        ),
                                                                )}
                                                            </>
                                                        )}
                                                    {(model === 'bar' ||
                                                        model ===
                                                            'combined') && (
                                                        <>
                                                            <Text
                                                                style={{
                                                                    color: c.fg,
                                                                }}
                                                            >
                                                                {t(
                                                                    'conditionalFlow.barBasis',
                                                                )}
                                                            </Text>
                                                            {choices(
                                                                'basis',
                                                                [
                                                                    'gross',
                                                                    'net',
                                                                ],
                                                                a.barBasis,
                                                                (barBasis) =>
                                                                    setA(
                                                                        (
                                                                            current,
                                                                        ) => ({
                                                                            ...current,
                                                                            barBasis,
                                                                        }),
                                                                    ),
                                                            )}
                                                        </>
                                                    )}
                                                </>
                                            )}
                                            {extra === 'notes' && (
                                                <TextInput
                                                    accessibilityLabel={t(
                                                        'conditional.notes',
                                                    )}
                                                    value={a.notes}
                                                    onChangeText={(notes) =>
                                                        setA((current) => ({
                                                            ...current,
                                                            notes,
                                                        }))
                                                    }
                                                    editable={!busy}
                                                    multiline
                                                    maxLength={2000}
                                                    placeholder={t(
                                                        'conditional.notes',
                                                    )}
                                                    placeholderTextColor={
                                                        c.muted
                                                    }
                                                    style={[
                                                        field,
                                                        {
                                                            minHeight: 90,
                                                            textAlignVertical:
                                                                'top',
                                                        },
                                                    ]}
                                                />
                                            )}
                                            {link(
                                                t(
                                                    'conditionalFlow.removeCondition',
                                                ),
                                                () => removeExtra(extra),
                                            )}
                                        </View>,
                                    ),
                                )}
                                {link(t('conditionalFlow.addCondition'), () =>
                                    setChoosingExtra((current) => !current),
                                )}
                                {choosingExtra && (
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            flexWrap: 'wrap',
                                            gap: 8,
                                        }}
                                    >
                                        {agreementExtras
                                            .filter(
                                                (key) =>
                                                    !extras.includes(key) &&
                                                    !(
                                                        key === 'bonus' &&
                                                        model === 'bar'
                                                    ),
                                            )
                                            .map((key) =>
                                                link(
                                                    t(
                                                        `conditionalFlow.extra_${key}`,
                                                    ),
                                                    () => {
                                                        setExtras((current) => [
                                                            ...current,
                                                            key,
                                                        ]);
                                                        setChoosingExtra(false);
                                                    },
                                                ),
                                            )}
                                    </View>
                                )}
                                <View
                                    style={{
                                        borderTopWidth: 1,
                                        borderColor: c.border,
                                        paddingTop: 20,
                                        gap: 16,
                                    }}
                                >
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 12,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: c.fg,
                                                fontWeight: '700',
                                                fontSize: 16,
                                                flex: 1,
                                            }}
                                        >
                                            {t('conditionalFlow.shareDjs')}
                                        </Text>
                                        <Switch
                                            accessibilityLabel={t(
                                                'conditionalFlow.shareDjs',
                                            )}
                                            disabled={busy}
                                            value={a.participants.length > 1}
                                            onValueChange={toggleSplit}
                                            trackColor={{
                                                false: c.border,
                                                true: c.accent,
                                            }}
                                        />
                                    </View>
                                    {a.participants.length > 1 && (
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
                                                <View
                                                    key={i}
                                                    style={{ gap: 10 }}
                                                >
                                                    {i === 0 ? (
                                                        <Text
                                                            style={{
                                                                color: c.fg,
                                                                fontWeight:
                                                                    '700',
                                                            }}
                                                        >
                                                            {t('agreement.you')}
                                                        </Text>
                                                    ) : (
                                                        text(
                                                            `${t('agreement.djName')} ${i}`,
                                                            person.name,
                                                            (name) =>
                                                                setA(
                                                                    (
                                                                        current,
                                                                    ) => ({
                                                                        ...current,
                                                                        participants:
                                                                            current.participants.map(
                                                                                (
                                                                                    p,
                                                                                    j,
                                                                                ) =>
                                                                                    i ===
                                                                                    j
                                                                                        ? {
                                                                                              ...p,
                                                                                              name,
                                                                                          }
                                                                                        : p,
                                                                            ),
                                                                    }),
                                                                ),
                                                        )
                                                    )}
                                                    {(a.split === 'percent' ||
                                                        (a.split === 'fixed' &&
                                                            i > 0)) &&
                                                        number(
                                                            `share.${i}`,
                                                            `${t(a.split === 'percent' ? 'agreement.sharePercent' : 'agreement.shareFixed')} · ${person.name || t('agreement.you')}`,
                                                            person.share,
                                                            (share) =>
                                                                setA(
                                                                    (
                                                                        current,
                                                                    ) => ({
                                                                        ...current,
                                                                        participants:
                                                                            current.participants.map(
                                                                                (
                                                                                    p,
                                                                                    j,
                                                                                ) =>
                                                                                    i ===
                                                                                    j
                                                                                        ? {
                                                                                              ...p,
                                                                                              share,
                                                                                          }
                                                                                        : p,
                                                                            ),
                                                                    }),
                                                                ),
                                                        )}
                                                    {i > 0 &&
                                                        link(
                                                            t(
                                                                'agreement.removeDj',
                                                            ),
                                                            () => {
                                                                setDrafts({});
                                                                setA(
                                                                    (
                                                                        current,
                                                                    ) => ({
                                                                        ...current,
                                                                        participants:
                                                                            current.participants.filter(
                                                                                (
                                                                                    _,
                                                                                    j,
                                                                                ) =>
                                                                                    i !==
                                                                                    j,
                                                                            ),
                                                                    }),
                                                                );
                                                            },
                                                        )}
                                                </View>
                                            ))}
                                            {a.participants.length < 20 &&
                                                link(t('agreement.addDj'), () =>
                                                    setA((current) => ({
                                                        ...current,
                                                        participants: [
                                                            ...current.participants,
                                                            {
                                                                name: '',
                                                                share: 0,
                                                            },
                                                        ],
                                                    })),
                                                )}
                                            <Text
                                                style={{
                                                    color: c.muted,
                                                    fontSize: 12,
                                                    lineHeight: 18,
                                                }}
                                            >
                                                {t('conditionalFlow.splitHint')}
                                            </Text>
                                        </>
                                    )}
                                </View>
                                <View
                                    style={{
                                        padding: 20,
                                        borderRadius: 20,
                                        backgroundColor: c.tint,
                                        gap: 12,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: c.fg,
                                            fontWeight: '800',
                                            fontSize: 17,
                                        }}
                                    >
                                        {t('conditionalFlow.summary')}
                                    </Text>
                                    <Text
                                        style={{
                                            color: c.fg,
                                            lineHeight: 23,
                                        }}
                                    >
                                        {summary || modelLabel}
                                    </Text>
                                    {link(t('conditionalFlow.trySales'), () =>
                                        navigate('forecast'),
                                    )}
                                </View>
                                {a.settled && (
                                    <Text
                                        style={{
                                            color: c.muted,
                                            lineHeight: 19,
                                            fontSize: 12,
                                        }}
                                    >
                                        {t('conditionalFlow.editSettledHint')}
                                    </Text>
                                )}
                            </>
                        )}
                    </>
                ) : (
                    <>
                        {link(t('conditionalFlow.backAgreement'), () =>
                            navigate('terms'),
                        )}
                        <View
                            style={{
                                backgroundColor: c.tint,
                                borderRadius: 18,
                                padding: 16,
                                gap: 8,
                            }}
                        >
                            <Text
                                style={{
                                    color: c.accent,
                                    fontWeight: '800',
                                }}
                            >
                                {modelLabel}
                            </Text>
                            <Text style={{ color: c.fg, lineHeight: 22 }}>
                                {summary}
                            </Text>
                        </View>
                        {ticketsNeeded &&
                            section(
                                t('conditional.ticketSales'),
                                <>
                                    {a.tickets.map((row, i) => (
                                        <View key={i} style={{ gap: 12 }}>
                                            <Text
                                                style={{
                                                    color: c.fg,
                                                    fontWeight: '700',
                                                }}
                                            >
                                                {row.name} · {money(row.price)}
                                            </Text>
                                            {number(
                                                `${dataKey}.qty.${i}`,
                                                t(
                                                    mode === 'actual'
                                                        ? 'conditionalFlow.sold'
                                                        : 'conditionalFlow.expected',
                                                ),
                                                mode === 'actual'
                                                    ? row.sold
                                                    : row.estimate,
                                                (n) =>
                                                    changeRow(
                                                        i,
                                                        mode === 'actual'
                                                            ? { sold: n }
                                                            : {
                                                                  estimate: n,
                                                              },
                                                    ),
                                                true,
                                            )}
                                            {mode === 'actual' &&
                                                adjustments && (
                                                    <>
                                                        {number(
                                                            `refund.${i}`,
                                                            t(
                                                                'conditional.refunded',
                                                            ),
                                                            row.refunded,
                                                            (n) =>
                                                                changeRow(i, {
                                                                    refunded: n,
                                                                }),
                                                            true,
                                                        )}
                                                        {number(
                                                            `invited.${i}`,
                                                            t(
                                                                'conditional.invited',
                                                            ),
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
                                    {mode === 'actual' &&
                                        !adjustments &&
                                        link(
                                            t('conditionalFlow.addRefunds'),
                                            () => setAdjustments(true),
                                        )}
                                    {mode === 'actual' && (
                                        <Text
                                            style={{
                                                color: c.muted,
                                                fontSize: 12,
                                                lineHeight: 18,
                                            }}
                                        >
                                            {t('conditionalFlow.refundHint')}
                                        </Text>
                                    )}
                                    {a.ticketBasis === 'net' &&
                                        a.ticketMode !== 'dj_fixed' &&
                                        dataField('ticketDeductions')}
                                </>,
                            )}
                        {a.barPercent > 0 &&
                            section(
                                t('conditionalFlow.barQuestion'),
                                <>
                                    {dataField('bar')}
                                    {a.barBasis === 'net' &&
                                        dataField('barDeductions')}
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
                        {extras.includes('expenses')
                            ? section(t('conditional.costs'), expenseFields())
                            : link(t('conditionalFlow.addExpenses'), () =>
                                  setExtras((current) => [
                                      ...current,
                                      'expenses',
                                  ]),
                              )}
                        <View
                            style={{
                                padding: 20,
                                borderRadius: 22,
                                backgroundColor: c.card,
                                borderWidth: 1,
                                borderColor: c.border,
                                gap: 14,
                            }}
                        >
                            <Text style={{ color: c.muted, fontSize: 13 }}>
                                {t(
                                    mode === 'actual'
                                        ? 'conditionalFlow.yourResult'
                                        : 'conditionalFlow.yourEstimate',
                                )}
                            </Text>
                            {result ? (
                                <>
                                    <Text
                                        style={{
                                            color: c.accent,
                                            fontSize: 36,
                                            fontWeight: '800',
                                        }}
                                    >
                                        {money(result.owner)}
                                    </Text>
                                    {[
                                        ['ticketGross', result.ticketGross],
                                        [
                                            'venueRetention',
                                            result.venueRetention,
                                        ],
                                        [
                                            'ticketDeductions',
                                            a.ticketBasis === 'net'
                                                ? data.ticketDeductions
                                                : 0,
                                        ],
                                        ['ticketsFee', result.tickets],
                                        [
                                            'barDeductions',
                                            a.barBasis === 'net'
                                                ? data.barDeductions
                                                : 0,
                                        ],
                                        ['barFee', result.bar],
                                        ['fixed', result.fixed],
                                        ['bonusAmount', result.bonus],
                                        ['expenses', result.expenses],
                                        [
                                            'minimumApplied',
                                            result.minimumAdjustment,
                                        ],
                                        ['capApplied', result.capAdjustment],
                                        ['pool', result.total],
                                    ]
                                        .filter(
                                            ([, amount]) => Number(amount) > 0,
                                        )
                                        .map(([key, amount]) => (
                                            <View
                                                key={String(key)}
                                                style={{
                                                    flexDirection: 'row',
                                                    justifyContent:
                                                        'space-between',
                                                    gap: 12,
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        color: c.muted,
                                                        flex: 1,
                                                    }}
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
                                    {a.participants.length > 1 &&
                                        result.shares.map((share, i) => (
                                            <View
                                                key={i}
                                                style={{
                                                    flexDirection: 'row',
                                                    gap: 12,
                                                    justifyContent:
                                                        'space-between',
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        color: c.fg,
                                                        flex: 1,
                                                    }}
                                                >
                                                    {a.participants[i].name ||
                                                        t('agreement.you')}
                                                </Text>
                                                <Text
                                                    style={{
                                                        color: c.fg,
                                                        fontWeight: '800',
                                                    }}
                                                >
                                                    {money(share)}
                                                </Text>
                                            </View>
                                        ))}
                                </>
                            ) : (
                                <Text
                                    accessibilityRole="alert"
                                    style={{
                                        color: c.muted,
                                        lineHeight: 20,
                                    }}
                                >
                                    {t(calculationError)}
                                </Text>
                            )}
                        </View>
                        {mode === 'actual' && (
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 12,
                                    lineHeight: 18,
                                }}
                            >
                                {t('conditionalFlow.notPaid')}
                            </Text>
                        )}
                    </>
                )}
                {!!error && (
                    <Text
                        accessibilityRole="alert"
                        style={{ color: '#dc4545', lineHeight: 20 }}
                    >
                        {t(error)}
                    </Text>
                )}
            </ScrollView>
            {!keyboard && (
                <View
                    style={{
                        padding: 20,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderColor: c.border,
                    }}
                >
                    <CommunityButton
                        busy={busy}
                        disabled={busy || (!model && mode === 'terms')}
                        label={t(
                            mode === 'actual'
                                ? 'conditionalFlow.saveResult'
                                : mode === 'forecast'
                                  ? 'conditionalFlow.backAgreement'
                                  : 'conditional.saveTerms',
                        )}
                        onPress={() => {
                            if (mode === 'forecast') navigate('terms');
                            else void save();
                        }}
                    />
                </View>
            )}
        </SafeAreaView>
    );
    if (presentation === 'screen') return content;
    return (
        <Modal
            visible
            animationType="slide"
            onRequestClose={() => {
                if (!busy) onClose();
            }}
        >
            {content}
        </Modal>
    );
}
