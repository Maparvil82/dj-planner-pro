import { supabase } from '../lib/supabase';
import { CreateSessionInput, Session } from '../types/session';

export const sessionService = {
    async createSession(input: CreateSessionInput, userId: string): Promise<Session> {
        const { data, error } = await supabase
            .from('sessions')
            .insert({
                ...input,
                user_id: userId
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating session:', error);
            throw new Error(error.message);
        }

        return data;
    },

    async getSessionsByMonth(year: number, month: number, userId: string): Promise<Session[]> {
        // Construct YYYY-MM prefix for filtering
        const jsMonth = String(month).padStart(2, '0');
        const startPath = `${year}-${jsMonth}-01`;

        // Next month logic
        const nextMonthYear = month === 12 ? year + 1 : year;
        const nextMonthStr = String(month === 12 ? 1 : month + 1).padStart(2, '0');
        const endPath = `${nextMonthYear}-${nextMonthStr}-01`;

        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('user_id', userId)
            .gte('date', startPath)
            .lt('date', endPath)
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching sessions:', error);
            throw new Error(error.message);
        }

        return data || [];
    }
};
