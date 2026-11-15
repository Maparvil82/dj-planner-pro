import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { sessionTemplates } from '../services/sessionTemplates';
import type { Session } from '../types/session';

export function useSessionTemplates(enabled: boolean) {
    const userId = useAuthStore(state => state.session?.user.id);
    const client = useQueryClient();
    const queryKey = ['session-templates', userId];
    const query = useQuery({ queryKey, enabled: !!userId && enabled, queryFn: () => sessionTemplates.list(userId!) });
    const mutation = useMutation({
        mutationFn: async (action: { kind: 'save'; name: string; session: Session } | { kind: 'rename'; id: string; name: string } | { kind: 'remove'; id: string }) => {
            if (!userId || useAuthStore.getState().session?.user.id !== userId) throw new Error('templates.storageError');
            if (action.kind === 'save') return sessionTemplates.save(userId, action.name, action.session);
            if (action.kind === 'rename') return sessionTemplates.rename(userId, action.id, action.name);
            return sessionTemplates.remove(userId, action.id);
        },
        onSuccess: rows => client.setQueryData(queryKey, rows),
    });
    return { query, mutation, userId };
}
