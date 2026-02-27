import { useQuery } from '@tanstack/react-query';
import { sessionService } from '../services/sessions';
import { useAuthStore } from '../store/useAuthStore';

export const useTagsQuery = (type: 'title' | 'venue') => {
    const { session } = useAuthStore();
    const userId = session?.user?.id;

    return useQuery({
        queryKey: ['tags', type, userId],
        queryFn: () => {
            if (!userId) return [];
            return sessionService.getUserTags(userId, type);
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });
};
