import { supabase } from '../lib/supabase';
import { CreateSessionInput, Session } from '../types/session';
import { TagOption } from '../types/tag';

const TAG_COLORS: string[] = [];

export const getColorForString = (str: string) => {
    // The user requested to default to the Neutral 800 black color used in the "Prevees_ganar" tracking card.
    return '#262626';
};

export const sessionService = {
    async createSession(input: CreateSessionInput, userId: string): Promise<Session> {
        const sessionColor = input.color || getColorForString(input.title);

        let sessionsToInsert: any[] = [];

        // Helper to add days/months/years robustly
        const calculateNextDate = (currentDate: string, type: string) => {
            const d = new Date(currentDate + 'T12:00:00Z');
            if (type === 'daily') d.setUTCDate(d.getUTCDate() + 1);
            else if (type === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
            else if (type === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
            else if (type === 'quarterly') d.setUTCMonth(d.getUTCMonth() + 3);
            else if (type === 'biannually') d.setUTCMonth(d.getUTCMonth() + 6);
            else if (type === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1);
            else throw new Error(`Unsupported recurrence type: ${type}`);
            return d.toISOString().split('T')[0];
        };

        const baseSession = {
            ...input,
            color: sessionColor,
            user_id: userId
        };

        if (input.recurrence_type && input.recurrence_type !== 'none' && input.recurrence_end_date) {
            // Generate all dates
            let currDate = input.date;
            const endDate = input.recurrence_end_date;

            // We use 'parent_session_id' dynamically, but for Supabase we can generate a random UUID 
            // string if needed, or simply let the first session be the parent of the others.
            // For simplicity, we'll insert the first one to get its ID, then insert the rest.

            const { data: firstSession, error: firstError } = await supabase
                .from('sessions')
                .insert(baseSession)
                .select()
                .single();

            if (firstError) {
                console.error('Error creating first recurring session:', firstError);
                throw new Error(firstError.message);
            }

            const parentId = firstSession.id;
            currDate = calculateNextDate(currDate, input.recurrence_type);

            let iterations = 0;
            const MAX_ITERATIONS = 500; // Safeguard against infinite loops 

            while (currDate <= endDate) {
                if (iterations > MAX_ITERATIONS) {
                    console.error('Safeguard reached: too many recurring sessions generated.');
                    break;
                }
                sessionsToInsert.push({
                    ...baseSession,
                    date: currDate,
                    parent_session_id: parentId
                });

                const nextDate = calculateNextDate(currDate, input.recurrence_type);
                if (nextDate === currDate) throw new Error('Infinite loop detected in date calculation.');
                currDate = nextDate;
                iterations++;
            }

            if (sessionsToInsert.length > 0) {
                const { error: bulkError } = await supabase
                    .from('sessions')
                    .insert(sessionsToInsert);

                if (bulkError) {
                    console.error('Error creating recurring sessions instances:', bulkError);
                    // Decide if you want to throw or continue. We'll throw to alert the user.
                    throw new Error(bulkError.message);
                }
            }

            // Re-assign sessionData to the first created session so it can return successfully
            var sessionData = firstSession; // using var because block scoping with the single insert above
            var sessionError = null;
        } else {
            // Standard single insert
            var { data: singleSession, error: singleError } = await supabase
                .from('sessions')
                .insert(baseSession)
                .select()
                .single();

            if (singleError) {
                console.error('Error creating session:', singleError);
                throw new Error(singleError.message);
            }
            var sessionData = singleSession;
        }

        // 2. Silently insert tags in the background (ignore errors and duplicates)
        this.syncTags(input, userId).catch(err => console.warn('Silent tag insertion failed', err));

        return sessionData;
    },

    /**
     * Non-blocking tag synchronization.
     * Uses Promise.allSettled to parallelize inserts and ignore duplicate errors (23505).
     */
    async syncTags(input: Partial<CreateSessionInput>, userId: string): Promise<void> {
        try {
            const tagsToSync = [];
            
            if (input.title) {
                tagsToSync.push(
                    supabase.from('user_tags').insert({
                        user_id: userId,
                        type: 'title',
                        name: input.title.trim(),
                        color: input.color || getColorForString(input.title)
                    })
                );
            }
            
            if (input.venue) {
                tagsToSync.push(
                    supabase.from('user_tags').insert({
                        user_id: userId,
                        type: 'venue',
                        name: input.venue.trim(),
                        color: getColorForString(input.venue.trim())
                    })
                );
            }

            if (input.is_collective && input.djs && input.djs.length > 0) {
                input.djs.forEach(dj => {
                    tagsToSync.push(
                        supabase.from('user_tags').insert({
                            user_id: userId,
                            type: 'dj',
                            name: dj.trim(),
                            color: getColorForString(dj.trim())
                        })
                    );
                });
            }

            if (tagsToSync.length > 0) {
                // Use allSettled so one failure doesn't block others
                await Promise.allSettled(tagsToSync);
            }
        } catch (err) {
            console.warn('[syncTags] Silent failure:', err);
        }
    },

    async getAllSessions(userId: string): Promise<Session[]> {
        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching all sessions:', error);
            throw new Error(error.message);
        }

        return data || [];
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
            .order('date', { ascending: true })
            .limit(30);

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
    },

    async getSessionById(sessionId: string): Promise<Session | null> {
        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (error) {
            console.error('Error fetching session by id:', error);
            throw new Error(error.message);
        }

        return data || null;
    },

    async deleteSession(sessionId: string): Promise<void> {
        const { error } = await supabase
            .from('sessions')
            .delete()
            .eq('id', sessionId);

        if (error) {
            console.error('Error deleting session:', error);
            throw new Error(error.message);
        }
    },

    async updateSessionColor(sessionId: string, color: string, updateAll: boolean = false): Promise<void> {
        if (!updateAll) {
            const { error } = await supabase
                .from('sessions')
                .update({ color })
                .eq('id', sessionId);
            if (error) throw new Error(error.message);
            return;
        }

        // Broad update logic
        const { data: session } = await supabase
            .from('sessions')
            .select('title, parent_session_id, user_id')
            .eq('id', sessionId)
            .single();

        if (!session) throw new Error('Session not found');

        let query = supabase.from('sessions').update({ color }).eq('user_id', session.user_id);

        if (session.parent_session_id) {
            // It's a child in a series
            query = query.or(`id.eq.${session.parent_session_id},parent_session_id.eq.${session.parent_session_id}`);
        } else {
            // Check if it's a parent
            const { data: children } = await supabase
                .from('sessions')
                .select('id')
                .eq('parent_session_id', sessionId)
                .limit(1);

            if (children && children.length > 0) {
                // It's a parent
                query = query.or(`id.eq.${sessionId},parent_session_id.eq.${sessionId}`);
            } else {
                // Not a series, update by title as requested ("todas las de [Nombre]")
                query = query.eq('title', session.title);
            }
        }

        const { error } = await query;
        if (error) {
            console.error('Error updating multiple session colors:', error);
            throw new Error(error.message);
        }
    },
    async updateSession(sessionId: string, input: Partial<CreateSessionInput>, userId: string, updateAll: boolean = false): Promise<void> {
        if (!updateAll) {
            const { error } = await supabase
                .from('sessions')
                .update({
                    ...input,
                    updated_at: new Date().toISOString()
                })
                .eq('id', sessionId);

            if (error) {
                console.error('Error updating session:', error);
                throw new Error(error.message);
            }
            
            // Sync tags in background
            this.syncTags(input, userId).catch(e => console.warn('Tag sync error:', e));
            
            return;
        }

        // Broad update logic
        const { data: session } = await supabase
            .from('sessions')
            .select('title, parent_session_id, user_id')
            .eq('id', sessionId)
            .single();

        if (!session) throw new Error('Session not found');

        // SAFEGUARD: If updating all, we MUST NOT update the date or unique IDs
        // to avoid overwriting the specific dates of recurring events.
        const { date, id, user_id, parent_session_id, ...syncableInput } = input as any;

        let query = supabase.from('sessions').update({
            ...syncableInput,
            updated_at: new Date().toISOString()
        }).eq('user_id', session.user_id);

        if (session.parent_session_id) {
            // It's a child in a series
            query = query.or(`id.eq.${session.parent_session_id},parent_session_id.eq.${session.parent_session_id}`);
        } else {
            // Check if it's a parent
            const { data: children } = await supabase
                .from('sessions')
                .select('id')
                .eq('parent_session_id', sessionId)
                .limit(1);

            if (children && children.length > 0) {
                // It's a parent
                query = query.or(`id.eq.${sessionId},parent_session_id.eq.${sessionId}`);
            } else {
                // Not a series, update by title as requested ("todas las de [Nombre]")
                query = query.eq('title', session.title);
            }
        }

        const { error } = await query;
        if (error) {
            console.error('Error updating multiple sessions:', error);
            throw new Error(error.message);
        }

        // Sync tags in background
        this.syncTags(input, userId).catch(e => console.warn('Tag sync error:', e));
    },

    async uploadSessionPoster(userId: string, imageUri: string): Promise<string | null> {
        try {
            const { decode } = await import('base64-arraybuffer');
            const ImageManipulator = await import('expo-image-manipulator');

            // 1. Compress & format image
            const manipulatedImage = await ImageManipulator.manipulateAsync(
                imageUri,
                [{ resize: { width: 1200 } }],
                { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            if (!manipulatedImage.base64) {
                throw new Error("Failed to get base64 string from image");
            }

            const filePath = `${userId}/poster_${Date.now()}.jpg`;
            const contentType = 'image/jpeg';

            // 2. Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('sessions')
                .upload(filePath, decode(manipulatedImage.base64), {
                    contentType,
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            // 3. Get public URL
            const { data: publicUrlData } = supabase.storage
                .from('sessions')
                .getPublicUrl(filePath);

            return publicUrlData.publicUrl;
        } catch (error) {
            console.error('Upload Session Poster Error:', error);
            return null;
        }
    },

    async deleteSessionPoster(imageUrl: string): Promise<void> {
        try {
            // Strip query parameters for correct path extraction
            const cleanUrl = imageUrl.split('?')[0];
            const parts = cleanUrl.split('/public/sessions/');
            if (parts.length < 2) return;

            const filePath = parts[1];
            const { error } = await supabase.storage
                .from('sessions')
                .remove([filePath]);

            if (error) throw error;
        } catch (error) {
            console.error('Delete Session Poster Error:', error);
        }
    }
};
