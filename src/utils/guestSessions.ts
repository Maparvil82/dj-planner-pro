import type { Session } from '../types/session';
import { sessionPhase } from './sessionWorkflow';
import { sessionRange } from './sessionPlanning';
export function guestSessions(
    sessions: Session[],
    owner: string,
    view: 'upcoming' | 'history',
    withLists: string[],
    now: Date,
): Session[] {
    const lists = new Set(withLists);
    return sessions
        .filter((s) => {
            if (s.user_id !== owner || s.is_guest) return false;
            const phase = sessionPhase(s, now);
            return view === 'upcoming'
                ? phase === 'confirmed' || phase === 'ongoing'
                : lists.has(s.id) &&
                      (phase === 'finished' || phase === 'cancelled');
        })
        .sort((a, b) =>
            view === 'upcoming'
                ? +sessionRange(a).start - +sessionRange(b).start
                : +sessionRange(b).end - +sessionRange(a).end,
        );
}
