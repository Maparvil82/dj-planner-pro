import { recurrenceDates } from './sessionPlanning';
import type { CreateSessionInput } from '../types/session';
// Blocks refer to civil calendar days in the event timezone. Include the next
// day for overnight sessions, except when they finish exactly at midnight.
export function blockedSessionDays(
    input: CreateSessionInput,
    blocked: string[],
): string[] {
    const dates = new Set<string>();
    for (const date of recurrenceDates(input)) {
        dates.add(date);
        const minutes = (v: string) =>
            Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
        if (
            minutes(input.end_time) <= minutes(input.start_time) &&
            minutes(input.end_time) !== 0
        ) {
            const next = new Date(`${date}T12:00:00Z`);
            next.setUTCDate(next.getUTCDate() + 1);
            dates.add(next.toISOString().slice(0, 10));
        }
    }
    return blocked.filter((d) => dates.has(d));
}
