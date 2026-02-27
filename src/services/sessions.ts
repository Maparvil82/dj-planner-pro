import { supabase } from '../lib/supabase';
import { CreateSessionInput, Session } from '../types/session';

export const sessionService = {
    async createSession(input: CreateSessionInput, userId: string): Promise<Session> {
        // 1. Insert the session
        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .insert({
                ...input,
                user_id: userId
            })
            .select()
            .single();

        if (sessionError) {
            console.error('Error creating session:', sessionError);
            throw new Error(sessionError.message);
        }

        // 2. Silently insert tags in the background (ignore errors and duplicates)
        // By not awaiting this, we guarantee the UI never hangs for the user.
        const insertTags = async () => {
            try {
                if (input.title) {
                    const { error: tErr } = await supabase.from('user_tags').insert(
                        { user_id: userId, type: 'title', name: input.title.trim() }
                    );
                    if (tErr && tErr.code !== '23505') console.warn('Supabase title tag error:', tErr);
                }
                if (input.venue) {
                    const { error: vErr } = await supabase.from('user_tags').insert(
                        { user_id: userId, type: 'venue', name: input.venue.trim() }
                    );
                    if (vErr && vErr.code !== '23505') console.warn('Supabase venue tag error:', vErr);
                }
            } catch (err) {
                console.warn('Silent tag insertion failed', err);
            }
        };

        insertTags();

        return sessionData;
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
    },

    async getUserTags(userId: string, type: 'title' | 'venue'): Promise<string[]> {
        const { data, error } = await supabase
            .from('user_tags')
            .select('name')
            .eq('user_id', userId)
            .eq('type', type)
            .order('name', { ascending: true });

        if (error) {
            console.error(`Error fetching ${type} tags:`, error);
            return [];
        }

        return (data || []).map(row => row.name);
    }
};
