import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { sessionService } from '../services/sessions';
import { collaborationService } from '../services/collaborations';
import { recentCollaborators } from '../utils/recentCollaborators';

export function useRecentCollaborators(enabled: boolean) {
    const userId = useAuthStore((state) => state.session?.user.id);
    const artistName = useAuthStore(
        (state) => state.profile?.artist_name || '',
    );
    const client = useQueryClient();
    return useQuery({
        queryKey: ['collaborations', 'recent', userId, artistName],
        enabled: enabled && !!userId,
        staleTime: 60000,
        queryFn: async () => {
            if (!userId) return [];
            const sessions = await client.fetchQuery({
                queryKey: ['sessions', 'all', userId],
                queryFn: () => sessionService.getAllSessions(userId),
                staleTime: 60000,
            });
            return recentCollaborators(
                sessions,
                userId,
                (id) => collaborationService.participants(id),
                new Date(),
                artistName,
            );
        },
    });
}
