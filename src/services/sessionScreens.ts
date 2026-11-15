import { supabase } from '../lib/supabase';
import type { Session } from '../types/session';
import type { Expense } from '../types/expense';
import { localDateString, sessionRange } from '../utils/sessionPlanning';
export type SessionCursor = {
    date: string;
    id: string;
};
export type ScreenFilters = {
    from?: string | null;
    to?: string | null;
    search?: string;
    venues?: string[];
    titles?: string[];
    earningTypes?: string[];
    min?: number | null;
    max?: number | null;
    upcoming?: boolean;
    blockedDay?: string;
    aging?: string;
    currency?: string;
};
export type ScreenLabels = {
    atVenue: string;
    untitled: string;
};
export type AgingSummary = {
    key: string;
    currency: string;
    count: number;
    amount: number;
};
export type ScreenContext = {
    reviewCount: number;
    asOf?: string;
    currencies?: string[];
    firstCompleted?: Record<string, number>;
    aging?: AgingSummary[];
};
export type CardSummary = {
    completed: number;
    pending: number;
    expenseCount: number;
    expenses: Record<string, number>;
};
export const screenZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export const sessionScreens = {
    async page(filters: ScreenFilters = {}, cursor: SessionCursor | null = null, labels?: ScreenLabels, ascending = false, instant = new Date().toISOString(), size = 50): Promise<{
        sessions: Session[];
        nextCursor: SessionCursor | null;
    }> {
        const { data, error } = await supabase.rpc('session_screen_page', { filters, cursor, ascending_order: ascending, at_venue: labels?.atVenue || 'Session at {venue}', untitled: labels?.untitled || 'Untitled session', instant, zone: screenZone(), page_size: size });
        if (error)
            throw error;
        return data;
    },
    async range(from: string, to: string): Promise<Session[]> {
        const rows: Session[] = [];
        let cursor: SessionCursor | null = null;
        do {
            const page = await this.page({ from, to }, cursor, undefined, false, undefined, 100);
            rows.push(...page.sessions);
            cursor = page.nextCursor;
        } while (cursor);
        return rows;
    },
    async dayOccupied(date: string): Promise<boolean> {
        const from = new Date(`${date}T12:00:00Z`), to = new Date(from);
        from.setUTCDate(from.getUTCDate() - 1);
        to.setUTCDate(to.getUTCDate() + 1);
        const page = await this.page({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), blockedDay: date }, null, undefined, false, undefined, 1);
        return page.sessions.length > 0;
    },
    async nextSession(instant: string): Promise<Session | null> {
        const now = new Date(instant), from = new Date(now);
        from.setDate(from.getDate() - 2);
        const first = await this.page({ from: localDateString(from), upcoming: true }, null, undefined, true, instant, 1);
        const date = first.sessions[0]?.date;
        if (!date)
            return null;
        const to = new Date(`${date}T12:00:00Z`);
        to.setUTCDate(to.getUTCDate() + 3);
        // Complete a short civil-date window, even when the next booking is
        // years away. Different event timezones can change the actual order.
        return (await this.range(date, to.toISOString().slice(0, 10)))
            .filter(s => s.status !== 'cancelled' && sessionRange(s).end > now)
            .sort((a, b) => sessionRange(a).start.getTime() - sessionRange(b).start.getTime())[0] || null;
    },
    async context(statistics: boolean, instant: string): Promise<ScreenContext> {
        const { data, error } = await supabase.rpc('session_screen_context', { statistics, instant, zone: screenZone() });
        if (error)
            throw error;
        return { ...data, asOf: instant };
    },
    async marks(filters: ScreenFilters, labels: ScreenLabels): Promise<{
        date: string;
        color: string | null;
    }[]> {
        const { data, error } = await supabase.rpc('session_calendar_marks', { filters, at_venue: labels.atVenue, untitled: labels.untitled });
        if (error)
            throw error;
        return data;
    },
    async options(labels: ScreenLabels): Promise<{
        venues: string[];
        titles: string[];
    }> {
        const { data, error } = await supabase.rpc('session_screen_options', { at_venue: labels.atVenue, untitled: labels.untitled });
        if (error)
            throw error;
        return data;
    },
    async expenses(from: string, to: string): Promise<Expense[]> {
        const rows: Expense[] = [];
        for (let offset = 0;; offset += 500) {
            const { data, error } = await supabase.rpc('dashboard_expenses', { from_date: from, to_date: to, page_offset: offset });
            if (error)
                throw error;
            rows.push(...(data || []));
            if (!data || data.length < 500)
                return rows;
        }
    },
    async sessionExpenses(userId: string, sessionId: string): Promise<Expense[]> {
        const rows: Expense[] = [];
        for (let offset = 0;; offset += 500) {
            const { data, error } = await supabase.from('expenses').select('*').eq('user_id', userId).eq('session_id', sessionId).order('id').range(offset, offset + 499);
            if (error)
                throw error;
            rows.push(...(data || []));
            if (!data || data.length < 500)
                return rows;
        }
    },
    async hasSeries(userId: string, rootId: string) {
        const { data, error } = await supabase.from('sessions').select('id').eq('user_id', userId).eq('parent_session_id', rootId).limit(1);
        if (error)
            throw error;
        return Boolean(data?.length);
    },
};
// Mounted cards share one RPC batch. Each result still has its own account-scoped
// React Query key, so adding a page does not fetch existing card summaries again.
const queues = new Map<string, Map<string, {
    resolve: (value: CardSummary | null) => void;
    reject: (error: unknown) => void;
}[]>>();
export function cardSummary(userId: string, id: string): Promise<CardSummary | null> {
    return new Promise((resolve, reject) => {
        let queue = queues.get(userId);
        if (!queue) {
            queue = new Map();
            queues.set(userId, queue);
            setTimeout(() => void flush(userId), 0);
        }
        const waiting = queue.get(id) || [];
        waiting.push({ resolve, reject });
        queue.set(id, waiting);
    });
}
async function flush(userId: string) {
    const queue = queues.get(userId);
    queues.delete(userId);
    if (!queue)
        return;
    const ids = [...queue.keys()];
    for (let start = 0; start < ids.length; start += 50) {
        const batch = ids.slice(start, start + 50);
        try {
            const { data, error } = await supabase.rpc('session_card_summaries', { ids: batch });
            if (error)
                throw error;
            for (const id of batch)
                for (const waiter of queue.get(id)!)
                    waiter.resolve(data?.[id] || null);
        }
        catch (error) {
            for (const id of batch)
                for (const waiter of queue.get(id)!)
                    waiter.reject(error);
        }
    }
}
