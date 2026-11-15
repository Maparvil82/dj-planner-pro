import { useEffect, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { sessionScreens, cardSummary, screenZone, type ScreenFilters, type ScreenLabels, type SessionCursor } from '../services/sessionScreens';
function useIdentity() { const userId = useAuthStore(state => state.session?.user.id); const initialized = useAuthStore(state => state.initialized); return { userId, ready: initialized && Boolean(userId), focused: useIsFocused() }; }
export function useSessionRangeQuery(from: string, to: string, enabled = true) {
    const { userId, ready, focused } = useIdentity();
    return useQuery({ queryKey: ['sessions', 'range', userId, from, to], enabled: ready && focused && enabled, queryFn: () => sessionScreens.range(from, to) });
}
export function useSessionScreenContext(statistics = false) {
    const { userId, ready, focused } = useIdentity();
    return useQuery({
        queryKey: ['sessions', 'screen-context', userId, statistics, screenZone()],
        enabled: ready && focused,
        queryFn: () => sessionScreens.context(statistics, new Date().toISOString()),
        refetchInterval: statistics && focused ? 60000 : false,
    });
}
export function useSessionFeed(filters: ScreenFilters, labels?: ScreenLabels, enabled = true, instant?: string) {
    const { userId, ready, focused } = useIdentity();
    return useInfiniteQuery({ queryKey: ['sessions', 'screen-feed', userId, filters, labels, instant], enabled: ready && focused && enabled, initialPageParam: null as SessionCursor | null,
        queryFn: ({ pageParam }) => sessionScreens.page(filters, pageParam, labels, false, instant), getNextPageParam: page => page.nextCursor ?? undefined });
}
export function useSessionFilterOptions(labels: ScreenLabels, enabled: boolean) {
    const { userId, ready, focused } = useIdentity();
    return useQuery({ queryKey: ['sessions', 'screen-options', userId, labels], enabled: ready && focused && enabled, queryFn: () => sessionScreens.options(labels) });
}
export function useDashboardExpenses(from: string, to: string) {
    const { userId, ready, focused } = useIdentity();
    return useQuery({ queryKey: ['expenses', 'dashboard-range', userId, from, to], enabled: ready && focused, queryFn: () => sessionScreens.expenses(from, to) });
}
export function useSessionCardSummary(session: {
    id: string;
    user_id: string;
    is_guest?: boolean;
}) {
    const { userId, ready, focused } = useIdentity();
    return useQuery({ queryKey: ['session-tasks', 'card-summary', userId, session.id], enabled: ready && focused && !session.is_guest && session.user_id === userId, queryFn: () => cardSummary(userId!, session.id) });
}
export function useSessionExpensesQuery(session: {
    id: string;
    user_id: string;
    is_guest?: boolean;
}) {
    const { userId, ready, focused } = useIdentity();
    return useQuery({ queryKey: ['expenses', 'session', userId, session.id], enabled: ready && focused && !session.is_guest && session.user_id === userId, queryFn: () => sessionScreens.sessionExpenses(userId!, session.id) });
}
export function useDebouncedValue<T>(value: T, delay = 250) { const [debounced, setDebounced] = useState(value); useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [value, delay]); return debounced; }
export function useSessionCalendarMarks(filters: ScreenFilters, labels: ScreenLabels, enabled: boolean) {
    const { userId, ready, focused } = useIdentity();
    return useQuery({ queryKey: ['sessions', 'calendar-marks', userId, filters, labels], enabled: ready && focused && enabled, queryFn: () => sessionScreens.marks(filters, labels) });
}
export function useSessionDayOccupied(date: string, enabled: boolean) {
    const { userId, ready, focused } = useIdentity();
    return useQuery({ queryKey: ['sessions', 'day-occupied', userId, date], enabled: ready && focused && enabled, queryFn: () => sessionScreens.dayOccupied(date) });
}
export function useNextSessionQuery() {
    const { userId, ready, focused } = useIdentity();
    return useQuery({
        queryKey: ['sessions', 'next-session', userId], enabled: ready && focused,
        queryFn: () => sessionScreens.nextSession(new Date().toISOString()),
        refetchInterval: focused ? 60000 : false,
    });
}
