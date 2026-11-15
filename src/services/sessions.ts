import { sessionScreens } from './sessionScreens';
import { DEFAULT_SESSION_COLOR } from '../theme/colors';
import { optimizedImage } from './optimizedImage';
import { storageError } from '../utils/storageLimits';
import { exceedsSessionLimit, SessionLimitError } from '../utils/sessionLimit';
import { getSessionUsage, syncSubscriptionAccess } from './subscriptionAccess';
import { Platform } from 'react-native';
import { collaborationService } from './collaborations';
import { supabase } from '../lib/supabase';
import { CreateSessionInput, Session } from '../types/session';
import { TagOption } from '../types/tag';
import {
    recurrenceDates,
    findSessionConflicts,
    localDateString,
    sessionRange,
} from '../utils/sessionPlanning';

import {
    relatedSessionTargets,
    validateSessionInput,
} from '../utils/sessionWorkflow';

const TAG_COLORS: string[] = [];

function withVenueCity(
    row: Session & { place?: { city?: string | null } | null },
): Session {
    const { place, ...session } = row;
    return session;
}

export const getColorForString = (str: string) => {
    // The user requested to default to the Neutral 800 black color used in the "Prevees_ganar" tracking card.
    return '#262626';
};

export const sessionService = {
    async createSession(
        input: CreateSessionInput,
        userId: string,
    ): Promise<Session> {
        input = validateSessionInput({ ...input, color: input.color || DEFAULT_SESSION_COLOR });
        if (
            input.earning_type === 'agreement' &&
            !(await syncSubscriptionAccess()).isPro
        )
            throw new Error('agreement.proRequired');
        const dates = recurrenceDates(input);
        let usage = await getSessionUsage();
        // Verify paid access whenever the free allocation would be exceeded,
        // including renewals, restores and users opening the app on another device.
        if (usage.count + dates.length > usage.limit)
            usage = await syncSubscriptionAccess();
        if (exceedsSessionLimit(usage, dates.length))
            throw new SessionLimitError(usage, dates.length);
        const { data, error } = await supabase
            .rpc('create_session_series', {
                input: {
                    ...input,
                    color: input.color || DEFAULT_SESSION_COLOR,
                },
                session_dates: dates,
            })
            .single();
        if (error?.message === 'session_limit_reached')
            throw new SessionLimitError(await getSessionUsage(), dates.length);
        if (error)
            throw new Error(
                error.message === 'booking_hold_conflict'
                    ? 'bookings.errors.booking_hold_conflict'
                    : error.message,
            );
        if (!data) throw new Error('error_saving_session');
        this.syncTags(input, userId).catch((err) =>
            console.warn('Tag synchronization failed', err),
        );
        return data as Session;
    },

    async getCreationConflicts(
        input: CreateSessionInput,
        userId: string,
    ): Promise<Session[]> {
        const candidates = recurrenceDates(input).map((date) => ({
            ...input,
            date,
        }));
        return findSessionConflicts(
            candidates,
            await this.getAllSessions(userId),
        );
    },

    async getUpdateConflicts(
        sessionId: string,
        input: Partial<CreateSessionInput>,
        userId: string,
        updateAll: boolean,
    ): Promise<Session[]> {
        const sessions = await this.getAllSessions(userId);
        const current = sessions.find((session) => session.id === sessionId);
        if (!current || current.is_guest)
            throw new Error('error_loading_session');
        const targets = relatedSessionTargets(sessions, current, updateAll);
        const candidates = targets
            .map((session) => ({
                ...session,
                ...input,
                date: updateAll ? session.date : input.date || session.date,
            }))
            .filter((session) => session.status !== 'cancelled');
        const targetIds = new Set(targets.map((session) => session.id));
        const outside = findSessionConflicts(
            candidates,
            sessions.filter((session) => !targetIds.has(session.id)),
        );
        // Changes to all dates can also make members of that series overlap.
        const inside = candidates.filter(
            (candidate, index) =>
                findSessionConflicts(
                    [candidate],
                    candidates.filter((_, other) => index !== other),
                ).length > 0,
        );
        return [...outside, ...inside];
    },

    /**
     * Non-blocking tag synchronization.
     * Uses Promise.allSettled to parallelize inserts and ignore duplicate errors (23505).
     */
    async syncTags(
        input: Partial<CreateSessionInput>,
        userId: string,
    ): Promise<void> {
        try {
            const tagsToSync = [];

            if (input.title) {
                tagsToSync.push(
                    supabase.from('user_tags').insert({
                        user_id: userId,
                        type: 'title',
                        name: input.title.trim(),
                        color: input.color || getColorForString(input.title),
                    }),
                );
            }

            if (input.venue) {
                tagsToSync.push(
                    supabase.from('user_tags').insert({
                        user_id: userId,
                        type: 'venue',
                        name: input.venue.trim(),
                        color: getColorForString(input.venue.trim()),
                    }),
                );
            }

            if (input.is_collective && input.djs && input.djs.length > 0) {
                input.djs.forEach((dj) => {
                    tagsToSync.push(
                        supabase.from('user_tags').insert({
                            user_id: userId,
                            type: 'dj',
                            name: dj.trim(),
                            color: getColorForString(dj.trim()),
                        }),
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
            const { data, error } = await supabase
                .from('sessions')
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: false })
                .order('id')
                .range(offset, offset + pageSize - 1);
            if (error)
                throw new Error(
                    error.message === 'booking_hold_conflict'
                        ? 'bookings.errors.booking_hold_conflict'
                        : error.message,
                );
            sessions.push(...(data || []).map(withVenueCity));
            if (!data || data.length < pageSize)
                return [
                    ...sessions,
                    ...(await collaborationService.agenda()),
                ].sort((a, b) => b.date.localeCompare(a.date));
        }
    },
    async getSessionsByMonth(
        year: number,
        month: number,
        userId: string,
    ): Promise<Session[]> {
        const from = `${year}-${String(month).padStart(2,'0')}-01`;
        const to = `${month===12?year+1:year}-${String(month===12?1:month+1).padStart(2,'0')}-01`;
        return (await sessionScreens.range(from,to)).sort((a,b)=>a.date.localeCompare(b.date));
    },
    async getUpcomingSessions(userId: string): Promise<Session[]> {
        const earliest = new Date(); earliest.setDate(earliest.getDate()-2);
        const rows: Session[] = [];
        let cursor = null as import('./sessionScreens').SessionCursor | null;
        do {
            const page = await sessionScreens.page({from:localDateString(earliest),upcoming:true},cursor,undefined,true,undefined,100);
            rows.push(...page.sessions);
            rows.sort((a,b)=>a.date.localeCompare(b.date)||a.start_time.localeCompare(b.start_time));
            cursor = page.nextCursor;
            // Finish the boundary day before choosing the first 30, because
            // keyset pages use date/id while this view orders by start time.
            if (rows.length>=30 && cursor && cursor.date>rows[29].date) break;
        } while (cursor);
        return rows.slice(0,30);
    },

    async getUserTags(
        userId: string,
        type: 'title' | 'venue' | 'dj',
    ): Promise<TagOption[]> {
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

        return (data || []).map((row) => ({
            name: row.name,
            color: row.color || '#3B82F6',
        }));
    },

    async getSessionById(sessionId: string): Promise<Session | null> {
        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (error?.code === 'PGRST116')
            return (
                (await collaborationService.agenda()).find(
                    (session) => session.id === sessionId,
                ) || null
            );
        if (error) {
            console.error('Error fetching session by id:', error);
            throw new Error(
                error.message === 'booking_hold_conflict'
                    ? 'bookings.errors.booking_hold_conflict'
                    : error.message,
            );
        }

        return data ? withVenueCity(data) : null;
    },

    async deleteSession(
        sessionId: string,
        scope: 'single' | 'series' = 'single',
    ): Promise<void> {
        if (!sessionId || !['single', 'series'].includes(scope))
            throw new Error('error_deleting_session');
        const { data, error } = await supabase.rpc('delete_session_safely', {
            session_id: sessionId,
            delete_scope: scope,
        });
        if (error)
            throw new Error(
                error.message === 'booking_hold_conflict'
                    ? 'bookings.errors.booking_hold_conflict'
                    : error.message,
            );
        if (!data) throw new Error('error_deleting_session');
    },

    async updateSessionColor(
        sessionId: string,
        color: string,
        updateAll = false,
    ): Promise<void> {
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();
        if (error || !user) throw new Error('error_loading_session');
        await this.updateSession(sessionId, { color }, user.id, updateAll);
    },
    async updateSession(
        sessionId: string,
        input: Partial<CreateSessionInput>,
        userId: string,
        updateAll = false,
    ): Promise<void> {
        if (input.fee_agreement && !(await syncSubscriptionAccess()).isPro)
            throw new Error('agreement.proRequired');
        if (updateAll && input.fee_agreement?.settled)
            throw new Error('agreement.singleSession');
        if (updateAll && input.amount_paid !== undefined)
            throw new Error('payment_single_session');
        if (
            input.amount_paid !== undefined &&
            (!Number.isFinite(input.amount_paid) || input.amount_paid < 0)
        )
            throw new Error('payment_invalid_amount');
        const sessions = await this.getAllSessions(userId);
        const current = sessions.find((session) => session.id === sessionId);
        if (!current || current.is_guest)
            throw new Error('error_loading_session');
        const targets = relatedSessionTargets(sessions, current, updateAll);
        if (
            updateAll &&
            input.fee_agreement !== undefined &&
            targets.some((target) => target.fee_agreement?.settled)
        )
            throw new Error('agreement.singleSession');
        const allowed = [
            'title',
            'event_type',
            'notes',
            'venue',
            'venue_id',
            'booking_timezone',
            'start_time',
            'end_time',
            'is_collective',
            'djs',
            'dj_profile_ids',
            'earning_type',
            'fee_agreement',
            'earning_amount',
            'currency',
            'amount_paid',
            'color',
            'status',
            'poster_url',
            'poster_focus_x',
            'poster_focus_y',
            ...(updateAll ? [] : ['date']),
        ];
        const changes = Object.fromEntries(
            Object.entries(input).filter(
                ([key, value]) => allowed.includes(key) && value !== undefined,
            ),
        );
        if (!Object.keys(changes).length) return;
        if (Object.keys(changes).some((key) => key !== 'color')) {
            for (const target of targets) {
                validateSessionInput({
                    ...target,
                    start_time: target.start_time.slice(0, 5),
                    end_time: target.end_time.slice(0, 5),
                    ...changes,
                    recurrence_type: 'none',
                });
            }
        }
        const { data, error } = await supabase
            .from('sessions')
            .update({ ...changes, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .in(
                'id',
                targets.map((target) => target.id),
            )
            .select('id');
        if (error)
            throw new Error(
                error.message === 'booking_hold_conflict'
                    ? 'bookings.errors.booking_hold_conflict'
                    : error.message,
            );
        if (!data?.length) throw new Error('error_saving_session');
        this.syncTags(changes, userId).catch((error) =>
            console.warn('Tag synchronization failed', error),
        );
    },

    async uploadSessionPoster(
        userId: string,
        imageUri: string,
        dimensions?: { width: number; height: number },
    ): Promise<string | null> {
        try {
            if (!userId) throw new Error('User required');
            const bytes = await optimizedImage(imageUri, 1600, dimensions);

            const filePath = `${userId}/poster_${(await import('expo-crypto')).randomUUID()}.jpg`;
            const contentType = 'image/jpeg';

            // 2. Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('sessions')
                .upload(filePath, bytes, {
                    contentType,
                    upsert: false,
                });

            if (uploadError) throw storageError(uploadError);

            // 3. Get public URL
            const { data: publicUrlData } = supabase.storage
                .from('sessions')
                .getPublicUrl(filePath);

            return publicUrlData.publicUrl;
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.startsWith('storageSafety.')
            )
                throw error;
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
    },
};
