import type { Session } from '../types/session';
import type { Expense } from '../types/expense';
import {
    localDateString,
    sessionDuration,
    sessionEarnings,
    sessionRange,
    sessionBalance,
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
            id: s.venue_id || undefined,
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
        paymentPending: active.filter(
            (s) => !s.is_guest && sessionBalance(s) > 0,
        ),
        settled: active.filter((s) => s.is_guest || sessionBalance(s) === 0),
        pendingBalance: active
            .filter((s) => !s.is_guest && currencyCode(s.currency) === currency)
            .reduce((sum, s) => sum + sessionBalance(s), 0),
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

export function dashboardInsights(
    sessions: Session[],
    venues: import('../types/venue').Venue[],
    anchor: Date,
    period: DashboardPeriod,
    currency: string,
    now = new Date(),
) {
    const summary = dashboardMetrics(
        sessions,
        [],
        anchor,
        period,
        currency,
        now,
    );
    const normalize = (value: string) =>
        value
            .trim()
            .replace(/\s+/g, ' ')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    const byId = new Map(venues.map((v) => [v.id, v]));
    const byName = new Map<string, import('../types/venue').Venue[]>();
    venues.forEach((v) => {
        const key = normalize(v.name);
        byName.set(key, [...(byName.get(key) || []), v]);
    });
    const resolveVenue = (s: Session) =>
        s.venue_id
            ? byId.get(s.venue_id)
            : byName.get(normalize(s.venue || ''))?.length === 1
              ? byName.get(normalize(s.venue || ''))![0]
              : undefined;
    const venueKey = (s: Session) =>
        resolveVenue(s)?.id || s.venue_id || normalize(s.venue || '');
    const firstCompleted = new Map<string, number>();
    sessions.forEach((s) => {
        if (s.status === 'pending' || s.status === 'cancelled' || !s.date)
            return;
        const end = sessionRange(s).end.getTime(),
            key = venueKey(s);
        if (key && end <= now.getTime())
            firstCompleted.set(
                key,
                Math.min(firstCompleted.get(key) ?? Infinity, end),
            );
    });
    const repeatSessions = summary.active.filter(
        (s) =>
            (firstCompleted.get(venueKey(s)) ?? Infinity) <=
            sessionRange(s).start.getTime(),
    ).length;
    const cities = new Map<
        string,
        {
            name: string;
            count: number;
            hours: number;
            revenue: number;
            sessions: Session[];
        }
    >();
    let unknownCity = 0;
    const weekdays = Array.from({ length: 7 }, (_, day) => ({ day, count: 0 }));
    for (const s of summary.active) {
        weekdays[sessionRange(s).start.getDay()].count++;
        const city = resolveVenue(s)?.city?.trim().replace(/\s+/g, ' ');
        if (!city) {
            unknownCity++;
            continue;
        }
        const key = normalize(city),
            item = cities.get(key) || {
                name: city,
                count: 0,
                hours: 0,
                revenue: 0,
                sessions: [],
            };
        item.count++;
        item.hours += sessionDuration(s);
        item.sessions.push(s);
        if (s.status !== 'pending' && currencyCode(s.currency) === currency)
            item.revenue += sessionEarnings(s);
        cities.set(key, item);
    }
    const nextEnd = new Date(now);
    nextEnd.setDate(nextEnd.getDate() + 30);
    const upcoming = sessions.filter(
        (s) =>
            s.status !== 'cancelled' &&
            s.date &&
            sessionRange(s).start >= now &&
            sessionRange(s).start < nextEnd,
    );
    const nextConfirmed = upcoming.filter((s) => s.status !== 'pending');
    const nextRevenue = nextConfirmed
        .filter((s) => currencyCode(s.currency) === currency)
        .reduce((sum, s) => sum + sessionEarnings(s), 0);
    const venueRates = new Map<
        string,
        { name: string; id?: string; earnings: number; hours: number }
    >();
    summary.confirmed
        .filter(
            (s) =>
                currencyCode(s.currency) === currency &&
                sessionEarnings(s) > 0 &&
                s.venue,
        )
        .forEach((s) => {
            const key = venueKey(s),
                item = venueRates.get(key) || {
                    name: resolveVenue(s)?.name || s.venue,
                    id: resolveVenue(s)?.id || s.venue_id || undefined,
                    earnings: 0,
                    hours: 0,
                };
            item.earnings += sessionEarnings(s);
            item.hours += sessionDuration(s);
            venueRates.set(key, item);
        });
    const bestRate =
        [...venueRates.values()]
            .map((v) => ({ ...v, rate: v.earnings / v.hours }))
            .sort((a, b) => b.rate - a.rate)[0] || null;
    const paid = summary.active.filter((s) => sessionEarnings(s) > 0).length;
    return {
        weekdays,
        repeatSessions,
        repeatRate: summary.active.length
            ? (repeatSessions / summary.active.length) * 100
            : null,
        averageDuration: summary.active.length
            ? summary.hours / summary.active.length
            : null,
        cancellationRate: summary.selected.length
            ? (summary.cancelled / summary.selected.length) * 100
            : null,
        paid,
        free: summary.active.filter(
            (s) => !s.is_guest && s.earning_type === 'free',
        ).length,
        unpriced: summary.active.filter(
            (s) => s.earning_type !== 'free' && sessionEarnings(s) <= 0,
        ).length,
        bestRate,
        cities: [...cities.values()].sort(
            (a, b) => b.count - a.count || b.revenue - a.revenue,
        ),
        unknownCity,
        nextSessions: nextConfirmed.length,
        nextPending: upcoming.length - nextConfirmed.length,
        nextPaymentPending: upcoming.filter(
            (s) => !s.is_guest && sessionBalance(s) > 0,
        ).length,
        nextHours: nextConfirmed.reduce(
            (sum, s) => sum + sessionDuration(s),
            0,
        ),
        nextRevenue,
    };
}
