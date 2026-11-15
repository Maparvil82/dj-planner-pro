import { useQuery } from '@tanstack/react-query';
import { sessionTools } from '../services/sessionTools';
import { useAuthStore } from '../store/useAuthStore';
export function useBlockedDays() {
    const id = useAuthStore((s) => s.session?.user.id);
    return useQuery({
        queryKey: ['blocked-days', id],
        queryFn: sessionTools.blockedDays,
        enabled: !!id,
    });
}
