import { useMemo, useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { CommunityButton, useCommunityColors } from '../community/CommunityUI';
import { dashboardAdvancedAnalytics } from '../../utils/dashboardAdvancedAnalytics';
import type { DashboardPeriod } from '../../utils/dashboardMetrics';
import { sessionDisplayTitle } from '../../utils/sessionNaming';
import { sessionBalance } from '../../utils/sessionPlanning';
import type { Session } from '../../types/session';
import type { Expense } from '../../types/expense';
import type { Venue } from '../../types/venue';

type Detail = { kind: 'margin' | 'venue' | 'trend' | 'aging' | 'concentration'; key: string };
export function DashboardAnalytics({ sessions, expenses, venues, anchor, period, currency, now, expensesReady, expensesLoading, onRetryExpenses }: {
    sessions: Session[]; expenses: Expense[]; venues: Venue[]; anchor: Date;
    period: DashboardPeriod; currency: string; now: Date; expensesReady: boolean; expensesLoading: boolean;
    onRetryExpenses: () => void;
}) {
    const c = useCommunityColors();
    const { t, dateLocale, formatMoney, numberLocale } = useTranslation();
    const [months, setMonths] = useState<3 | 6 | 12>(6);
    const [venueMode, setVenueMode] = useState<'margin' | 'hourlyMargin'>('margin');
    const [detail, setDetail] = useState<Detail | null>(null);
    const [venueLimit, setVenueLimit] = useState(5);
    const analytics = useMemo(() => dashboardAdvancedAnalytics(sessions, expenses, venues, anchor, period, currency, now),
        [sessions, expenses, venues, anchor, period, currency, now]);
    const label = (key: string, values?: Record<string, string | number>) => t(`advancedAnalytics.${key}`, values);
    const number = (value: number, digits = 0) => new Intl.NumberFormat(numberLocale, { maximumFractionDigits: digits }).format(value);
    const money = (value: number) => formatMoney(value, currency);
    const percent = (value: number | null) => value === null ? '—' : `${number(value, 1)} %`;
    const color = c.dark ? c.cardText : c.fg;
    const toggle = (kind: Detail['kind'], key: string) => setDetail(current => current?.kind === kind && current.key === key ? null : { kind, key });
    const panel = (key: string, title: string, hint: string, children: ReactNode) => (
        <View key={key} testID={`dashboard-analytics-${key}`} style={{ backgroundColor: c.card, borderRadius: 26, padding: 22, gap: 16, borderWidth: c.dark ? 0 : 1, borderColor: c.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text accessibilityRole="header" style={{ flex: 1, color, fontSize: 18, fontWeight: '800' }}>{title}</Text>
            </View>
            <Text style={{ color: c.dark ? c.cardText : c.muted, fontSize: 12, lineHeight: 18 }}>{hint}</Text>
            {children}
        </View>
    );
    const empty = <Text style={{ color, lineHeight: 20 }}>{label('empty')}</Text>;
    const stat = (title: string, value: string) => <View key={title} style={{ flexGrow: 1, flexBasis: '45%', minWidth: 130, gap: 7 }}>
        <Text style={{ color, fontSize: 12 }}>{title}</Text>
        <Text style={{ color, fontWeight: '800', fontSize: 25 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>;
    const segment = <T extends string | number,>(options: readonly T[], selected: T, select: (value: T) => void, name: (value: T) => string) => (
        <View style={{ flexDirection: 'row', backgroundColor: c.field, borderRadius: 14, padding: 4 }}>
            {options.map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: selected === value }} onPress={() => select(value)}
                style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: selected === value ? c.tint : 'transparent', paddingHorizontal: 4 }}>
                <Text style={{ color: selected === value ? c.accent : color, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{name(value)}</Text>
            </TouchableOpacity>)}
        </View>
    );
    const list = (items: Session[], kind: Detail['kind']) => <AnalyticsSessions key={`${detail?.kind}-${detail?.key}`} sessions={items}
        caption={kind === 'margin' || kind === 'venue' ? session => {
            const row = analytics.rows.find(item => item.session.id === session.id);
            return row ? `${t('form.fee')}: ${money(row.fee)} · ${t('expenses')}: ${money(row.costs)} · ${label('hourlyMargin')}: ${money(row.hourlyMargin)}/h · ${percent(row.marginPercent)}` : '';
        } : undefined}
        value={session => kind === 'aging' ? money(sessionBalance(session)) : kind === 'margin' || kind === 'venue'
            ? money(analytics.rows.find(row => row.session.id === session.id)?.margin || 0) : undefined} />;
    const profitVenues = [...analytics.venues].sort((a, b) => b[venueMode] - a[venueMode] || a.name.localeCompare(b.name));
    const trend = analytics.trend.slice(-months);
    const maxFee = Math.max(1, ...trend.map(row => row.medianFee || 0));
    const costsUnavailable = expensesLoading ? <ActivityIndicator color={c.accent} /> : <CommunityButton label={label('retryExpenses')} onPress={onRetryExpenses} secondary />;
    return <View testID="dashboard-analytics" style={{ gap: 18 }}>
        {panel('margin', label('margin'), label('marginHint'), !expensesReady ? costsUnavailable : !analytics.rows.length ? empty : <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
                {stat(label('registeredMargin'), money(analytics.margin))}
                {stat(label('hourlyMargin'), analytics.hourlyMargin === null ? '—' : `${money(analytics.hourlyMargin)}/h`)}
                {stat(label('marginPercent'), percent(analytics.marginPercent))}
                {stat(label('linkedExpenses'), money(analytics.costs))}
            </View>
            <Text style={{ color, fontSize: 12, lineHeight: 18 }}>{label('sample', { count: analytics.rows.length })}</Text>
            {!!analytics.noExpenses && <Text style={{ color, fontSize: 12, lineHeight: 18 }}>{label('noExpenses', { count: analytics.noExpenses })}</Text>}
            {analytics.unallocatedCosts > 0 && <Text style={{ color, fontSize: 12, lineHeight: 18 }}>{label('unallocated', { amount: money(analytics.unallocatedCosts) })}</Text>}
            <CommunityButton label={label(detail?.kind === 'margin' ? 'hideSessions' : 'viewSessions')} secondary onPress={() => toggle('margin', 'all')} />
            {detail?.kind === 'margin' && list(analytics.rows.map(row => row.session), 'margin')}
        </>)}
        {!!analytics.unsettled && <Text style={{ color: c.fg, fontSize: 12, lineHeight: 18 }}>{label('unsettled', { count: analytics.unsettled })}</Text>}
        {panel('venues', label('venues'), label('venuesHint'), !expensesReady ? costsUnavailable : !profitVenues.length ? empty : <>
            {segment(['margin', 'hourlyMargin'] as const, venueMode, setVenueMode, key => label(key === 'margin' ? 'registeredMargin' : 'hourlyMargin'))}
            {profitVenues.slice(0, venueLimit).map((venue, index) => <View key={venue.key}>
                <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: detail?.kind === 'venue' && detail.key === venue.key }}
                    onPress={() => toggle('venue', venue.key)} style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ color, fontWeight: '700', width: 18 }}>{index + 1}</Text>
                    <View style={{ flex: 1, gap: 4 }}><Text style={{ color, fontWeight: '700' }}>{venue.name || t('createMenu.venue')}</Text>
                        <Text style={{ color, fontSize: 11 }}>{label('sample', { count: venue.rows.length })}</Text></View>
                    <Text style={{ color, fontWeight: '800' }}>{money(venue[venueMode])}{venueMode === 'hourlyMargin' ? '/h' : ''}</Text>
                    <ChevronRight color={color} size={16} />
                </TouchableOpacity>
                {detail?.kind === 'venue' && detail.key === venue.key && list(venue.rows.map(row => row.session), 'venue')}
            </View>)}
            {profitVenues.length > venueLimit && <CommunityButton label={label('showMore')} secondary onPress={() => setVenueLimit(limit => limit + 5)} />}
        </>)}
        {panel('trend', label('trend'), label('trendHint'), <>
            {segment([3, 6, 12] as const, months, setMonths, value => label('months', { count: value }))}
            {trend.map(row => <View key={row.key}>
                <TouchableOpacity accessibilityRole="button" disabled={!row.sessions.length} accessibilityState={{ disabled: !row.sessions.length, expanded: detail?.kind === 'trend' && detail.key === row.key }}
                    onPress={() => toggle('trend', row.key)} style={{ minHeight: 62, gap: 6, paddingVertical: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                        <Text style={{ color, fontWeight: '700' }}>{row.date.toLocaleDateString(dateLocale, { month: 'short', year: '2-digit' })}</Text>
                        <Text style={{ color, fontWeight: '700' }}>{row.medianFee === null ? '—' : money(row.medianFee)}</Text>
                    </View>
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: c.field }}><View style={{ height: 5, borderRadius: 3, backgroundColor: c.accent, width: `${(row.medianFee || 0) / maxFee * 100}%` }} /></View>
                    <Text style={{ color, fontSize: 11 }}>{row.medianHourly === null ? label('noData') : `${label('medianHourly')}: ${money(row.medianHourly)}/h · ${label('sample', { count: row.sessions.length })}`}</Text>
                </TouchableOpacity>
                {detail?.kind === 'trend' && detail.key === row.key && list(row.sessions, 'trend')}
            </View>)}
        </>)}
        {panel('aging', label('aging'), label('agingHint'), <>
            {analytics.aging.map(bucket => <View key={bucket.key}>
                <TouchableOpacity accessibilityRole="button" disabled={!bucket.sessions.length} accessibilityState={{ disabled: !bucket.sessions.length, expanded: detail?.kind === 'aging' && detail.key === bucket.key }}
                    onPress={() => toggle('aging', bucket.key)} style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1, gap: 4 }}><Text style={{ color, fontWeight: '700' }}>{label(bucket.key)}</Text><Text style={{ color, fontSize: 11 }}>{label('sample', { count: bucket.sessions.length })}</Text></View>
                    <Text style={{ color, fontWeight: '800' }}>{money(bucket.amount)}</Text><ChevronRight color={color} size={16} />
                </TouchableOpacity>
                {detail?.kind === 'aging' && detail.key === bucket.key && list(bucket.sessions, 'aging')}
            </View>)}
            {!analytics.aging.some(bucket => bucket.sessions.length) && <Text style={{ color, lineHeight: 20 }}>{label('noPending')}</Text>}
        </>)}
        {panel('concentration', label('concentration'), label('concentrationHint'), !analytics.concentration.length ? empty : <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
                {stat(label('topVenue'), percent(analytics.topShare))}
                {stat(label('topThree'), percent(analytics.topThreeShare))}
            </View>
            {analytics.concentration.slice(0, venueLimit).map(venue => <View key={venue.key}>
                <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: detail?.kind === 'concentration' && detail.key === venue.key }}
                    onPress={() => toggle('concentration', venue.key)} style={{ minHeight: 58, gap: 8, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}><Text style={{ color, fontWeight: '700', flex: 1 }}>{venue.name || t('createMenu.venue')}</Text><Text style={{ color }}>{percent(venue.share)}</Text></View>
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: c.field }}><View style={{ height: 5, borderRadius: 3, backgroundColor: c.accent, width: `${venue.share}%` }} /></View>
                </TouchableOpacity>
                {detail?.kind === 'concentration' && detail.key === venue.key && list(venue.rows.filter(row => row.fee > 0).map(row => row.session), 'concentration')}
            </View>)}
            {analytics.concentration.length > venueLimit && <CommunityButton label={label('showMore')} secondary onPress={() => setVenueLimit(limit => limit + 5)} />}
        </>)}
    </View>;
}
function AnalyticsSessions({ sessions, value, caption }: { sessions: Session[]; value: (session: Session) => string | undefined; caption?: (session: Session) => string }) {
    const [limit, setLimit] = useState(10);
    const c = useCommunityColors();
    const { t, dateLocale } = useTranslation();
    const router = useRouter();
    const color = c.dark ? c.cardText : c.fg;
    return <View style={{ gap: 8 }}>
        {sessions.slice(0, limit).map(session => <TouchableOpacity key={session.id} accessibilityRole="button"
            accessibilityLabel={`${sessionDisplayTitle(session, t)}, ${session.date}, ${session.venue}`}
            onPress={() => router.push(`/session/${session.id}`)} style={{ minHeight: 58, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}><Text style={{ color, fontWeight: '700' }}>{sessionDisplayTitle(session, t)}</Text>
                <Text style={{ color, fontSize: 11 }}>{new Date(`${session.date}T12:00:00`).toLocaleDateString(dateLocale)} · {session.venue}</Text>
                {!!caption && <Text style={{ color, fontSize: 11, lineHeight: 17 }}>{caption(session)}</Text>}</View>
            {!!value(session) && <Text style={{ color, fontWeight: '700', maxWidth: '35%' }}>{value(session)}</Text>}
            <ChevronRight size={16} color={color} />
        </TouchableOpacity>)}
        {sessions.length > limit && <CommunityButton label={t('advancedAnalytics.showMore')} secondary onPress={() => setLimit(current => current + 10)} />}
    </View>;
}
