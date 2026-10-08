import type { CreateSessionInput, Session } from '../types/session';

type SessionTiming = Pick<
    CreateSessionInput,
    'date' | 'start_time' | 'end_time' | 'booking_timezone'
>;

export function localDateString(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function sessionRange(session: SessionTiming): {
    start: Date;
    end: Date;
} {
    const [year, month, day] = session.date.split('-').map(Number);
    const [startHour, startMinute] = (session.start_time || '00:00')
        .split(':')
        .map(Number);
    const [endHour, endMinute] = (session.end_time || '00:00')
        .split(':')
        .map(Number);
    const start = new Date(year, month - 1, day, startHour, startMinute);
    const end = new Date(year, month - 1, day, endHour, endMinute);
    if (endHour * 60 + endMinute <= startHour * 60 + startMinute)
        end.setDate(end.getDate() + 1);
    if (!session.booking_timezone) return { start, end };
    const inZone = (wall: number) => {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: session.booking_timezone!,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        });
        let instant = wall;
        const seen = new Set<number>();
        for (let i = 0; i < 4; i++) {
            const parts = Object.fromEntries(
                formatter
                    .formatToParts(new Date(instant))
                    .map((p) => [p.type, p.value]),
            );
            const displayed = Date.UTC(
                Number(parts.year),
                Number(parts.month) - 1,
                Number(parts.day),
                Number(parts.hour),
                Number(parts.minute),
            );
            const next = instant + wall - displayed;
            if (next === instant) break;
            // Match Postgres: nonexistent spring-forward times advance past the gap.
            if (seen.has(next)) {
                instant = Math.max(instant, next);
                break;
            }
            seen.add(instant);
            instant = next;
        }
        return new Date(instant);
    };
    const overnight = endHour * 60 + endMinute <= startHour * 60 + startMinute;
    return {
        start: inZone(Date.UTC(year, month - 1, day, startHour, startMinute)),
        end: inZone(
            Date.UTC(
                year,
                month - 1,
                day + (overnight ? 1 : 0),
                endHour,
                endMinute,
            ),
        ),
    };
}

// Fees use wall-clock hours, including nights that cross midnight.
export function sessionDuration(
    session: Pick<SessionTiming, 'start_time' | 'end_time'>,
): number {
    const minutes = (value: string) => {
        const [h, m] = (value || '00:00').split(':').map(Number);
        return h * 60 + m;
    };
    let duration = minutes(session.end_time) - minutes(session.start_time);
    if (duration <= 0) duration += 24 * 60;
    return duration / 60;
}

export function sessionEarnings(
    session: Pick<
        Session,
        'earning_type' | 'earning_amount' | 'start_time' | 'end_time'
    > &
        Partial<Pick<Session, 'is_guest'>>,
): number {
    if (session.is_guest) return 0;
    const amount = Number(session.earning_amount) || 0;
    return session.earning_type === 'fixed' ||
        session.earning_type === 'agreement'
        ? amount
        : session.earning_type === 'hourly'
          ? amount * sessionDuration(session)
          : 0;
}

export function sessionBalance(session: Session): number {
    return Math.max(
        0,
        Math.round(
            (sessionEarnings(session) - Number(session.amount_paid || 0)) * 100,
        ) / 100,
    );
}

export function earningsByCurrency(
    sessions: Session[],
): Record<string, number> {
    const totals: Record<string, number> = {};
    sessions.forEach((session) => {
        if (session.status === 'cancelled' || session.is_guest) return;
        const currency = session.currency || '€';
        totals[currency] = (totals[currency] || 0) + sessionEarnings(session);
    });
    return totals;
}

export function recurrenceDates(
    input: Pick<
        CreateSessionInput,
        'date' | 'recurrence_type' | 'recurrence_end_date'
    >,
): string[] {
    if (!input.recurrence_type || input.recurrence_type === 'none')
        return [input.date];
    if (!input.recurrence_end_date || input.recurrence_end_date < input.date)
        throw new Error('invalid_recurrence');
    const dates = [input.date];
    const origin = new Date(`${input.date}T12:00:00Z`);
    const monthSteps: Record<string, number> = {
        monthly: 1,
        quarterly: 3,
        biannually: 6,
        yearly: 12,
    };
    for (let index = 1; ; index++) {
        const next = new Date(origin);
        if (
            input.recurrence_type === 'daily' ||
            input.recurrence_type === 'weekly'
        ) {
            next.setUTCDate(
                origin.getUTCDate() +
                    index * (input.recurrence_type === 'daily' ? 1 : 7),
            );
        } else {
            const step = monthSteps[input.recurrence_type];
            if (!step) throw new Error('invalid_recurrence');
            // Always anchor to the original day: Jan 31 -> Feb 28 -> Mar 31.
            next.setUTCDate(1);
            next.setUTCMonth(origin.getUTCMonth() + index * step);
            const lastDay = new Date(
                Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
            ).getUTCDate();
            next.setUTCDate(Math.min(origin.getUTCDate(), lastDay));
        }
        const date = next.toISOString().slice(0, 10);
        if (date > input.recurrence_end_date) return dates;
        if (dates.length >= 500) throw new Error('recurrence_limit');
        dates.push(date);
    }
}

export function findSessionConflicts(
    candidates: SessionTiming[],
    existing: Session[],
): Session[] {
    const ranges = candidates.map(sessionRange);
    return existing.filter((session) => {
        if (
            session.status === 'cancelled' ||
            !session.start_time ||
            !session.end_time
        )
            return false;
        const range = sessionRange(session);
        return ranges.some(
            (candidate) =>
                candidate.start < range.end && range.start < candidate.end,
        );
    });
}

// Money and cancellation are independent; guests never inherit the organiser's fee.
export function sessionPaymentState(session: Session) {
    if (session.status === 'cancelled') return 'cancelled';
    if (session.is_guest) return 'guest';
    if (session.earning_type === 'agreement' && !session.fee_agreement?.settled)
        return 'unsettled';
    const total = Math.round(sessionEarnings(session) * 100);
    const received = Math.round(Number(session.amount_paid || 0) * 100);
    if (total <= 0) return received > 0 ? 'received' : 'free';
    return received >= total ? 'paid' : received > 0 ? 'partial' : 'unpaid';
}
