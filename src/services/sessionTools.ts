import { supabase } from '../lib/supabase';
export interface SessionTask {
    id: string;
    user_id: string;
    session_id: string;
    title: string;
    completed: boolean;
    created_at: string;
}
export const sessionTools = {
    async tasks(sessionId: string): Promise<SessionTask[]> {
        const { data, error } = await supabase
            .from('session_tasks')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at');
        if (error) throw error;
        return data || [];
    },
    async addTask(
        id: string,
        sessionId: string,
        userId: string,
        title: string,
    ) {
        const { error } = await supabase.from('session_tasks').upsert(
            {
                id,
                session_id: sessionId,
                user_id: userId,
                title: title.trim(),
            },
            { onConflict: 'id', ignoreDuplicates: true },
        );
        if (error) throw error;
    },
    async task(id: string, change: { completed: boolean } | { title: string }) {
        const { error } = await supabase
            .from('session_tasks')
            .update(change)
            .eq('id', id);
        if (error) throw error;
    },
    async removeTask(id: string) {
        const { error } = await supabase
            .from('session_tasks')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },
    async blockedDays(): Promise<string[]> {
        const days: string[] = [];
        for (let offset = 0; ; offset += 500) {
            const { data, error } = await supabase
                .from('blocked_days')
                .select('date')
                .order('date')
                .range(offset, offset + 499);
            if (error) throw error;
            days.push(...(data || []).map((r) => r.date));
            if (!data || data.length < 500) break;
        }
        return days;
    },

    async block(userId: string, date: string, blocked: boolean) {
        const result = blocked
            ? await supabase
                  .from('blocked_days')
                  .upsert(
                      { user_id: userId, date },
                      { onConflict: 'user_id,date', ignoreDuplicates: true },
                  )
            : await supabase
                  .from('blocked_days')
                  .delete()
                  .eq('user_id', userId)
                  .eq('date', date);
        if (result.error) throw result.error;
    },
};
