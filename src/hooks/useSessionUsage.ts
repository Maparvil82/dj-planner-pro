import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { getCurrentAccess } from '../services/subscriptionAccess';
import { useEffect } from 'react';
import { AppState } from 'react-native';
export function useSessionUsage() {
    const userId = useAuthStore((state) => state.session?.user.id);
    const query = useQuery({
        queryKey: ['session-usage', userId],
        enabled: !!userId,
        staleTime: 0,
        queryFn: getCurrentAccess,
        retry: 1,
    });
    const { refetch } = query;
    useEffect(() => {
        const trial = query.data?.trial;
        if (trial?.status !== 'active' || !trial.expiresAt || !query.data?.serverNow) return;
        const remaining = Date.parse(trial.expiresAt) - Date.parse(query.data.serverNow) - (Date.now() - query.dataUpdatedAt);
        // Long trials exceed the native timer limit; check again each day.
        const timer = setTimeout(() => void refetch(), Math.min(86400000, Math.max(100, remaining + 100)));
        return () => clearTimeout(timer);
    }, [query.data, query.dataUpdatedAt, refetch]);
    useEffect(() => {
        const listener = AppState.addEventListener('change', state => { if (state === 'active' && userId) void refetch(); });
        return () => listener.remove();
    }, [userId, refetch]);
    return query;
}
