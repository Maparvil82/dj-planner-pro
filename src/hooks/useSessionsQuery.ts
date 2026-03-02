import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionService } from '../services/sessions';
import { useAuthStore } from '../store/useAuthStore';
import { CreateSessionInput } from '../types/session';

export const useSessionsQuery = (year: number, month: number) => {
    const { session, initialized } = useAuthStore();
    const userId = session?.user?.id;

    return useQuery({
        queryKey: ['sessions', year, month, userId],
        queryFn: () => {
            if (!userId) return [];
            return sessionService.getSessionsByMonth(year, month, userId);
        },
        enabled: !!userId && initialized,
        staleTime: 1000 * 60 * 5, // 5 minutes cache to prevent constant loading spinners
    });
};

export const useUpcomingSessionsQuery = () => {
    const { session, initialized } = useAuthStore();
    const userId = session?.user?.id;

    return useQuery({
        queryKey: ['sessions', 'upcoming', userId],
        queryFn: () => {
            if (!userId) return [];
            return sessionService.getUpcomingSessions(userId);
        },
        enabled: !!userId && initialized,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
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
            // Invalidate the tags to reflect newly saved venues/titles in the autocomplete
            queryClient.invalidateQueries({ queryKey: ['tags'] });
        },
    });
};

export const useDeleteSessionMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (sessionId: string) => {
            return sessionService.deleteSession(sessionId);
        },
        onSuccess: () => {
            // Refetch calendar and upcoming sessions
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
        },
    });
};

export const useSessionByIdQuery = (sessionId: string | undefined | string[]) => {
    const id = Array.isArray(sessionId) ? sessionId[0] : sessionId;

    return useQuery({
        queryKey: ['session', id],
        queryFn: () => {
            if (!id) return null;
            return sessionService.getSessionById(id);
        },
        enabled: !!id,
    });
};

export const useUpdateSessionColorMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ sessionId, color, updateAll }: { sessionId: string; color: string; updateAll?: boolean }) => {
            return sessionService.updateSessionColor(sessionId, color, updateAll);
        },
        onSuccess: (_, variables) => {
            if (variables.updateAll) {
                // Invalidate all session related queries as many records might have changed
                queryClient.invalidateQueries({ queryKey: ['session'] });
            } else {
                // Invalidate the specific session query
                queryClient.invalidateQueries({ queryKey: ['session', variables.sessionId] });
            }
            // Invalidate the sessions array to refetch data on the calendar
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
        },
    });
};

export const useUpdateSessionMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ sessionId, input, updateAll }: { sessionId: string; input: Partial<CreateSessionInput>; updateAll?: boolean }) => {
            return sessionService.updateSession(sessionId, input, updateAll);
        },
        onSuccess: (_, variables) => {
            if (variables.updateAll) {
                queryClient.invalidateQueries({ queryKey: ['session'] });
            } else {
                queryClient.invalidateQueries({ queryKey: ['session', variables.sessionId] });
            }
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
            queryClient.invalidateQueries({ queryKey: ['tags'] });
        },
    });
};

export const useAllSessionsQuery = () => {
    const { session, initialized } = useAuthStore();
    const userId = session?.user?.id;

    return useQuery({
        queryKey: ['sessions', 'all', userId],
        queryFn: () => {
            if (!userId) return [];
            return sessionService.getAllSessions(userId);
        },
        enabled: !!userId && initialized,
    });
};
