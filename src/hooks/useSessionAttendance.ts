import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { guestService } from '../services/guests';
import { entryCounterService } from '../services/entryCounter';
import type { Session } from '../types/session';

// Cards and badges observe the same keys so edits refresh both, even when
// there is no details section yet or the user has folded it.
export function useSessionAttendance(session: Session) {
    const userId = useAuthStore(state => state.session?.user.id);
    const own = !!userId && !session.is_guest && session.user_id === userId;
    const guests = useQuery({
        queryKey: ['guests', userId, session.id],
        queryFn: () => guestService.list(session.id),
        enabled: own,
    });
    const entries = useQuery({
        queryKey: ['entry-counter', userId, session.id],
        queryFn: () => entryCounterService.count(session.id),
        enabled: own,
    });
    const total = guests.data?.reduce((sum, row) => sum + Number(row.total), 0) ?? 0;
    const admitted = guests.data?.reduce((sum, row) => sum + Number(row.admitted), 0) ?? 0;
    return { own, guests, entries, total, admitted };
}
