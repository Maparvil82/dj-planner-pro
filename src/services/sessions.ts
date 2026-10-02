import { Platform } from 'react-native';
import { collaborationService } from './collaborations';
import { supabase } from '../lib/supabase';
import { CreateSessionInput, Session } from '../types/session';
import { TagOption } from '../types/tag';
import { recurrenceDates, findSessionConflicts, localDateString, sessionRange } from '../utils/sessionPlanning';

import { relatedSessionTargets, validateSessionInput } from '../utils/sessionWorkflow';

const TAG_COLORS: string[] = [];

export const getColorForString = (str: string) => {
    // The user requested to default to the Neutral 800 black color used in the "Prevees_ganar" tracking card.
    return '#262626';
};

export const sessionService = {
    async createSession(input: CreateSessionInput, userId: string): Promise<Session> {
        input = validateSessionInput(input);
        const dates = recurrenceDates(input);
        const { data, error } = await supabase.rpc('create_session_series', {
            input: { ...input, color: input.color || getColorForString(input.title) },
            session_dates: dates,
        }).single();
        if (error) throw new Error(error.message);
        if (!data) throw new Error('error_saving_session');
        this.syncTags(input, userId).catch(err => console.warn('Tag synchronization failed', err));
        return data as Session;
    },

    async getCreationConflicts(input: CreateSessionInput, userId: string): Promise<Session[]> {
        const candidates = recurrenceDates(input).map(date => ({ ...input, date }));
        return findSessionConflicts(candidates, await this.getAllSessions(userId));
    },

    async getUpdateConflicts(sessionId: string, input: Partial<CreateSessionInput>, userId: string, updateAll: boolean): Promise<Session[]> {
        const sessions = await this.getAllSessions(userId);
        const current = sessions.find(session => session.id === sessionId);
        if (!current || current.is_guest) throw new Error('error_loading_session');
        const targets = relatedSessionTargets(sessions, current, updateAll);
        const candidates = targets.map(session => ({ ...session, ...input, date: updateAll ? session.date : input.date || session.date }))
            .filter(session => session.status !== 'cancelled');
        const targetIds = new Set(targets.map(session => session.id));
        const outside = findSessionConflicts(candidates, sessions.filter(session => !targetIds.has(session.id)));
        // Changes to all dates can also make members of that series overlap.
        const inside = candidates.filter((candidate, index) => findSessionConflicts([candidate], candidates.filter((_, other) => index !== other)).length > 0);
        return [...outside, ...inside];
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
        const sessions: Session[] = [];
        const pageSize = 1000;
        for (let offset = 0; ; offset += pageSize) {
            const { data, error } = await supabase.from('sessions').select('*')
                .eq('user_id', userId).order('date', { ascending: false }).order('id')
                .range(offset, offset + pageSize - 1);
            if (error) throw new Error(error.message);
            sessions.push(...(data || []));
            if (!data || data.length < pageSize) return [...sessions, ...await collaborationService.agenda()].sort((a, b) => b.date.localeCompare(a.date));
        }
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

        const guests = (await collaborationService.agenda()).filter(session => session.date >= startPath && session.date < endPath);
        return [...(data || []), ...guests].sort((a, b) => a.date.localeCompare(b.date));
    },

    async getUpcomingSessions(userId: string): Promise<Session[]> {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const today = localDateString(yesterday);

        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('user_id', userId)
            .gte('date', today)
            .or('status.is.null,status.neq.cancelled')
            .order('date', { ascending: true })
            .order('start_time', { ascending: true })
            .limit(100);

        if (error) {
            console.error('Error fetching upcoming sessions:', error);
            throw new Error(error.message);
        }

        const guests = (await collaborationService.agenda()).filter(session => session.date >= today && session.status !== 'cancelled');
        return [...(data || []), ...guests].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)).filter((session: Session) => sessionRange(session).end > new Date()).slice(0, 30);
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

        if (error?.code === 'PGRST116') return (await collaborationService.agenda()).find(session => session.id === sessionId) || null;
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

    async updateSessionColor(sessionId: string, color: string, updateAll = false): Promise<void> {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) throw new Error('error_loading_session');
        await this.updateSession(sessionId, { color }, user.id, updateAll);
    },
    async updateSession(sessionId: string, input: Partial<CreateSessionInput>, userId: string, updateAll = false): Promise<void> {
        const sessions = await this.getAllSessions(userId);
        const current = sessions.find(session => session.id === sessionId);
        if (!current || current.is_guest) throw new Error('error_loading_session');
        const targets = relatedSessionTargets(sessions, current, updateAll);
        const allowed = ['title', 'venue', 'venue_id', 'start_time', 'end_time', 'is_collective', 'djs', 'dj_profile_ids', 'earning_type', 'earning_amount', 'currency', 'color', 'status', 'poster_url', 'poster_focus_x', 'poster_focus_y', ...(updateAll ? [] : ['date'])];
        const changes = Object.fromEntries(Object.entries(input).filter(([key, value]) => allowed.includes(key) && value !== undefined));
        if (!Object.keys(changes).length) return;
        if (Object.keys(changes).some(key => key !== 'color')) {
            for (const target of targets) {
                validateSessionInput({ ...target, start_time: target.start_time.slice(0, 5), end_time: target.end_time.slice(0, 5), ...changes, recurrence_type: 'none' });
            }
        }
        const { data, error } = await supabase.from('sessions')
            .update({ ...changes, updated_at: new Date().toISOString() })
            .eq('user_id', userId).in('id', targets.map(target => target.id)).select('id');
        if (error) throw new Error(error.message);
        if (!data?.length) throw new Error('error_saving_session');
        this.syncTags(changes, userId).catch(error => console.warn('Tag synchronization failed', error));
    },

    async uploadSessionPoster(userId: string, imageUri: string, dimensions?: { width: number; height: number }): Promise<string | null> {
        try {
            const ImageManipulator = await import('expo-image-manipulator');

            if (!userId) throw new Error('User required');
            // Limit both axes without upscaling or cropping the artwork.
            const longest = Math.max(dimensions?.width || 0, dimensions?.height || 0);
            const resize = longest > 1600
                ? [{ resize: dimensions!.width >= dimensions!.height ? { width: 1600 } : { height: 1600 } }]
                : longest ? [] : [{ resize: { width: 1200 } }];
            const manipulatedImage = await ImageManipulator.manipulateAsync(
                imageUri,
                resize,
                { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: false }
            );

            const bytes = Platform.OS === 'web'
                ? await (await fetch(manipulatedImage.uri)).arrayBuffer()
                : await new (await import('expo-file-system')).File(manipulatedImage.uri).arrayBuffer();

            const filePath = `${userId}/poster_${Date.now()}.jpg`;
            const contentType = 'image/jpeg';

            // 2. Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('sessions')
                .upload(filePath, bytes, {
                    contentType,
                    upsert: false,
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
