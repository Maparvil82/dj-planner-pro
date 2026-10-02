import type { Session } from '../types/session';
import type { Expense } from '../types/expense';
import {
    localDateString,
    sessionDuration,
    sessionEarnings,
    sessionRange,
} from './sessionPlanning';

export type DashboardPeriod = 'month' | 'year';
export function currencyCode(value: string = 'EUR'): string {
    return (
        (
            { '€': 'EUR', $: 'USD', '£': 'GBP', '¥': 'JPY' } as Record<
                string,
                string
            >
        )[value] || value.toUpperCase()
    );
}
export function periodBounds(
    anchor: Date,
    period: DashboardPeriod,
    offset = 0,
) {
    const start =
        period === 'month'
            ? new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1)
            : new Date(anchor.getFullYear() + offset, 0, 1);
    const next =
        period === 'month'
            ? new Date(start.getFullYear(), start.getMonth() + 1, 1)
            : new Date(start.getFullYear() + 1, 0, 1);
    return { start: localDateString(start), end: localDateString(next) };
}
export function dashboardMetrics(
    sessions: Session[],
    expenses: Expense[],
    anchor: Date,
    period: DashboardPeriod,
    currency: string,
    now = new Date(),
) {
    const bounds = periodBounds(anchor, period);
    const inPeriod = (date: string) =>
        date.slice(0, 10) >= bounds.start && date.slice(0, 10) < bounds.end;
    const selected = sessions.filter((s) => s.date && inPeriod(s.date));
    const active = selected.filter((s) => s.status !== 'cancelled');
    const confirmed = active.filter((s) => s.status !== 'pending');
    const pending = active.filter((s) => s.status === 'pending');
    const moneySessions = confirmed.filter(
        (s) => currencyCode(s.currency) === currency,
    );
    const revenue = moneySessions.reduce(
        (sum, s) => sum + sessionEarnings(s),
        0,
    );
    const tentativeRevenue = pending
        .filter((s) => currencyCode(s.currency) === currency)
        .reduce((sum, s) => sum + sessionEarnings(s), 0);
    const paidSessions = moneySessions.filter((s) => sessionEarnings(s) > 0);
    const feeHours = paidSessions.reduce(
        (sum, s) => sum + sessionDuration(s),
        0,
    );
    // Existing expenses have no currency field and were entered as euros in the original app.
    const euroExpenses = expenses
        .filter((e) => e.date && inPeriod(e.date))
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const costs = currency === 'EUR' ? euroExpenses : null;
    const rankings = new Map<
        string,
        { name: string; id?: string; count: number; amount: number }
    >();
    for (const s of active) {
        if (!s.venue) continue;
        const key = s.venue_id || s.venue.trim().toLocaleLowerCase();
        const item = rankings.get(key) || {
            name: s.venue,
            id: s.venue_id,
            count: 0,
            amount: 0,
        };
        item.count++;
        if (s.status !== 'pending' && currencyCode(s.currency) === currency)
            item.amount += sessionEarnings(s);
        rankings.set(key, item);
    }
    const venues = [...rankings.values()].sort(
        (a, b) => b.count - a.count || b.amount - a.amount,
    );
    const ended = confirmed.filter((s) => sessionRange(s).end <= now);
    return {
        selected,
        active,
        confirmed,
        pending,
        revenue,
        tentativeRevenue,
        costs,
        euroExpenses,
        balance: costs === null ? null : revenue - costs,
        averageFee: paidSessions.length ? revenue / paidSessions.length : null,
        hourlyFee: feeHours ? revenue / feeHours : null,
        hours: active.reduce((sum, s) => sum + sessionDuration(s), 0),
        playedHours: ended.reduce((sum, s) => sum + sessionDuration(s), 0),
        played: ended.length,
        cancelled: selected.length - active.length,
        venueCount: venues.length,
        venues,
    };
}
export function dashboardChart(
    sessions: Session[],
    anchor: Date,
    period: DashboardPeriod,
    currency: string,
) {
    return Array.from({ length: period === 'year' ? 12 : 6 }, (_, index) => {
        const date =
            period === 'year'
                ? new Date(anchor.getFullYear(), index, 1)
                : new Date(
                      anchor.getFullYear(),
                      anchor.getMonth() - 5 + index,
                      1,
                  );
        const bounds = periodBounds(date, 'month');
        const active = sessions.filter(
            (s) =>
                s.date?.slice(0, 10) >= bounds.start &&
                s.date.slice(0, 10) < bounds.end &&
                s.status !== 'cancelled',
        );
        return {
            date,
            count: active.length,
            revenue: active
                .filter(
                    (s) =>
                        s.status !== 'pending' &&
                        currencyCode(s.currency) === currency,
                )
                .reduce((sum, s) => sum + sessionEarnings(s), 0),
        };
    });
}
