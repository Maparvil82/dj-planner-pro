import { useQuery } from '@tanstack/react-query';
import { sessionService } from '../services/sessions';
import { useAuthStore } from '../store/useAuthStore';
import { TagOption } from '../types/tag';

export const useTagsQuery = (type: 'title' | 'venue' | 'dj') => {
    const { session } = useAuthStore();
    const userId = session?.user?.id;

    return useQuery({
        queryKey: ['tags', type, userId],
        queryFn: (): Promise<TagOption[]> => {
            if (!userId) return Promise.resolve([]);
            return sessionService.getUserTags(userId, type);
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000, // 5 minutes cache
    });
};
