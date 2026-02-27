import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionService } from '../services/sessions';
import { useAuthStore } from '../store/useAuthStore';
import { CreateSessionInput } from '../types/session';

export const useSessionsQuery = (year: number, month: number) => {
    const { session } = useAuthStore();
    const userId = session?.user?.id;

    return useQuery({
        queryKey: ['sessions', year, month, userId],
        queryFn: () => {
            if (!userId) return [];
            return sessionService.getSessionsByMonth(year, month, userId);
        },
        enabled: !!userId,
    });
};

export const useCreateSessionMutation = () => {
    const queryClient = useQueryClient();
    const { session } = useAuthStore();
    const userId = session?.user?.id;

    return useMutation({
        mutationFn: (input: CreateSessionInput) => {
            if (!userId) throw new Error('User not authenticated');
            return sessionService.createSession(input, userId);
        },
        onSuccess: () => {
            // Invalidate the sessions array to refetch data on the calendar
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
        },
    });
};

