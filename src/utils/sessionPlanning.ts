import type { CreateSessionInput, Session } from '../types/session';

type SessionTiming = Pick<CreateSessionInput, 'date' | 'start_time' | 'end_time'>;

export function localDateString(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function sessionRange(session: SessionTiming): { start: Date; end: Date } {
    const [year, month, day] = session.date.split('-').map(Number);
    const [startHour, startMinute] = (session.start_time || '00:00').split(':').map(Number);
    const [endHour, endMinute] = (session.end_time || '00:00').split(':').map(Number);
    const start = new Date(year, month - 1, day, startHour, startMinute);
    const end = new Date(year, month - 1, day, endHour, endMinute);
    if (endHour * 60 + endMinute <= startHour * 60 + startMinute) end.setDate(end.getDate() + 1);
    return { start, end };
}

// Fees use wall-clock hours, including nights that cross midnight.
export function sessionDuration(session: Pick<SessionTiming, 'start_time' | 'end_time'>): number {
    const minutes = (value: string) => { const [h, m] = (value || '00:00').split(':').map(Number); return h * 60 + m; };
    let duration = minutes(session.end_time) - minutes(session.start_time);
    if (duration <= 0) duration += 24 * 60;
    return duration / 60;
}

export function sessionEarnings(session: Pick<Session, 'earning_type' | 'earning_amount' | 'start_time' | 'end_time'>): number {
    const amount = Number(session.earning_amount) || 0;
    return session.earning_type === 'fixed' ? amount : session.earning_type === 'hourly' ? amount * sessionDuration(session) : 0;
}

export function sessionBalance(session: Session): number {
    return Math.max(0, Math.round((sessionEarnings(session) - Number(session.amount_paid || 0)) * 100) / 100);
}

export function earningsByCurrency(sessions: Session[]): Record<string, number> {
    const totals: Record<string, number> = {};
    sessions.forEach(session => {
        if (session.status === 'cancelled') return;
        const currency = session.currency || '€';
        totals[currency] = (totals[currency] || 0) + sessionEarnings(session);
    });
    return totals;
}

export function recurrenceDates(input: Pick<CreateSessionInput, 'date' | 'recurrence_type' | 'recurrence_end_date'>): string[] {
    if (!input.recurrence_type || input.recurrence_type === 'none') return [input.date];
    if (!input.recurrence_end_date || input.recurrence_end_date < input.date) throw new Error('invalid_recurrence');
    const dates = [input.date];
    const origin = new Date(`${input.date}T12:00:00Z`);
    const monthSteps: Record<string, number> = { monthly: 1, quarterly: 3, biannually: 6, yearly: 12 };
    for (let index = 1; ; index++) {
        const next = new Date(origin);
        if (input.recurrence_type === 'daily' || input.recurrence_type === 'weekly') {
            next.setUTCDate(origin.getUTCDate() + index * (input.recurrence_type === 'daily' ? 1 : 7));
        } else {
            const step = monthSteps[input.recurrence_type];
            if (!step) throw new Error('invalid_recurrence');
            // Always anchor to the original day: Jan 31 -> Feb 28 -> Mar 31.
            next.setUTCDate(1);
            next.setUTCMonth(origin.getUTCMonth() + index * step);
            const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
            next.setUTCDate(Math.min(origin.getUTCDate(), lastDay));
        }
        const date = next.toISOString().slice(0, 10);
        if (date > input.recurrence_end_date) return dates;
        if (dates.length >= 500) throw new Error('recurrence_limit');
        dates.push(date);
    }
}

export function findSessionConflicts(candidates: SessionTiming[], existing: Session[]): Session[] {
    const ranges = candidates.map(sessionRange);
    return existing.filter(session => {
        if (session.status === 'cancelled' || !session.start_time || !session.end_time) return false;
        const range = sessionRange(session);
        return ranges.some(candidate => candidate.start < range.end && range.start < candidate.end);
    });
}
