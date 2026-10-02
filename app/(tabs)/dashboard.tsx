import { PageHeader } from '../../src/components/ui/PageHeader';
import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    AppState,
    RefreshControl,
    StyleSheet,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowUpRight,
    ChevronLeft,
    ChevronRight,
    CalendarDays,
    Clock3,
    MapPin,
    TrendingUp,
    Wallet,
    Music2,
    AlertCircle,
} from 'lucide-react-native';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAllSessionsQuery } from '../../src/hooks/useSessionsQuery';
import { useVenuesQuery } from '../../src/hooks/useVenuesQuery';
import { useAllExpensesQuery } from '../../src/hooks/useExpensesQuery';
import {
    dashboardInsights,
    dashboardMetrics,
    dashboardChart,
    currencyCode,
    DashboardPeriod,
} from '../../src/utils/dashboardMetrics';
import { sessionRange } from '../../src/utils/sessionPlanning';

type Icon = typeof Clock3;
function MetricCard({
    label,
    value,
    hint,
    icon: IconComponent,
    accent,
    dark,
}: {
    label: string;
    value: string;
    hint?: string;
    icon: Icon;
    accent: string;
    dark: boolean;
}) {
    return (
        <View
            style={[
                styles.metric,
                {
                    backgroundColor: dark ? '#171d2c' : '#fff',
                    borderColor: dark ? '#252d40' : '#e9ecf3',
                },
            ]}
        >
            <View style={[styles.iconBox, { backgroundColor: `${accent}15` }]}>
                <IconComponent size={19} color={accent} />
            </View>
            <Text
                style={[styles.label, { color: dark ? '#a8b2c6' : '#6d7588' }]}
            >
                {label}
            </Text>
            <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                style={[
                    styles.metricValue,
                    { color: dark ? '#f6f7fb' : '#182039' },
                ]}
            >
                {value}
            </Text>
            {hint ? (
                <Text
                    style={[
                        styles.hint,
                        { color: dark ? '#9aa6bd' : '#778095' },
                    ]}
                >
                    {hint}
                </Text>
            ) : null}
        </View>
    );
}
export default function DashboardScreen() {
    const { t, i18n } = useTranslation();
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    const router = useRouter();
    const { width } = useWindowDimensions();
    const [period, setPeriod] = useState<DashboardPeriod>('month');
    const [anchor, setAnchor] = useState(() => new Date());
    const [chosenCurrency, setCurrency] = useState('EUR');
    const [chartMode, setChartMode] = useState<'count' | 'revenue'>('count');
    const [refreshing, setRefreshing] = useState(false);
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60_000);
        const listener = AppState.addEventListener('change', (state) => {
            if (state === 'active') setNow(new Date());
        });
        return () => {
            clearInterval(timer);
            listener.remove();
        };
    }, []);
    const sessionsQuery = useAllSessionsQuery();
    const expensesQuery = useAllExpensesQuery();
    const venuesQuery = useVenuesQuery();
    const [expandedCity, setExpandedCity] = useState<string | null>(null);
    const sessions = sessionsQuery.data;
    const expenses = expensesQuery.data;
    const text = dark ? '#f6f7fb' : '#182039';
    const muted = dark ? '#a8b2c6' : '#6d7588';
    const surface = dark ? '#171d2c' : '#fff';
    const line = dark ? '#252d40' : '#e9ecf3';
    const label = (key: string) => t(`insights.${key}`);
    const currencies = useMemo(() => {
        const values = [
            ...new Set([
                ...(sessions || [])
                    .filter(
                        (s) =>
                            s.status !== 'cancelled' &&
                            s.earning_type !== 'free',
                    )
                    .map((s) => currencyCode(s.currency)),
                ...(expenses?.length ? ['EUR'] : []),
            ]),
        ].sort();
        return values.length ? values : ['EUR'];
    }, [sessions, expenses]);
    const currency = currencies.includes(chosenCurrency)
        ? chosenCurrency
        : currencies[0];
    const metrics = useMemo(
        () =>
            dashboardMetrics(
                sessions || [],
                expenses || [],
                anchor,
                period,
                currency,
                now,
            ),
        [sessions, expenses, anchor, period, currency, now],
    );
    const insights = useMemo(
        () =>
            dashboardInsights(
                sessions || [],
                venuesQuery.data || [],
                anchor,
                period,
                currency,
                now,
            ),
        [sessions, venuesQuery.data, anchor, period, currency, now],
    );
    const previous = useMemo(
        () =>
            dashboardMetrics(
                sessions || [],
                expenses || [],
                period === 'month'
                    ? new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1)
                    : new Date(anchor.getFullYear() - 1, 0, 1),
                period,
                currency,
                now,
            ),
        [sessions, expenses, anchor, period, currency, now],
    );
    const chart = useMemo(
        () => dashboardChart(sessions || [], anchor, period, currency),
        [sessions, anchor, period, currency],
    );
    const nextSession = useMemo(
        () =>
            (sessions || [])
                .filter(
                    (s) =>
                        s.status !== 'cancelled' && sessionRange(s).end > now,
                )
                .sort(
                    (a, b) =>
                        sessionRange(a).start.getTime() -
                        sessionRange(b).start.getTime(),
                )[0],
        [sessions, now],
    );
    const pending = useMemo(
        () => [...metrics.pending].sort((a, b) => a.date.localeCompare(b.date)),
        [metrics.pending],
    );
    const number = (n: number, digits = 0) =>
        new Intl.NumberFormat(i18n.language, {
            maximumFractionDigits: digits,
        }).format(n);
    const money = (n: number, decimals = 0) => {
        try {
            return new Intl.NumberFormat(i18n.language, {
                style: 'currency',
                currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: decimals,
            }).format(n);
        } catch {
            return `${number(n)} ${currency}`;
        }
    };
    const dateLabel = new Intl.DateTimeFormat(i18n.language, {
        ...(period === 'month' ? { month: 'long' as const } : {}),
        year: 'numeric',
    }).format(anchor);
    const growth =
        previous.revenue > 0
            ? Math.round(
                  ((metrics.revenue - previous.revenue) / previous.revenue) *
                      100,
              )
            : null;
    const maxChart = Math.max(1, ...chart.map((b) => b[chartMode]));
    const shift = (direction: number) =>
        setAnchor(
            new Date(
                anchor.getFullYear() + (period === 'year' ? direction : 0),
                anchor.getMonth() + (period === 'month' ? direction : 0),
                1,
            ),
        );
    const refresh = async () => {
        setNow(new Date());
        setRefreshing(true);
        try {
            await Promise.all([
                sessionsQuery.refetch(),
                expensesQuery.refetch(),
                venuesQuery.refetch(),
            ]);
        } finally {
            setRefreshing(false);
        }
    };
    const cardStyle = [
        styles.card,
        { backgroundColor: surface, borderColor: line },
    ];
    const heading = (title: string, hint?: string) => (
        <View style={{ marginBottom: 20 }}>
            <Text style={[styles.sectionTitle, { color: text }]}>{title}</Text>
            {hint ? (
                <Text style={[styles.hint, { color: muted, marginTop: 5 }]}>
                    {hint}
                </Text>
            ) : null}
        </View>
    );
    const errorBanner = (
        <View style={[cardStyle, { gap: 12 }]}>
            <AlertCircle color="#f59e0b" size={22} />
            <Text style={{ color: text }}>{label('loadingError')}</Text>
            <TouchableOpacity
                accessibilityRole="button"
                onPress={refresh}
                style={styles.retry}
            >
                <Text style={{ color: '#6366f1', fontWeight: '700' }}>
                    {label('retry')}
                </Text>
            </TouchableOpacity>
        </View>
    );
    if (sessionsQuery.isLoading)
        return (
            <SafeAreaView
                style={[
                    styles.screen,
                    { backgroundColor: dark ? '#0d1220' : '#f5f6fa' },
                ]}
                edges={['top']}
            >
                <PageHeader title={t('dashboard')} subtitle={label('intro')} />
                <View style={{ paddingHorizontal: 24, gap: 18 }}>
                    <View
                        style={{
                            height: 190,
                            borderRadius: 28,
                            backgroundColor: dark ? '#20273b' : '#e4e7f0',
                            justifyContent: 'center',
                        }}
                    >
                        <ActivityIndicator color="#7773ff" />
                    </View>
                </View>
            </SafeAreaView>
        );
    return (
        <SafeAreaView
            style={[
                styles.screen,
                { backgroundColor: dark ? '#0d1220' : '#f5f6fa' },
            ]}
            edges={['top']}
        >
            <PageHeader title={t('dashboard')} subtitle={label('intro')} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor="#7773ff"
                    />
                }
                contentContainerStyle={{
                    paddingHorizontal: width > 700 ? 32 : 20,
                    paddingBottom: 115,
                    width: '100%',
                    maxWidth: 900,
                    alignSelf: 'center',
                    gap: 18,
                }}
            >
                <View
                    style={[
                        styles.controls,
                        { backgroundColor: surface, borderColor: line },
                    ]}
                >
                    <View
                        style={[
                            styles.segment,
                            { backgroundColor: dark ? '#0d1220' : '#f0f2f7' },
                        ]}
                    >
                        {(['month', 'year'] as const).map((p) => (
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityState={{ selected: period === p }}
                                key={p}
                                onPress={() => setPeriod(p)}
                                style={[
                                    styles.segmentButton,
                                    period === p && {
                                        backgroundColor: dark
                                            ? '#34304f'
                                            : '#fff',
                                    },
                                ]}
                            >
                                <Text
                                    style={{
                                        color:
                                            period === p
                                                ? dark
                                                    ? '#c0b7ff'
                                                    : '#6354d9'
                                                : muted,
                                        fontWeight: '700',
                                        fontSize: 13,
                                    }}
                                >
                                    {label(p)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={styles.periodRow}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={label('previous')}
                            onPress={() => shift(-1)}
                            style={styles.arrow}
                        >
                            <ChevronLeft size={20} color={muted} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={label('current')}
                            onPress={() => setAnchor(new Date())}
                            style={{ flex: 1, alignItems: 'center' }}
                        >
                            <Text
                                style={{
                                    color: text,
                                    fontSize: 16,
                                    fontWeight: '700',
                                    textTransform: 'capitalize',
                                }}
                            >
                                {dateLabel}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={label('next')}
                            onPress={() => shift(1)}
                            style={styles.arrow}
                        >
                            <ChevronRight size={20} color={muted} />
                        </TouchableOpacity>
                    </View>
                </View>
                {currencies.length > 1 ? (
                    <View style={{ gap: 8 }}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 8 }}
                        >
                            {currencies.map((c) => (
                                <TouchableOpacity
                                    key={c}
                                    accessibilityRole="button"
                                    accessibilityState={{
                                        selected: c === currency,
                                    }}
                                    onPress={() => setCurrency(c)}
                                    style={[
                                        styles.currency,
                                        {
                                            backgroundColor:
                                                c === currency
                                                    ? '#6554df'
                                                    : surface,
                                            borderColor:
                                                c === currency
                                                    ? '#6554df'
                                                    : line,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={{
                                            color:
                                                c === currency ? '#fff' : muted,
                                            fontWeight: '700',
                                            fontSize: 12,
                                        }}
                                    >
                                        {c}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <Text style={[styles.hint, { color: muted }]}>
                            {label('totalsHint')}
                        </Text>
                    </View>
                ) : null}
                {sessionsQuery.isError ? (
                    errorBanner
                ) : (
                    <>
                        {expensesQuery.isError ? errorBanner : null}
                        <LinearGradient
                            colors={['#202044', '#35316e', '#6250bb']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.hero}
                        >
                            <View style={styles.heroOrb} pointerEvents="none" />
                            <View style={styles.heroTop}>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        gap: 8,
                                        alignItems: 'center',
                                    }}
                                >
                                    <TrendingUp color="#c4baff" size={19} />
                                    <Text
                                        style={{
                                            color: '#e1dcff',
                                            fontWeight: '600',
                                            fontSize: 14,
                                        }}
                                    >
                                        {label('revenue')}
                                    </Text>
                                </View>
                                <Text style={styles.heroCurrency}>
                                    {currency}
                                </Text>
                            </View>
                            <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.6}
                                style={styles.heroValue}
                            >
                                {money(metrics.revenue)}
                            </Text>
                            <Text
                                style={{
                                    color: '#c7c1e7',
                                    fontSize: 12,
                                    lineHeight: 18,
                                }}
                            >
                                {label('revenueHint')}
                            </Text>
                            <View style={styles.heroBottom}>
                                <View style={styles.growth}>
                                    <Text
                                        style={{
                                            color:
                                                growth !== null && growth < 0
                                                    ? '#ffd4e2'
                                                    : '#c6f7e4',
                                            fontSize: 12,
                                            fontWeight: '700',
                                        }}
                                    >
                                        {growth === null
                                            ? label('noComparison')
                                            : `${growth > 0 ? '+' : ''}${growth}%`}
                                    </Text>
                                </View>
                                <Text
                                    style={{
                                        color: '#cec9ea',
                                        fontSize: 11,
                                        flex: 1,
                                    }}
                                >
                                    {label('previousPeriod')}
                                </Text>
                            </View>
                            {metrics.tentativeRevenue > 0 ? (
                                <Text
                                    style={{
                                        color: '#d9d2f5',
                                        fontSize: 12,
                                        marginTop: 13,
                                    }}
                                >
                                    {label('potential')}:{' '}
                                    {money(metrics.tentativeRevenue)}
                                </Text>
                            ) : null}
                        </LinearGradient>
                        <View style={cardStyle}>
                            {heading(label('next30'), label('next30Hint'))}
                            <View
                                style={{
                                    flexDirection: 'row',
                                    gap: 15,
                                    flexWrap: 'wrap',
                                }}
                            >
                                {[
                                    {
                                        name: label('sessions'),
                                        value: number(insights.nextSessions),
                                    },
                                    {
                                        name: label('hours'),
                                        value: `${number(insights.nextHours, 1)} h`,
                                    },
                                    {
                                        name: label('revenue'),
                                        value: money(insights.nextRevenue),
                                    },
                                ].map((item) => (
                                    <View
                                        key={item.name}
                                        style={{
                                            flex: 1,
                                            minWidth: 80,
                                            gap: 7,
                                        }}
                                    >
                                        <Text
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                            style={{
                                                color: text,
                                                fontSize: 24,
                                                fontWeight: '800',
                                            }}
                                        >
                                            {item.value}
                                        </Text>
                                        <Text
                                            style={{
                                                color: muted,
                                                fontSize: 11,
                                            }}
                                        >
                                            {item.name}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                            <Text
                                style={[
                                    styles.hint,
                                    { color: muted, marginTop: 16 },
                                ]}
                            >
                                {insights.nextPending}{' '}
                                {label('pending').toLowerCase()}
                            </Text>
                        </View>
                        <View style={styles.grid}>
                            <MetricCard
                                label={label('sessions')}
                                value={number(metrics.active.length)}
                                hint={`${metrics.confirmed.length} ${label('confirmed').toLowerCase()} · ${metrics.pending.length} ${label('pending').toLowerCase()}`}
                                icon={CalendarDays}
                                accent="#7666df"
                                dark={dark}
                            />
                            <MetricCard
                                label={label('hours')}
                                value={`${number(metrics.hours, 1)} h`}
                                hint={`${number(metrics.playedHours, 1)} h ${label('played').toLowerCase()}`}
                                icon={Clock3}
                                accent="#099a91"
                                dark={dark}
                            />
                            <MetricCard
                                label={label('average')}
                                value={
                                    metrics.averageFee === null
                                        ? '—'
                                        : money(metrics.averageFee)
                                }
                                hint={label('averageHint')}
                                icon={Music2}
                                accent="#c46599"
                                dark={dark}
                            />
                            <MetricCard
                                label={label('balance')}
                                value={
                                    expensesQuery.isLoading ||
                                    expensesQuery.isError ||
                                    metrics.balance === null
                                        ? '—'
                                        : money(metrics.balance)
                                }
                                hint={
                                    currency === 'EUR'
                                        ? label('balanceHint')
                                        : label('eurosOnly')
                                }
                                icon={Wallet}
                                accent="#b58b37"
                                dark={dark}
                            />
                        </View>
                        <View style={cardStyle}>
                            {heading(
                                label('activity'),
                                period === 'year'
                                    ? String(anchor.getFullYear())
                                    : label('sixMonths'),
                            )}
                            <View
                                style={[
                                    styles.segment,
                                    {
                                        backgroundColor: dark
                                            ? '#0d1220'
                                            : '#f0f2f7',
                                        marginBottom: 22,
                                    },
                                ]}
                            >
                                {(['count', 'revenue'] as const).map((mode) => (
                                    <TouchableOpacity
                                        key={mode}
                                        accessibilityRole="button"
                                        accessibilityState={{
                                            selected: chartMode === mode,
                                        }}
                                        onPress={() => setChartMode(mode)}
                                        style={[
                                            styles.segmentButton,
                                            mode === chartMode && {
                                                backgroundColor: dark
                                                    ? '#34304f'
                                                    : '#fff',
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={{
                                                color:
                                                    mode === chartMode
                                                        ? dark
                                                            ? '#c0b7ff'
                                                            : '#6354d9'
                                                        : muted,
                                                fontWeight: '700',
                                                fontSize: 12,
                                            }}
                                        >
                                            {mode === 'count'
                                                ? label('sessions')
                                                : label('revenue')}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ flexGrow: 1, gap: 10 }}
                            >
                                {chart.map((bucket, index) => {
                                    const selected =
                                        bucket.date.getMonth() ===
                                        anchor.getMonth();
                                    const value = bucket[chartMode];
                                    return (
                                        <View
                                            key={bucket.date.toISOString()}
                                            accessible
                                            accessibilityLabel={`${new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(bucket.date)}: ${chartMode === 'count' ? number(value) : money(value)}`}
                                            style={{
                                                flex: 1,
                                                minWidth:
                                                    period === 'year' ? 42 : 32,
                                                alignItems: 'center',
                                            }}
                                        >
                                            <View
                                                style={{
                                                    height: 112,
                                                    width: '100%',
                                                    maxWidth: 40,
                                                    justifyContent: 'flex-end',
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        height: value
                                                            ? Math.max(
                                                                  5,
                                                                  (value /
                                                                      maxChart) *
                                                                      104,
                                                              )
                                                            : 3,
                                                        borderRadius: 8,
                                                        backgroundColor:
                                                            selected
                                                                ? '#7462e3'
                                                                : dark
                                                                  ? '#343955'
                                                                  : '#dcd9f1',
                                                    }}
                                                />
                                            </View>
                                            <Text
                                                style={{
                                                    color: selected
                                                        ? '#8b78f0'
                                                        : muted,
                                                    marginTop: 10,
                                                    fontSize: 11,
                                                    fontWeight: selected
                                                        ? '800'
                                                        : '500',
                                                }}
                                            >
                                                {new Intl.DateTimeFormat(
                                                    i18n.language,
                                                    { month: 'short' },
                                                )
                                                    .format(bucket.date)
                                                    .replace('.', '')}
                                            </Text>
                                            <Text
                                                numberOfLines={1}
                                                adjustsFontSizeToFit
                                                style={{
                                                    color: text,
                                                    fontSize: 10,
                                                    marginTop: 5,
                                                }}
                                            >
                                                {chartMode === 'count'
                                                    ? number(value)
                                                    : money(value)}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                            <Text
                                style={[
                                    styles.hint,
                                    { color: muted, marginTop: 18 },
                                ]}
                            >
                                {label('chartHint')}
                            </Text>
                        </View>
                        {metrics.selected.length === 0 ? (
                            <View
                                style={[
                                    cardStyle,
                                    { alignItems: 'center', gap: 12 },
                                ]}
                            >
                                <CalendarDays size={32} color="#8d7ce3" />
                                <Text
                                    style={[
                                        styles.sectionTitle,
                                        { color: text },
                                    ]}
                                >
                                    {label('emptyTitle')}
                                </Text>
                                <Text
                                    style={[
                                        styles.hint,
                                        { color: muted, textAlign: 'center' },
                                    ]}
                                >
                                    {label('emptyBody')}
                                </Text>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    onPress={() => router.push('/add-session')}
                                    style={styles.primaryButton}
                                >
                                    <Text
                                        style={{
                                            color: '#fff',
                                            fontWeight: '700',
                                        }}
                                    >
                                        {label('add')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}
                        <View style={cardStyle}>
                            {heading(label('statusTitle'))}
                            <View
                                style={{
                                    height: 8,
                                    borderRadius: 5,
                                    overflow: 'hidden',
                                    flexDirection: 'row',
                                    backgroundColor: line,
                                }}
                            >
                                {metrics.selected.length
                                    ? [
                                          {
                                              count: metrics.confirmed.length,
                                              color: '#8b78e6',
                                          },
                                          {
                                              count: metrics.pending.length,
                                              color: '#e9ad50',
                                          },
                                          {
                                              count: metrics.cancelled,
                                              color: '#dca0b8',
                                          },
                                      ].map((s, index) =>
                                          s.count ? (
                                              <View
                                                  key={index}
                                                  style={{
                                                      flex: s.count,
                                                      backgroundColor: s.color,
                                                  }}
                                              />
                                          ) : null,
                                      )
                                    : null}
                            </View>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    gap: 10,
                                    marginTop: 18,
                                }}
                            >
                                {[
                                    {
                                        key: 'confirmed',
                                        count: metrics.confirmed.length,
                                        color: '#8b78e6',
                                    },
                                    {
                                        key: 'pending',
                                        count: metrics.pending.length,
                                        color: '#e9ad50',
                                    },
                                    {
                                        key: 'cancelled',
                                        count: metrics.cancelled,
                                        color: '#dca0b8',
                                    },
                                ].map((s) => (
                                    <View key={s.key} style={{ flex: 1 }}>
                                        <Text
                                            style={{
                                                fontSize: 23,
                                                color: text,
                                                fontWeight: '800',
                                            }}
                                        >
                                            {s.count}
                                        </Text>
                                        <Text
                                            style={{
                                                fontSize: 11,
                                                color: muted,
                                                marginTop: 5,
                                            }}
                                        >
                                            {label(s.key)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                            <View style={[styles.facts, { borderColor: line }]}>
                                <Text style={{ color: muted, fontSize: 12 }}>
                                    {label('venues')}:{' '}
                                    <Text
                                        style={{
                                            color: text,
                                            fontWeight: '700',
                                        }}
                                    >
                                        {metrics.venueCount}
                                    </Text>
                                </Text>
                                <Text style={{ color: muted, fontSize: 12 }}>
                                    {label('perHour')}:{' '}
                                    <Text
                                        style={{
                                            color: text,
                                            fontWeight: '700',
                                        }}
                                    >
                                        {metrics.hourlyFee === null
                                            ? '—'
                                            : money(metrics.hourlyFee, 2)}
                                    </Text>
                                </Text>
                            </View>
                        </View>
                        <View style={cardStyle}>
                            {heading(
                                label('patterns'),
                                label('selectedPeriod'),
                            )}
                            <View style={styles.grid}>
                                <MetricCard
                                    label={label('averageDuration')}
                                    value={
                                        insights.averageDuration === null
                                            ? '—'
                                            : `${number(insights.averageDuration, 1)} h`
                                    }
                                    icon={Clock3}
                                    accent="#099a91"
                                    dark={dark}
                                />
                                <MetricCard
                                    label={label('repeatVenues')}
                                    value={
                                        insights.repeatRate === null
                                            ? '—'
                                            : `${number(insights.repeatRate)}%`
                                    }
                                    hint={label('repeatHint')}
                                    icon={MapPin}
                                    accent="#7666df"
                                    dark={dark}
                                />
                                <MetricCard
                                    label={label('cancellationRate')}
                                    value={
                                        insights.cancellationRate === null
                                            ? '—'
                                            : `${number(insights.cancellationRate)}%`
                                    }
                                    hint={`${metrics.cancelled} / ${metrics.selected.length} ${label('sessions').toLowerCase()}`}
                                    icon={AlertCircle}
                                    accent="#c46599"
                                    dark={dark}
                                />
                                <MetricCard
                                    label={label('paidSessions')}
                                    value={
                                        metrics.active.length
                                            ? `${number((insights.paid / metrics.active.length) * 100)}%`
                                            : '—'
                                    }
                                    hint={`${insights.paid} ${label('paid').toLowerCase()} · ${insights.free} ${label('free').toLowerCase()}${insights.unpriced ? ` · ${insights.unpriced} ${label('unpriced')}` : ''}`}
                                    icon={Wallet}
                                    accent="#b58b37"
                                    dark={dark}
                                />
                            </View>
                            <Text
                                style={[
                                    styles.sectionTitle,
                                    {
                                        color: text,
                                        marginTop: 24,
                                        fontSize: 15,
                                    },
                                ]}
                            >
                                {label('busyDays')}
                            </Text>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    gap: 8,
                                    marginTop: 18,
                                }}
                            >
                                {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                                    const value = insights.weekdays[day].count;
                                    const max = Math.max(
                                        1,
                                        ...insights.weekdays.map(
                                            (d) => d.count,
                                        ),
                                    );
                                    return (
                                        <View
                                            key={day}
                                            style={{
                                                flex: 1,
                                                alignItems: 'center',
                                            }}
                                            accessible
                                            accessibilityLabel={`${new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }).format(new Date(2024, 0, 7 + day))}: ${value}`}
                                        >
                                            <View
                                                style={{
                                                    height: 58,
                                                    width: '100%',
                                                    justifyContent: 'flex-end',
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        height: value
                                                            ? Math.max(
                                                                  4,
                                                                  (value /
                                                                      max) *
                                                                      58,
                                                              )
                                                            : 3,
                                                        backgroundColor:
                                                            value === max
                                                                ? '#8b78e6'
                                                                : dark
                                                                  ? '#343955'
                                                                  : '#dcd9f1',
                                                        borderRadius: 6,
                                                    }}
                                                />
                                            </View>
                                            <Text
                                                style={{
                                                    color: muted,
                                                    fontSize: 10,
                                                    marginTop: 9,
                                                }}
                                            >
                                                {new Intl.DateTimeFormat(
                                                    i18n.language,
                                                    { weekday: 'short' },
                                                )
                                                    .format(
                                                        new Date(
                                                            2024,
                                                            0,
                                                            7 + day,
                                                        ),
                                                    )
                                                    .replace('.', '')}
                                            </Text>
                                            <Text
                                                style={{
                                                    color: text,
                                                    fontSize: 12,
                                                    fontWeight: '700',
                                                    marginTop: 4,
                                                }}
                                            >
                                                {value}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                            {insights.bestRate ? (
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    onPress={() =>
                                        router.push(
                                            insights.bestRate!.id
                                                ? `/venue/${insights.bestRate!.id}`
                                                : '/venues',
                                        )
                                    }
                                    style={[
                                        styles.facts,
                                        { borderColor: line },
                                    ]}
                                >
                                    <View style={{ flex: 1, gap: 5 }}>
                                        <Text
                                            style={{
                                                color: muted,
                                                fontSize: 11,
                                            }}
                                        >
                                            {label('bestRate')}
                                        </Text>
                                        <Text
                                            style={{
                                                color: text,
                                                fontWeight: '700',
                                            }}
                                        >
                                            {insights.bestRate.name}
                                        </Text>
                                    </View>
                                    <Text
                                        style={{
                                            color: '#8b78e6',
                                            fontWeight: '800',
                                            fontSize: 18,
                                        }}
                                    >
                                        {money(insights.bestRate.rate, 2)}/h
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                        <View style={cardStyle}>
                            {heading(label('cities'), label('citiesHint'))}
                            {venuesQuery.isLoading ? (
                                <ActivityIndicator color="#8b78e6" />
                            ) : venuesQuery.isError ? (
                                <>
                                    <Text style={{ color: muted }}>
                                        {label('loadingError')}
                                    </Text>
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        onPress={() => venuesQuery.refetch()}
                                        style={styles.retry}
                                    >
                                        <Text
                                            style={{
                                                color: '#8b78e6',
                                                fontWeight: '700',
                                            }}
                                        >
                                            {label('retry')}
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <Text
                                        style={{
                                            color: text,
                                            fontSize: 29,
                                            fontWeight: '800',
                                            marginBottom: 12,
                                        }}
                                    >
                                        {insights.cities.length}{' '}
                                        <Text
                                            style={{
                                                fontSize: 13,
                                                color: muted,
                                                fontWeight: '500',
                                            }}
                                        >
                                            {label('citiesActive')}
                                        </Text>
                                    </Text>
                                    {insights.cities.map((city) => (
                                        <View key={city.name}>
                                            <TouchableOpacity
                                                accessibilityRole="button"
                                                accessibilityState={{
                                                    expanded:
                                                        expandedCity ===
                                                        city.name,
                                                }}
                                                onPress={() =>
                                                    setExpandedCity(
                                                        expandedCity ===
                                                            city.name
                                                            ? null
                                                            : city.name,
                                                    )
                                                }
                                                style={[
                                                    styles.listRow,
                                                    { borderColor: line },
                                                ]}
                                            >
                                                <View
                                                    style={[
                                                        styles.rank,
                                                        {
                                                            backgroundColor:
                                                                dark
                                                                    ? '#282744'
                                                                    : '#f0edfb',
                                                        },
                                                    ]}
                                                >
                                                    <MapPin
                                                        size={18}
                                                        color="#8b78e6"
                                                    />
                                                </View>
                                                <View
                                                    style={{ flex: 1, gap: 5 }}
                                                >
                                                    <Text
                                                        numberOfLines={1}
                                                        style={{
                                                            color: text,
                                                            fontWeight: '700',
                                                            fontSize: 15,
                                                        }}
                                                    >
                                                        {city.name}
                                                    </Text>
                                                    <Text
                                                        style={{
                                                            color: muted,
                                                            fontSize: 11,
                                                        }}
                                                    >
                                                        {city.count}{' '}
                                                        {label(
                                                            'sessions',
                                                        ).toLowerCase()}{' '}
                                                        ·{' '}
                                                        {number(city.hours, 1)}{' '}
                                                        h
                                                    </Text>
                                                </View>
                                                <Text
                                                    style={{
                                                        color: text,
                                                        fontSize: 13,
                                                        fontWeight: '700',
                                                    }}
                                                >
                                                    {money(city.revenue)}
                                                </Text>
                                                <ChevronRight
                                                    color={muted}
                                                    size={15}
                                                    style={{
                                                        transform: [
                                                            {
                                                                rotate:
                                                                    expandedCity ===
                                                                    city.name
                                                                        ? '90deg'
                                                                        : '0deg',
                                                            },
                                                        ],
                                                    }}
                                                />
                                            </TouchableOpacity>
                                            {expandedCity === city.name
                                                ? [...city.sessions]
                                                      .sort((a, b) =>
                                                          a.date.localeCompare(
                                                              b.date,
                                                          ),
                                                      )
                                                      .map((s) => (
                                                          <TouchableOpacity
                                                              key={s.id}
                                                              accessibilityRole="button"
                                                              onPress={() =>
                                                                  router.push(
                                                                      `/session/${s.id}`,
                                                                  )
                                                              }
                                                              style={{
                                                                  paddingVertical: 13,
                                                                  paddingLeft: 12,
                                                                  flexDirection:
                                                                      'row',
                                                                  gap: 10,
                                                                  alignItems:
                                                                      'center',
                                                              }}
                                                          >
                                                              <View
                                                                  style={{
                                                                      flex: 1,
                                                                      gap: 4,
                                                                  }}
                                                              >
                                                                  <Text
                                                                      style={{
                                                                          color: text,
                                                                          fontSize: 13,
                                                                          fontWeight:
                                                                              '600',
                                                                      }}
                                                                  >
                                                                      {s.title}
                                                                  </Text>
                                                                  <Text
                                                                      style={{
                                                                          color: muted,
                                                                          fontSize: 11,
                                                                      }}
                                                                  >
                                                                      {new Intl.DateTimeFormat(
                                                                          i18n.language,
                                                                          {
                                                                              day: 'numeric',
                                                                              month: 'short',
                                                                          },
                                                                      ).format(
                                                                          new Date(
                                                                              `${s.date.slice(0, 10)}T12:00:00`,
                                                                          ),
                                                                      )}{' '}
                                                                      ·{' '}
                                                                      {s.venue}
                                                                  </Text>
                                                              </View>
                                                              <ArrowUpRight
                                                                  color="#8b78e6"
                                                                  size={17}
                                                              />
                                                          </TouchableOpacity>
                                                      ))
                                                : null}
                                        </View>
                                    ))}
                                    {insights.unknownCity ? (
                                        <TouchableOpacity
                                            accessibilityRole="button"
                                            onPress={() =>
                                                router.push('/venues')
                                            }
                                            style={{
                                                marginTop: 18,
                                                padding: 14,
                                                borderRadius: 14,
                                                backgroundColor: dark
                                                    ? '#282744'
                                                    : '#f0edfb',
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: dark
                                                        ? '#bdb3ec'
                                                        : '#6554b1',
                                                    fontSize: 12,
                                                    lineHeight: 19,
                                                }}
                                            >
                                                {t('insights.missingCity', {
                                                    count: insights.unknownCity,
                                                })}{' '}
                                                · {label('completeVenues')}
                                            </Text>
                                        </TouchableOpacity>
                                    ) : null}
                                    {!insights.cities.length &&
                                    !insights.unknownCity ? (
                                        <Text
                                            style={{
                                                color: muted,
                                                fontSize: 13,
                                            }}
                                        >
                                            {label('noCities')}
                                        </Text>
                                    ) : null}
                                </>
                            )}
                        </View>
                        <View style={cardStyle}>
                            {heading(label('pendingTitle'))}
                            {pending.length ? (
                                pending.slice(0, 3).map((s) => (
                                    <TouchableOpacity
                                        key={s.id}
                                        accessibilityRole="button"
                                        onPress={() =>
                                            router.push(`/session/${s.id}`)
                                        }
                                        style={[
                                            styles.listRow,
                                            { borderColor: line },
                                        ]}
                                    >
                                        <View style={{ flex: 1, gap: 5 }}>
                                            <Text
                                                numberOfLines={1}
                                                style={{
                                                    color: text,
                                                    fontWeight: '700',
                                                    fontSize: 14,
                                                }}
                                            >
                                                {s.title}
                                            </Text>
                                            <Text
                                                style={{
                                                    color: muted,
                                                    fontSize: 12,
                                                }}
                                            >
                                                {new Intl.DateTimeFormat(
                                                    i18n.language,
                                                    {
                                                        day: 'numeric',
                                                        month: 'short',
                                                    },
                                                ).format(
                                                    new Date(
                                                        `${s.date.slice(0, 10)}T12:00:00`,
                                                    ),
                                                )}{' '}
                                                · {s.venue}
                                            </Text>
                                        </View>
                                        <ArrowUpRight
                                            color="#e9ad50"
                                            size={21}
                                        />
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={{ color: muted, fontSize: 13 }}>
                                    {label('noPending')}
                                </Text>
                            )}
                        </View>
                        <View style={cardStyle}>
                            {heading(label('venueTitle'))}
                            {metrics.venues.length ? (
                                metrics.venues.slice(0, 3).map((v, index) => (
                                    <TouchableOpacity
                                        key={v.id || v.name}
                                        accessibilityRole="button"
                                        onPress={() =>
                                            router.push(
                                                v.id
                                                    ? `/venue/${v.id}`
                                                    : '/venues',
                                            )
                                        }
                                        style={[
                                            styles.listRow,
                                            { borderColor: line },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.rank,
                                                {
                                                    backgroundColor: dark
                                                        ? '#282744'
                                                        : '#f0edfb',
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={{
                                                    color: '#8b78e6',
                                                    fontWeight: '800',
                                                }}
                                            >
                                                {String(index + 1).padStart(
                                                    2,
                                                    '0',
                                                )}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1, gap: 5 }}>
                                            <Text
                                                numberOfLines={1}
                                                style={{
                                                    color: text,
                                                    fontWeight: '700',
                                                    fontSize: 14,
                                                }}
                                            >
                                                {v.name}
                                            </Text>
                                            <Text
                                                style={{
                                                    color: muted,
                                                    fontSize: 12,
                                                }}
                                            >
                                                {v.count}{' '}
                                                {label(
                                                    'sessions',
                                                ).toLowerCase()}{' '}
                                                · {money(v.amount)}
                                            </Text>
                                        </View>
                                        <ChevronRight color={muted} size={17} />
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={{ color: muted, fontSize: 13 }}>
                                    {label('noVenues')}
                                </Text>
                            )}
                        </View>
                        <View style={cardStyle}>
                            {heading(label('nextGig'), label('nextGigHint'))}
                            {nextSession ? (
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    onPress={() =>
                                        router.push(
                                            `/session/${nextSession.id}`,
                                        )
                                    }
                                    style={{ gap: 10 }}
                                >
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 10,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: text,
                                                fontSize: 19,
                                                fontWeight: '800',
                                                flex: 1,
                                            }}
                                        >
                                            {nextSession.title}
                                        </Text>
                                        <ArrowUpRight
                                            color="#8b78e6"
                                            size={22}
                                        />
                                    </View>
                                    <Text
                                        style={{ color: muted, fontSize: 13 }}
                                    >
                                        {new Intl.DateTimeFormat(
                                            i18n.language,
                                            {
                                                weekday: 'short',
                                                day: 'numeric',
                                                month: 'short',
                                            },
                                        ).format(
                                            new Date(
                                                `${nextSession.date.slice(0, 10)}T12:00:00`,
                                            ),
                                        )}{' '}
                                        · {nextSession.start_time.slice(0, 5)}–
                                        {nextSession.end_time.slice(0, 5)}
                                    </Text>
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            gap: 6,
                                            alignItems: 'center',
                                        }}
                                    >
                                        <MapPin color={muted} size={14} />
                                        <Text
                                            style={{
                                                color: muted,
                                                fontSize: 13,
                                                flex: 1,
                                            }}
                                        >
                                            {nextSession.venue}
                                        </Text>
                                        <Text
                                            style={{
                                                color:
                                                    nextSession.status ===
                                                    'pending'
                                                        ? '#c48a32'
                                                        : '#8b78e6',
                                                fontSize: 11,
                                                fontWeight: '700',
                                            }}
                                        >
                                            {label(
                                                nextSession.status === 'pending'
                                                    ? 'pending'
                                                    : 'confirmed',
                                            )}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ) : (
                                <Text style={{ color: muted, fontSize: 13 }}>
                                    {label('noUpcoming')}
                                </Text>
                            )}
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
const styles = StyleSheet.create({
    screen: { flex: 1 },
    controls: { borderRadius: 22, padding: 8, borderWidth: 1 },
    segment: { flexDirection: 'row', borderRadius: 14, padding: 4 },
    segmentButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 11,
        minHeight: 42,
    },
    periodRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
    arrow: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    currency: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 22,
        borderWidth: 1,
    },
    hero: { borderRadius: 28, padding: 25, overflow: 'hidden' },
    heroOrb: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 30,
        borderColor: '#ffffff08',
        right: -40,
        bottom: -70,
    },
    heroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
    },
    heroCurrency: {
        color: '#dfd8ff',
        fontSize: 11,
        fontWeight: '800',
        backgroundColor: '#ffffff14',
        borderRadius: 10,
        paddingHorizontal: 9,
        paddingVertical: 6,
    },
    heroValue: {
        fontSize: 46,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -1.5,
        marginTop: 17,
        marginBottom: 7,
    },
    heroBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 22,
    },
    growth: {
        paddingVertical: 6,
        paddingHorizontal: 9,
        backgroundColor: '#ffffff13',
        borderRadius: 9,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    metric: {
        width: '48%',
        flexGrow: 1,
        flexBasis: '45%',
        padding: 18,
        borderRadius: 24,
        borderWidth: 1,
        minHeight: 165,
    },
    iconBox: {
        width: 37,
        height: 37,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    label: { fontSize: 12, fontWeight: '600', marginBottom: 7 },
    metricValue: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.7,
        marginBottom: 6,
    },
    hint: { fontSize: 11, lineHeight: 17 },
    card: { borderRadius: 26, borderWidth: 1, padding: 22 },
    sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
    facts: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        borderTopWidth: 1,
        marginTop: 22,
        paddingTop: 17,
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 65,
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingVertical: 13,
    },
    rank: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButton: {
        paddingVertical: 14,
        paddingHorizontal: 22,
        backgroundColor: '#6554df',
        borderRadius: 15,
        marginTop: 4,
    },
    retry: { minHeight: 44, justifyContent: 'center' },
});
