import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { safetyService } from '../services/communitySafety';
export function useCommunitySafetyStatus() {
    const viewer = useAuthStore((s) => s.session?.user.id);
    return useQuery({
        queryKey: ['community-safety', viewer, 'status'],
        queryFn: safetyService.status,
        enabled: !!viewer,
        staleTime: 60000,
    });
}
export function useInvalidateCommunitySafety() {
    const client = useQueryClient();
    return async () => {
        // Discard cached identity, artwork and feeds before fetching the filtered server data.
        await Promise.all([
            client.resetQueries({ queryKey: ['community'] }),
            client.invalidateQueries({ queryKey: ['community-safety'] }),
            client.resetQueries({ queryKey: ['notifications'] }),
            client.resetQueries({ queryKey: ['collaborations'] }),
            client.resetQueries({ queryKey: ['saved-mixes'] }),
        ]);
    };
}
