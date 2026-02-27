import { supabase } from '../lib/supabase';
import { CreateSessionInput, Session } from '../types/session';
import { TagOption } from '../types/tag';

const TAG_COLORS = [
    '#EF4444', // red-500
    '#F97316', // orange-500
    '#F59E0B', // amber-500
    '#10B981', // emerald-500
    '#0EA5E9', // sky-500
    '#3B82F6', // blue-500
    '#6366F1', // indigo-500
    '#8B5CF6', // violet-500
    '#D946EF', // fuchsia-500
    '#F43F5E', // rose-500
];

export const getColorForString = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % TAG_COLORS.length;
    return TAG_COLORS[index];
};

export const sessionService = {
    async createSession(input: CreateSessionInput, userId: string): Promise<Session> {
        const sessionColor = input.color || getColorForString(input.title);

        // 1. Insert the session
        const { data: sessionData, error: sessionError } = await supabase
            .from('sessions')
            .insert({
                ...input,
                color: sessionColor,
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
                        { user_id: userId, type: 'title', name: input.title.trim(), color: sessionColor }
                    );
                    if (tErr && tErr.code !== '23505') console.warn('Supabase title tag error:', tErr);
                }
                if (input.venue) {
                    const { error: vErr } = await supabase.from('user_tags').insert(
                        { user_id: userId, type: 'venue', name: input.venue.trim(), color: getColorForString(input.venue.trim()) }
                    );
                    if (vErr && vErr.code !== '23505') console.warn('Supabase venue tag error:', vErr);
                }

                if (input.is_collective && input.djs && input.djs.length > 0) {
                    for (const dj of input.djs) {
                        const { error: dErr } = await supabase.from('user_tags').insert(
                            { user_id: userId, type: 'dj', name: dj.trim(), color: getColorForString(dj.trim()) }
                        );
                        if (dErr && dErr.code !== '23505') console.warn('Supabase dj tag error:', dErr);
                    }
                }
            } catch (err) {
                console.warn('Silent tag insertion failed', err);
            }
        };

        await insertTags();

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

    async getUpcomingSessions(userId: string): Promise<Session[]> {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('user_id', userId)
            .gte('date', today)
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching upcoming sessions:', error);
            throw new Error(error.message);
        }

        return data || [];
    },

    async getUserTags(userId: string, type: 'title' | 'venue' | 'dj'): Promise<TagOption[]> {
        const { data, error } = await supabase
            .from('user_tags')
            .select('name, color')
            .eq('user_id', userId)
            .eq('type', type)
            .order('name', { ascending: true });

        if (error) {
            console.error(`Error fetching ${type} tags:`, error);
            return [];
        }

        return (data || []).map(row => ({ name: row.name, color: row.color || '#3B82F6' }));
    }
};
