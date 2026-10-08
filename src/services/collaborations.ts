import { supabase } from '../lib/supabase';
import type { Session } from '../types/session';
export interface SessionInvitation {
    session_id: string;
    dj_id: string;
    inviter_id: string;
    owner_name: string;
    status: 'invited' | 'accepted' | 'declined';
    created_at: string;
    session: Session;
}
export interface SessionCollaborator {
    dj_id: string;
    artist_name: string;
    status: 'invited' | 'accepted' | 'declined';
}
export const collaborationService = {
    async inbox(): Promise<SessionInvitation[]> {
        const invitations: SessionInvitation[] = [];
        for (let offset = 0; ; offset += 1000) {
            const { data, error } = await supabase.rpc(
                'session_collaboration_inbox',
                { page_offset: offset },
            );
            if (error) throw new Error(error.message);
            invitations.push(...(data || []));
            if (!data || data.length < 1000) return invitations;
        }
    },
    async agenda(): Promise<Session[]> {
        return (await this.inbox())
            .filter((item) => item.status === 'accepted')
            .map((item) => item.session);
    },
    async participants(sessionId: string): Promise<SessionCollaborator[]> {
        const { data, error } = await supabase
            .from('session_collaborators')
            .select('dj_id,artist_name,status')
            .eq('session_id', sessionId)
            .order('created_at');
        if (error) throw new Error(error.message);
        return data || [];
    },
    async reply(
        sessionId: string,
        djId: string,
        status: 'accepted' | 'declined',
    ) {
        const { data, error } = await supabase
            .from('session_collaborators')
            .update({ status })
            .eq('session_id', sessionId)
            .eq('dj_id', djId)
            .select('session_id');
        if (error) throw new Error(error.message);
        if (!data?.length) throw new Error('Invitation unavailable');
    },
};
