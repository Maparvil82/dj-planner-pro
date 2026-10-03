import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { collaborationService } from '../services/collaborations';
export function useSessionInvitations() {
    const userId = useAuthStore((state) => state.session?.user.id);
    return useQuery({
        queryKey: ['collaborations', 'inbox', userId],
        queryFn: () => collaborationService.inbox(),
        enabled: !!userId,
        refetchInterval: 30000,
    });
}
export function useSessionCollaborators(sessionId?: string) {
    const userId = useAuthStore((state) => state.session?.user.id);
    return useQuery({
        queryKey: ['collaborations', 'participants', userId, sessionId],
        queryFn: () => collaborationService.participants(sessionId!),
        enabled: !!userId && !!sessionId,
    });
}
export function useInvitationReply() {
    const userId = useAuthStore((state) => state.session?.user.id);
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({
            sessionId,
            status,
        }: {
            sessionId: string;
            status: 'accepted' | 'declined';
        }) => {
            if (!userId) throw new Error('Unauthenticated');
            return collaborationService.reply(sessionId, userId, status);
        },
        onSuccess: () =>
            Promise.all(
                [
                    'collaborations',
                    'sessions',
                    'session',
                    'community',
                    'notifications',
                ].map((key) => client.invalidateQueries({ queryKey: [key] })),
            ),
    });
}
