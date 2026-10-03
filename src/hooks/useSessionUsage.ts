import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { syncSubscriptionAccess } from '../services/subscriptionAccess';
export function useSessionUsage() {
    const userId = useAuthStore((state) => state.session?.user.id);
    return useQuery({
        queryKey: ['session-usage', userId],
        enabled: !!userId,
        staleTime: 0,
        queryFn: syncSubscriptionAccess,
        retry: 1,
    });
}
