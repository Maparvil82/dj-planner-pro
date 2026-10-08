import type { Session } from '../types/session';
import type { SessionCollaborator } from '../services/collaborations';
import { sessionRange } from './sessionPlanning';

export interface RecentDJ {
    name: string;
    id?: string;
}
const nameKey = (name: string) =>
    name.trim().normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase();

export async function recentCollaborators(
    sessions: Session[],
    viewerId: string,
    loadParticipants: (id: string) => Promise<SessionCollaborator[]>,
    now = new Date(),
    viewerName = '',
): Promise<RecentDJ[]> {
    const completed = sessions
        .filter((s) => s.is_collective && s.status !== 'cancelled')
        .map((session) => ({
            session,
            end: sessionRange(session).end.getTime(),
        }))
        .filter((row) => row.end <= now.getTime())
        .sort(
            (a, b) => b.end - a.end || b.session.id.localeCompare(a.session.id),
        )
        .map((row) => row.session);
    const result: RecentDJ[] = [];
    const ids = new Set<string>(),
        names = new Set<string>();
    const append = (person: RecentDJ) => {
        const key = nameKey(person.name);
        if (
            !key ||
            person.id === viewerId ||
            (!person.id && key === nameKey(viewerName)) ||
            names.has(key) ||
            (person.id && ids.has(person.id))
        )
            return;
        result.push({ ...person, name: person.name.trim() });
        names.add(key);
        if (person.id) ids.add(person.id);
    };
    for (const session of completed) {
        const participants =
            !session.is_guest && session.dj_profile_ids?.length
                ? await loadParticipants(session.id)
                : [];
        if (session.is_guest && session.owner_name)
            append({ name: session.owner_name, id: session.user_id });
        if (result.length >= 3) return result.slice(0, 3);
        // An invited DJ can only read their own participant row. Recommend
        // the accepted session's host, never infer other guests' acceptance.
        if (session.is_guest) continue;
        for (const person of participants) {
            if (person.status === 'accepted')
                append({ name: person.artist_name, id: person.dj_id });
            if (result.length >= 3) return result.slice(0, 3);
        }
        // Linked invitations never become manual recommendations when declined
        // or pending. Unregistered names on a finished session remain usable.
        const linkedNames = new Set(
            participants.map((p) => nameKey(p.artist_name)),
        );
        for (const name of session.djs || []) {
            if (!linkedNames.has(nameKey(name))) append({ name });
            if (result.length >= 3) return result.slice(0, 3);
        }
    }
    return result;
}
