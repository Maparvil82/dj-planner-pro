import { supabase } from '../lib/supabase';
export interface SocialNotification {
    id: string;
    recipient_id: string;
    actor_id: string;
    kind:
        | 'follow'
        | 'shared_session'
        | 'session_invitation'
        | 'invitation_response'
        | 'session_update';
    session_id: string | null;
    actor_name: string;
    session_title: string | null;
    response: 'accepted' | 'declined' | null;
    created_at: string;
    read_at: string | null;
}
export const NOTIFICATION_PAGE_SIZE = 20;
export const notificationService = {
    async list(userId: string, offset: number): Promise<SocialNotification[]> {
        const { data, error } = await supabase
            .from('social_notifications')
            .select('*')
            .eq('recipient_id', userId)
            .order('created_at', { ascending: false })
            .order('id')
            .range(offset, offset + NOTIFICATION_PAGE_SIZE - 1);
        if (error) throw error;
        return data || [];
    },
    async unread(userId: string): Promise<number> {
        const { count, error } = await supabase
            .from('social_notifications')
            .select('id', { count: 'exact', head: true })
            .eq('recipient_id', userId)
            .is('read_at', null);
        if (error) throw error;
        return count || 0;
    },
    async markRead(userId: string, id?: string) {
        let query = supabase
            .from('social_notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('recipient_id', userId)
            .is('read_at', null);
        if (id) query = query.eq('id', id);
        const { error } = await query;
        if (error) throw error;
    },
};
