import { ResearchInvitationCard, ResearchInvitationModal, useResearchInvitation } from '../../src/components/research/ResearchInvitation';
import { useScreenMonitoring } from '../../src/hooks/useScreenMonitoring';
import { StatisticsExport } from '../../src/components/dashboard/StatisticsExport';
import { dashboardAdvancedAnalytics } from '../../src/utils/dashboardAdvancedAnalytics';
import { sessionDisplayTitle } from '../../src/utils/sessionNaming';
import { sessionEarnings } from '../../src/utils/sessionPlanning';
import type { StatisticsReport } from '../../src/utils/statisticsReport';
import { SessionAttendanceBadges } from '../../src/components/sessions/SessionAttendanceBadges';
import { SessionExpenseBadge } from '../../src/components/sessions/SessionExpenses';
import { SessionTaskBadge } from '../../src/components/sessions/SessionTaskBadge';
import { SessionPartialPaymentSummary } from '../../src/components/sessions/SessionPartialPaymentSummary';
import { DashboardAnalytics } from '../../src/components/dashboard/DashboardAnalytics';
import { DashboardProPreview } from '../../src/components/dashboard/DashboardProPreview';
import { useSessionUsage } from '../../src/hooks/useSessionUsage';
import { useSubscription } from '../../src/hooks/useSubscription';
import { useDarkPalette } from '../../src/contexts/ThemeContext';
import { SessionStatusBadge } from '../../src/components/sessions/SessionStatusBadge';
import { useScrollHeader } from '../../src/hooks/useScrollHeader';
import { ScrollPageHeader } from '../../src/components/ui/ScrollPageHeader';
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
import {
    ArrowUpRight,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
} from 'lucide-react-native';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useTheme } from '../../src/contexts/ThemeContext';
import {useSessionRangeQuery,useSessionScreenContext,useDashboardExpenses,useNextSessionQuery} from '../../src/hooks/useSessionScreens';
import {dashboardWindow} from '../../src/utils/dashboardWindow';
import { useVenuesQuery } from '../../src/hooks/useVenuesQuery';
import {
    dashboardInsights,
    dashboardMetrics,
    dashboardChart,
    currencyCode,
    DashboardPeriod,
} from '../../src/utils/dashboardMetrics';
import { sessionRange } from '../../src/utils/sessionPlanning';

function MetricCard({
    label,
    value,
    hint,
    accent,
    dark,
}: {
    label: string;
    value: string;
    hint?: string;
    accent: string;
    dark: boolean;
}) {
    const darkPalette = useDarkPalette();
    return (
        <View
            style={[
                styles.metric,
                {
                    backgroundColor: dark ? darkPalette.surface : '#fff',
                    borderWidth: dark ? 0 : 1,
                    borderColor: dark ? darkPalette.border : '#e9ecf3',
                },
            ]}
        >
            <Text
                style={[[styles.label, { color: dark ? darkPalette.muted : '#6d7588' }], dark && { color: darkPalette.onSurface }]}
            >
                {label}
            </Text>
            <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                style={[[
                    styles.metricValue,
                    { color: dark ? darkPalette.text : '#182039' },
                ], dark && { color: darkPalette.onSurface }]}
            >
                {value}
            </Text>
            {hint ? (
                <Text
                    style={[[
                        styles.hint,
                        { color: dark ? darkPalette.muted : '#778095' },
                    ], dark && { color: darkPalette.onSurface }]}
                >
                    {hint}
                </Text>
            ) : null}
        </View>
    );
}
export default function DashboardScreen() {
    const darkPalette = useDarkPalette();
    const { progress: headerProgress, onScroll: onTabScroll, onScrollBeginDrag: onTabScrollBeginDrag } = useScrollHeader('hide');
    const { t, i18n, formatMoney, numberLocale, defaultCurrency } = useTranslation();
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    const router = useRouter();
    const usage = useSessionUsage();
    const { isPro: storeIsPro } = useSubscription();
    const isPro = storeIsPro || usage.data?.isPro === true;
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
    const window=dashboardWindow(anchor,period,now);
    const mainQuery=useSessionRangeQuery(window.main.from,window.main.to);
    const nextWindow=useSessionRangeQuery(window.upcoming.from,window.upcoming.to);
    const upcomingQuery=useNextSessionQuery();
    const contextQuery=useSessionScreenContext(true);
    const invitation = useResearchInvitation(Object.keys(contextQuery.data?.firstCompleted || {}).length > 0);
    const sessionsQuery={...mainQuery,isLoading:mainQuery.isLoading||nextWindow.isLoading||contextQuery.isLoading||upcomingQuery.isLoading,
        isError:mainQuery.isError||nextWindow.isError||contextQuery.isError||upcomingQuery.isError,
        isSuccess:mainQuery.isSuccess&&nextWindow.isSuccess&&contextQuery.isSuccess&&upcomingQuery.isSuccess,
        isFetching:mainQuery.isFetching||nextWindow.isFetching||contextQuery.isFetching||upcomingQuery.isFetching,
        refetch:()=>Promise.all([mainQuery.refetch(),nextWindow.refetch(),contextQuery.refetch(),upcomingQuery.refetch()])};
    const expensesQuery = useDashboardExpenses(window.main.from,window.main.to);
    useScreenMonitoring('dashboard', sessionsQuery.isLoading || expensesQuery.isLoading, sessionsQuery.isError || expensesQuery.isError);
    const venuesQuery = useVenuesQuery();
    const [expandedCity, setExpandedCity] = useState<string | null>(null);
    const sessions=useMemo(()=>[...new Map([...(mainQuery.data||[]),...(nextWindow.data||[]),...(upcomingQuery.data?[upcomingQuery.data]:[])].map(s=>[s.id,s])).values()],[mainQuery.data,nextWindow.data,upcomingQuery.data]);
    const expenses = expensesQuery.data;
    const text = dark ? darkPalette.text : '#182039';
    const muted = dark ? darkPalette.muted : '#6d7588';
    const surface = dark ? darkPalette.surface : '#fff';
    const line = dark ? darkPalette.border : '#e9ecf3';
    const label = (key: string) => t(`insights.${key}`);
    const currencies=contextQuery.data?.currencies?.length?contextQuery.data.currencies:[defaultCurrency];
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
                contextQuery.data?.firstCompleted,
            ),
        [sessions, venuesQuery.data, anchor, period, currency, now,contextQuery.data],
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
        () =>
            [...metrics.paymentPending].sort((a, b) =>
                a.date.localeCompare(b.date),
            ),
        [metrics.paymentPending],
    );
    const number = (n: number, digits = 0) =>
        new Intl.NumberFormat(numberLocale, {
            maximumFractionDigits: digits,
        }).format(n);
    const money = (n: number) => formatMoney(n, currency);
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
    const exportReport = (): StatisticsReport => {
        const advanced = dashboardAdvancedAnalytics(sessions || [], expenses || [], venuesQuery.data || [], anchor, period, currency, now,contextQuery.data?.aging);
        const a = (key: string) => t(`advancedAnalytics.${key}`);
        const rows = [
            [label('revenue'), money(metrics.revenue)],
            [label('pending'), money(metrics.pendingBalance)],
            [t('expenses'), metrics.costs === null ? '—' : money(metrics.costs)],
            [label('balance'), metrics.balance === null ? '—' : money(metrics.balance)],
            [label('sessions'), number(metrics.active.length)],
            [label('hours'), `${number(metrics.hours, 1)} h`],
            [label('played'), `${number(metrics.playedHours, 1)} h`],
            [label('average'), metrics.averageFee === null ? '—' : money(metrics.averageFee)],
            [label('perHour'), metrics.hourlyFee === null ? '—' : money(metrics.hourlyFee)],
            [label('venues'), number(metrics.venueCount)],
            [label('cancelled'), number(metrics.cancelled)],
        ];
        return {
            title: t('statisticsPdf.reportTitle'), period: dateLabel, currency,
            generated: `${t('statisticsPdf.generated')}: ${new Intl.DateTimeFormat(numberLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(now)}`,
            chartTitle: `${label('activity')} · ${label('sessions')} / ${label('revenue')}`,
            chart: chart.map(row => ({ label: new Intl.DateTimeFormat(numberLocale, { month: 'short', year: 'numeric' }).format(row.date), count: row.count, revenue: money(row.revenue) })),
            sections: [
                { title: t('statisticsPdf.summary'), hint: `${label('revenueHint')} ${label('totalsHint')}`, rows },
                { title: a('margin'), hint: a('marginHint'), rows: [
                    [a('registeredMargin'), money(advanced.margin)], [a('linkedExpenses'), money(advanced.costs)],
                    [a('hourlyMargin'), advanced.hourlyMargin === null ? '—' : `${money(advanced.hourlyMargin)}/h`],
                    [a('marginPercent'), advanced.marginPercent === null ? '—' : `${number(advanced.marginPercent, 1)} %`],
                ] },
                { title: a('venues'), headers: [label('venues'), label('sessions'), a('registeredMargin'), a('hourlyMargin')], rows: advanced.venues.map(v => [v.name || '—', number(v.rows.length), money(v.margin), v.hourlyMargin === null ? '—' : `${money(v.hourlyMargin)}/h`]) },
                { title: label('patterns'), rows: [[label('averageDuration'), insights.averageDuration === null ? '—' : `${number(insights.averageDuration, 1)} h`], [label('repeatVenues'), insights.repeatRate === null ? '—' : `${number(insights.repeatRate, 1)} %`], [label('cancellationRate'), insights.cancellationRate === null ? '—' : `${number(insights.cancellationRate, 1)} %`], [label('paidSessions'), `${number(insights.paid)} / ${number(metrics.active.length)}`]] },
                { title: a('concentration'), hint: a('concentrationHint'), headers: [label('venues'), label('revenue'), '%'], rows: advanced.concentration.map(v => [v.name || '—', money(v.fee), `${number(v.share, 1)} %`]) },
                { title: a('trend'), hint: a('trendHint'), headers: [t('statisticsPdf.date'), t('statisticsPdf.medianFee'), a('medianHourly')], rows: advanced.trend.map(row => [new Intl.DateTimeFormat(numberLocale, { month: 'short', year: 'numeric' }).format(row.date), row.medianFee === null ? '—' : money(row.medianFee), row.medianHourly === null ? '—' : `${money(row.medianHourly)}/h`]) },
                { title: label('cities'), headers: [label('cities'), label('sessions'), label('hours'), label('revenue')], rows: insights.cities.map(city => [city.name, number(city.count), `${number(city.hours, 1)} h`, money(city.revenue)]) },
                { title: a('aging'), hint: a('agingHint'), rows: advanced.aging.map(row => [a(row.key), money(row.amount)]) },
                { title: t('statisticsPdf.details'), hint: t('statisticsPdf.currencyHint'), headers: [t('statisticsPdf.date'), label('sessions'), label('revenue')], rows: metrics.selected.map(session => [session.date.slice(0, 10), `${sessionDisplayTitle(session, t)} · ${session.venue || ''} · ${t(`workflow.${session.status}`)}`, `${formatMoney(sessionEarnings(session), session.currency || currency)}`]) },
            ],
        };
    };
    const exportAction = <StatisticsExport enabled={isPro} ready={sessionsQuery.isSuccess && expensesQuery.isSuccess && venuesQuery.isSuccess && !sessionsQuery.isFetching && !expensesQuery.isFetching && !venuesQuery.isFetching && !refreshing} report={exportReport} />;
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
                usage.refetch(),
            ]);
        } finally {
            setRefreshing(false);
        }
    };
    const cardStyle = [
        styles.card,
        { backgroundColor: surface, borderColor: line, borderWidth: dark ? 0 : 1 },
    ];
    const heading = (title: string, hint?: string) => (
        <View style={{ marginBottom: 20 }}>
            <Text style={[styles.sectionTitle, { color: dark ? darkPalette.onSurface : text }]}>{title}</Text>
            {hint ? (
                <Text style={[styles.hint, { color: dark ? darkPalette.onSurface : muted, marginTop: 5 }]}>
                    {hint}
                </Text>
            ) : null}
        </View>
    );
    const errorBanner = (
        <View style={[cardStyle, { gap: 12 }]}>
            <AlertCircle color="#f59e0b" size={22} />
            <Text style={{ color: dark ? darkPalette.onSurface : text }}>{label('loadingError')}</Text>
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
                    { backgroundColor: dark ? darkPalette.background : '#f5f6fa' },
                ]}
                edges={['top']}
            >
                <ScrollPageHeader showAccount variant="hide" progress={headerProgress} title={t('dashboard')} subtitle={label('intro')} action={exportAction} />
                <View style={{ paddingHorizontal: 24, gap: 18 }}>
                    <View
                        style={{
                            height: 190,
                            borderRadius: 28,
                            backgroundColor: dark ? darkPalette.raised : '#e4e7f0',
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
                { backgroundColor: dark ? darkPalette.background : '#f5f6fa' },
            ]}
            edges={['top']}
        >
            <ScrollPageHeader showAccount variant="hide" progress={headerProgress} title={t('dashboard')} subtitle={label('intro')} action={exportAction} />
            <ScrollView
                testID="dashboard-scroll-view"
                onScrollBeginDrag={onTabScrollBeginDrag} onTouchStart={() => { onTabScrollBeginDrag(); invitation.cancel(); }} onScroll={onTabScroll} onScrollEndDrag={invitation.afterConsultation} onMomentumScrollBegin={invitation.cancel} onMomentumScrollEnd={invitation.afterConsultation}
                scrollEventThrottle={16}
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
                        { backgroundColor: surface, borderColor: line, borderWidth: dark ? 0 : 1 },
                    ]}
                >
                    <View
                        style={[
                            styles.segment,
                            { backgroundColor: dark ? darkPalette.background : '#f0f2f7' },
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
                                            ? darkPalette.tint
                                            : '#fff',
                                    },
                                ]}
                            >
                                <Text
                                    style={{
                                        color:
                                            period === p
                                                ? dark
                                                    ? darkPalette.primary
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
                                style={[{
                                    color: text,
                                    fontSize: 16,
                                    fontWeight: '700',
                                    textTransform: 'capitalize',
                                }, dark && { color: darkPalette.onSurface }]}
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
                                                    ? (dark ? darkPalette.primary : '#6554df')
                                                    : surface,
                                            borderColor:
                                                c === currency
                                                    ? (dark ? darkPalette.primary : '#6554df')
                                                    : line,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={{
                                            color:
                                                c === currency ? (dark ? darkPalette.onPrimary : '#fff') : muted,
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
                        <View
                            testID="dashboard-agreed-fees"
                            style={[styles.hero, { backgroundColor: dark ? darkPalette.primary : '#35316e' }]}
                        >
                            <View style={styles.heroTop}>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        gap: 8,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: dark ? darkPalette.onPrimary : '#e1dcff',
                                            fontWeight: '600',
                                            fontSize: 14,
                                        }}
                                    >
                                        {label('revenue')}
                                    </Text>
                                </View>
                                <Text style={[styles.heroCurrency, dark && { color: darkPalette.surface, backgroundColor: darkPalette.muted }]}>
                                    {currency}
                                </Text>
                            </View>
                            <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.6}
                                style={[styles.heroValue, dark && { color: darkPalette.onPrimary }]}
                            >
                                {money(metrics.revenue)}
                            </Text>
                            <Text
                                style={{
                                    color: dark ? darkPalette.onPrimary : '#c7c1e7',
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
                                                dark ? darkPalette.onPrimary : growth !== null && growth < 0
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
                                        color: dark ? darkPalette.onPrimary : '#cec9ea',
                                        fontSize: 11,
                                        flex: 1,
                                    }}
                                >
                                    {label('previousPeriod')}
                                </Text>
                            </View>
                            {metrics.pendingBalance > 0 ? (
                                <Text
                                    style={{
                                        color: dark ? darkPalette.onPrimary : '#d9d2f5',
                                        fontSize: 12,
                                        marginTop: 13,
                                    }}
                                >
                                    {label('potential')}:{' '}
                                    {money(metrics.pendingBalance)}
                                </Text>
                            ) : null}
                        </View>
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
                                            style={[{
                                                color: text,
                                                fontSize: 24,
                                                fontWeight: '800',
                                            }, dark && { color: darkPalette.onSurface }]}
                                        >
                                            {item.value}
                                        </Text>
                                        <Text
                                            style={[{
                                                color: muted,
                                                fontSize: 11,
                                            }, dark && { color: darkPalette.onSurface }]}
                                        >
                                            {item.name}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                            <Text
                                style={[[
                                    styles.hint,
                                    { color: muted, marginTop: 16 },
                                ], dark && { color: darkPalette.onSurface }]}
                            >
                                {insights.nextPaymentPending}{' '}
                                {label('pending').toLowerCase()}
                            </Text>
                        </View>
                        <View testID="dashboard-basic-statistics" style={styles.grid}>
                            <MetricCard
                                label={label('sessions')}
                                value={number(metrics.active.length)}
                                hint={`${metrics.settled.length} ${label('confirmed').toLowerCase()} · ${metrics.paymentPending.length} ${label('pending').toLowerCase()}`}

                                accent="#7666df"
                                dark={dark}
                            />
                            <MetricCard
                                label={label('hours')}
                                value={`${number(metrics.hours, 1)} h`}
                                hint={`${number(metrics.playedHours, 1)} h ${label('played').toLowerCase()}`}

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
                                hint={label('balanceHint')}

                                accent="#b58b37"
                                dark={dark}
                            />
                        </View>
                        {isPro ? <View testID="dashboard-pro-statistics" style={{ gap: 18 }}>
                        <ResearchInvitationCard invitation={invitation} />
                        <View testID="dashboard-activity" style={cardStyle}>
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
                                            ? darkPalette.background
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
                                                    ? darkPalette.tint
                                                    : '#fff',
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={{
                                                color:
                                                    mode === chartMode
                                                        ? dark
                                                            ? darkPalette.primary
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
                                                                  ? darkPalette.raised
                                                                  : '#dcd9f1',
                                                    }}
                                                />
                                            </View>
                                            <Text
                                                style={[{
                                                    color: selected
                                                        ? (dark ? darkPalette.primary : '#8b78f0')
                                                        : muted,
                                                    marginTop: 10,
                                                    fontSize: 11,
                                                    fontWeight: selected
                                                        ? '800'
                                                        : '500',
                                                }, dark && { color: darkPalette.onSurface }]}
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
                                                style={[{
                                                    color: text,
                                                    fontSize: 10,
                                                    marginTop: 5,
                                                }, dark && { color: darkPalette.onSurface }]}
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
                                style={[[
                                    styles.hint,
                                    { color: muted, marginTop: 18 },
                                ], dark && { color: darkPalette.onSurface }]}
                            >
                                {label('chartHint')}
                            </Text>
                        </View>
                        <View testID="dashboard-payment-status" style={cardStyle}>
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
                                              count: metrics.settled.length,
                                              color: dark ? darkPalette.primary : '#8b78e6',
                                          },
                                          {
                                              count: metrics.paymentPending
                                                  .length,
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
                                        count: metrics.settled.length,
                                        color: dark ? darkPalette.primary : '#8b78e6',
                                    },
                                    {
                                        key: 'pending',
                                        count: metrics.paymentPending.length,
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
                                            style={[{
                                                fontSize: 23,
                                                color: text,
                                                fontWeight: '800',
                                            }, dark && { color: darkPalette.onSurface }]}
                                        >
                                            {s.count}
                                        </Text>
                                        <Text
                                            style={[{
                                                fontSize: 11,
                                                color: muted,
                                                marginTop: 5,
                                            }, dark && { color: darkPalette.onSurface }]}
                                        >
                                            {label(s.key)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                            <View style={[styles.facts, { borderColor: line }]}>
                                <Text style={[{ color: muted, fontSize: 12 }, dark && { color: darkPalette.onSurface }]}>
                                    {label('venues')}:{' '}
                                    <Text
                                        style={[{
                                            color: text,
                                            fontWeight: '700',
                                        }, dark && { color: darkPalette.onSurface }]}
                                    >
                                        {metrics.venueCount}
                                    </Text>
                                </Text>
                                <Text style={[{ color: muted, fontSize: 12 }, dark && { color: darkPalette.onSurface }]}>
                                    {label('perHour')}:{' '}
                                    <Text
                                        style={[{
                                            color: text,
                                            fontWeight: '700',
                                        }, dark && { color: darkPalette.onSurface }]}
                                    >
                                        {metrics.hourlyFee === null
                                            ? '—'
                                            : money(metrics.hourlyFee)}
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

                                    accent="#b58b37"
                                    dark={dark}
                                />
                            </View>
                            <Text
                                style={[[
                                    styles.sectionTitle,
                                    {
                                        color: text,
                                        marginTop: 24,
                                        fontSize: 15,
                                    },
                                ], dark && { color: darkPalette.onSurface }]}
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
                                                                ? (dark ? darkPalette.primary : '#8b78e6')
                                                                : dark
                                                                  ? darkPalette.raised
                                                                  : '#dcd9f1',
                                                        borderRadius: 6,
                                                    }}
                                                />
                                            </View>
                                            <Text
                                                style={[{
                                                    color: muted,
                                                    fontSize: 10,
                                                    marginTop: 9,
                                                }, dark && { color: darkPalette.onSurface }]}
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
                                                style={[{
                                                    color: text,
                                                    fontSize: 12,
                                                    fontWeight: '700',
                                                    marginTop: 4,
                                                }, dark && { color: darkPalette.onSurface }]}
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
                                            style={[{
                                                color: muted,
                                                fontSize: 11,
                                            }, dark && { color: darkPalette.onSurface }]}
                                        >
                                            {label('bestRate')}
                                        </Text>
                                        <Text
                                            style={[{
                                                color: text,
                                                fontWeight: '700',
                                            }, dark && { color: darkPalette.onSurface }]}
                                        >
                                            {insights.bestRate.name}
                                        </Text>
                                    </View>
                                    <Text
                                        style={[{
                                            color: dark ? darkPalette.primary : '#8b78e6',
                                            fontWeight: '800',
                                            fontSize: 18,
                                        }, dark && { color: darkPalette.onSurface }]}
                                    >
                                        {money(insights.bestRate.rate)}/h
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                        <View style={cardStyle}>
                            {heading(label('cities'), label('citiesHint'))}
                            {venuesQuery.isLoading ? (
                                <ActivityIndicator color={dark ? darkPalette.primary : "#8b78e6"} />
                            ) : venuesQuery.isError ? (
                                <>
                                    <Text style={[{ color: muted }, dark && { color: darkPalette.onSurface }]}>
                                        {label('loadingError')}
                                    </Text>
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        onPress={() => venuesQuery.refetch()}
                                        style={styles.retry}
                                    >
                                        <Text
                                            style={[{
                                                color: dark ? darkPalette.primary : '#8b78e6',
                                                fontWeight: '700',
                                            }, dark && { color: darkPalette.onSurface }]}
                                        >
                                            {label('retry')}
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <Text
                                        style={[{
                                            color: text,
                                            fontSize: 29,
                                            fontWeight: '800',
                                            marginBottom: 12,
                                        }, dark && { color: darkPalette.onSurface }]}
                                    >
                                        {insights.cities.length}{' '}
                                        <Text
                                            style={[{
                                                fontSize: 13,
                                                color: muted,
                                                fontWeight: '500',
                                            }, dark && { color: darkPalette.onSurface }]}
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
                                                    style={{ flex: 1, gap: 5 }}
                                                >
                                                    <Text
                                                        numberOfLines={1}
                                                        style={[{
                                                            color: text,
                                                            fontWeight: '700',
                                                            fontSize: 15,
                                                        }, dark && { color: darkPalette.onSurface }]}
                                                    >
                                                        {city.name}
                                                    </Text>
                                                    <Text
                                                        style={[{
                                                            color: muted,
                                                            fontSize: 11,
                                                        }, dark && { color: darkPalette.onSurface }]}
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
                                                    style={[{
                                                        color: text,
                                                        fontSize: 13,
                                                        fontWeight: '700',
                                                    }, dark && { color: darkPalette.onSurface }]}
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
                                                                      style={[{
                                                                          color: text,
                                                                          fontSize: 13,
                                                                          fontWeight:
                                                                              '600',
                                                                      }, dark && { color: darkPalette.onSurface }]}
                                                                  >
                                                                      {s.title}
                                                                  </Text>
                                                                  <Text
                                                                      style={[{
                                                                          color: muted,
                                                                          fontSize: 11,
                                                                      }, dark && { color: darkPalette.onSurface }]}
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
                                                                  color={dark ? darkPalette.primary : "#8b78e6"}
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
                                                    ? darkPalette.tint
                                                    : '#f0edfb',
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: dark
                                                        ? darkPalette.primary
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
                                            style={[{
                                                color: muted,
                                                fontSize: 13,
                                            }, dark && { color: darkPalette.onSurface }]}
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
                                                style={[{
                                                    color: text,
                                                    fontWeight: '700',
                                                    fontSize: 14,
                                                }, dark && { color: darkPalette.onSurface }]}
                                            >
                                                {s.title}
                                            </Text>
                                            <Text
                                                style={[{
                                                    color: muted,
                                                    fontSize: 12,
                                                }, dark && { color: darkPalette.onSurface }]}
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
                                <Text style={[{ color: muted, fontSize: 13 }, dark && { color: darkPalette.onSurface }]}>
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
                                                        ? darkPalette.tint
                                                        : '#f0edfb',
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={{
                                                    color: dark ? darkPalette.primary : '#8b78e6',
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
                                                style={[{
                                                    color: text,
                                                    fontWeight: '700',
                                                    fontSize: 14,
                                                }, dark && { color: darkPalette.onSurface }]}
                                            >
                                                {v.name}
                                            </Text>
                                            <Text
                                                style={[{
                                                    color: muted,
                                                    fontSize: 12,
                                                }, dark && { color: darkPalette.onSurface }]}
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
                                <Text style={[{ color: muted, fontSize: 13 }, dark && { color: darkPalette.onSurface }]}>
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
                                            style={[{
                                                color: text,
                                                fontSize: 19,
                                                fontWeight: '800',
                                                flex: 1,
                                            }, dark && { color: darkPalette.onSurface }]}
                                        >
                                            {nextSession.title}
                                        </Text>
                                        <ArrowUpRight
                                            color={dark ? darkPalette.primary : "#8b78e6"}
                                            size={22}
                                        />
                                    </View>
                                    <Text
                                        style={[{ color: muted, fontSize: 13 }, dark && { color: darkPalette.onSurface }]}
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
                                        <Text
                                            style={[{
                                                color: muted,
                                                fontSize: 13,
                                                flex: 1,
                                            }, dark && { color: darkPalette.onSurface }]}
                                        >
                                            {nextSession.venue}
                                        </Text>
                                        <SessionStatusBadge
                                            session={nextSession}
                                            compact
                                        />
                                    </View>
                                    <SessionPartialPaymentSummary session={nextSession} />
                                    <SessionExpenseBadge session={nextSession} />
                                    <SessionTaskBadge session={nextSession} />
                                    <SessionAttendanceBadges session={nextSession} />
                                </TouchableOpacity>
                            ) : (
                                <Text style={[{ color: muted, fontSize: 13 }, dark && { color: darkPalette.onSurface }]}>
                                    {label('noUpcoming')}
                                </Text>
                            )}
                        </View>
                        <DashboardAnalytics
                            historicalAging={contextQuery.data?.aging}
                            agingAsOf={contextQuery.data?.asOf}
                            sessions={sessions || []}
                            expenses={expensesQuery.data || []}
                            venues={venuesQuery.data || []}
                            anchor={anchor}
                            period={period}
                            currency={currency}
                            now={now}
                            expensesReady={expensesQuery.isSuccess}
                            expensesLoading={expensesQuery.isPending}
                            onRetryExpenses={() => { void expensesQuery.refetch(); }}
                        />
                        </View> : <DashboardProPreview beforeActivity={<ResearchInvitationCard invitation={invitation} />} />}
                    </>
                )}
            </ScrollView>
            <ResearchInvitationModal invitation={invitation} />
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
        minHeight: 130,
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
