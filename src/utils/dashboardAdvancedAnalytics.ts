import type { Session } from '../types/session';
import type { Expense } from '../types/expense';
import type { Venue } from '../types/venue';
import { currencyCode, periodBounds, type DashboardPeriod } from './dashboardMetrics';
import { sessionBalance, sessionDuration, sessionEarnings, sessionRange } from './sessionPlanning';

const cents = (value: number) => Math.round((Number(value) || 0) * 100);
const median = (values: number[]) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const venueKey = (s: Session) => s.venue_id || s.venue.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() || s.id;
export type ProfitSession = {
    session: Session; fee: number; costs: number; margin: number;
    hours: number; hourlyMargin: number; marginPercent: number | null;
    expenseCount: number;
};
export function dashboardAdvancedAnalytics(
    sessions: Session[], expenses: Expense[], venues: Venue[],
    anchor: Date, period: DashboardPeriod, currency: string, now = new Date(),
    historicalAging?: {key:string;currency:string;count:number;amount:number}[],
) {
    const bounds = periodBounds(anchor, period);
    const inPeriod = (date: string) => date >= bounds.start && date < bounds.end;
    const completed = sessions.filter(s => !s.is_guest && s.status !== 'pending' && s.status !== 'cancelled'
        && currencyCode(s.currency) === currency && sessionRange(s).end <= now);
    const settled = completed.filter(s => s.earning_type !== 'agreement' || s.fee_agreement?.settled === true);
    const externalExpenses = expenses.filter(e => !e.included_in_agreement && currencyCode(e.currency || 'EUR') === currency);
    const costsBySession = new Map<string, { amount: number; count: number }>();
    for (const e of externalExpenses) {
        if (!e.session_id) continue;
        const item = costsBySession.get(e.session_id) || { amount: 0, count: 0 };
        item.amount += cents(e.amount); item.count++;
        costsBySession.set(e.session_id, item);
    }
    const rows: ProfitSession[] = settled.filter(s => inPeriod(s.date)).map(session => {
        const fee = cents(sessionEarnings(session));
        const linked = costsBySession.get(session.id);
        const costs = linked?.amount || 0, margin = fee - costs, hours = sessionDuration(session);
        return { session, fee: fee / 100, costs: costs / 100, margin: margin / 100, hours,
            hourlyMargin: margin / 100 / hours, marginPercent: fee > 0 ? margin / fee * 100 : null,
            expenseCount: linked?.count || 0 };
    }).sort((a, b) => b.session.date.localeCompare(a.session.date) || a.session.id.localeCompare(b.session.id));
    const totals = rows.reduce((a, row) => ({ fee: a.fee + cents(row.fee), costs: a.costs + cents(row.costs), margin: a.margin + cents(row.margin), hours: a.hours + row.hours }), { fee: 0, costs: 0, margin: 0, hours: 0 });
    const byId = new Map(venues.map(v => [v.id, v.name]));
    const venueMap = new Map<string, { key: string; name: string; rows: ProfitSession[]; fee: number; margin: number; hours: number }>();
    for (const row of rows) {
        const key = venueKey(row.session);
        const item = venueMap.get(key) || { key, name: byId.get(row.session.venue_id || '') || row.session.venue, rows: [], fee: 0, margin: 0, hours: 0 };
        item.rows.push(row); item.fee += cents(row.fee); item.margin += cents(row.margin); item.hours += row.hours;
        venueMap.set(key, item);
    }
    const venueRows = [...venueMap.values()].map(v => ({ ...v, fee: v.fee / 100, margin: v.margin / 100, hourlyMargin: v.margin / 100 / v.hours }));
    const concentration = venueRows.filter(v => v.fee > 0).sort((a, b) => b.fee - a.fee || a.name.localeCompare(b.name)).map(v => ({ ...v, share: totals.fee > 0 ? cents(v.fee) * 100 / totals.fee : 0 }));
    const lastMonth = period === 'year' ? 11 : anchor.getMonth();
    const trend = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(anchor.getFullYear(), lastMonth - 11 + i, 1);
        const month = periodBounds(date, 'month');
        const monthRows = settled.filter(s => s.date >= month.start && s.date < month.end && sessionEarnings(s) > 0);
        const medianFee = median(monthRows.map(s => cents(sessionEarnings(s))));
        return { key: month.start, date, sessions: monthRows, medianFee: medianFee === null ? null : medianFee / 100,
            medianHourly: median(monthRows.map(s => sessionEarnings(s) / sessionDuration(s))) };
    });
    const aging = [
        { key: 'days30', min: 0, max: 30 }, { key: 'days60', min: 31, max: 60 },
        { key: 'days90', min: 61, max: 90 }, { key: 'daysOver90', min: 91, max: Infinity },
    ].map(bucket => {
        const matches = settled.filter(s => {
            const days = Math.floor((now.getTime() - sessionRange(s).end.getTime()) / 86400000);
            return days >= bucket.min && days <= bucket.max && sessionBalance(s) > 0;
        });
        const historical=historicalAging?.find(row=>row.currency===currency&&row.key===bucket.key);
        return { ...bucket, count:historicalAging ? historical?.count || 0 : matches.length, sessions: matches, amount:historicalAging ? historical?.amount || 0 : matches.reduce((sum, s) => sum + cents(sessionBalance(s)), 0) / 100 };
    });
    return {
        rows, fee: totals.fee / 100, costs: totals.costs / 100, margin: totals.margin / 100,
        hourlyMargin: totals.hours ? totals.margin / 100 / totals.hours : null,
        marginPercent: totals.fee > 0 ? totals.margin / totals.fee * 100 : null,
        noExpenses: rows.filter(r => r.expenseCount === 0).length,
        unallocatedCosts: externalExpenses.filter(e => !e.session_id && inPeriod(e.date)).reduce((sum, e) => sum + cents(e.amount), 0) / 100,
        unsettled: completed.filter(s => inPeriod(s.date) && s.earning_type === 'agreement' && !s.fee_agreement?.settled).length,
        venues: venueRows, concentration, topShare: concentration[0]?.share ?? null,
        topThreeShare: concentration.length ? concentration.slice(0, 3).reduce((sum, v) => sum + v.share, 0) : null,
        trend, aging,
    };
}
