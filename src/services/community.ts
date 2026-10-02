import type { UserProfile } from './profile';
import { supabase } from '../lib/supabase';
export interface CommunityProfile {
    user_id: string;
    artist_name: string;
    city: string;
    bio: string;
    genres: string;
    avatar_url: string | null;
    cover_url: string | null;
    mixcloud_url: string;
    soundcloud_url: string;
    instagram_url: string;
    is_visible: boolean;
    created_at: string;
}
export type CommunityProfileInput = Pick<
    CommunityProfile,
    | 'artist_name'
    | 'city'
    | 'bio'
    | 'genres'
    | 'avatar_url'
    | 'is_visible'
    | 'cover_url'
    | 'mixcloud_url'
    | 'soundcloud_url'
    | 'instagram_url'
>;
export interface CommunitySession {
    session_id: string;
    author_id: string;
    artist_name: string;
    avatar_url: string | null;
    title: string;
    venue: string;
    city: string;
    date: string;
    start_time: string | null;
    end_time: string | null;
    poster_url: string | null;
    shared_at: string;
    collaborators?: { user_id: string; artist_name: string; avatar_url: string | null }[];
}
const PAGE_SIZE = 20;
export const communityService = {
    async profile(id: string): Promise<CommunityProfile | null> {
        const { data, error } = await supabase
            .from('community_profiles')
            .select('*')
            .eq('user_id', id)
            .maybeSingle();
        if (error) throw error;
        return data;
    },
    async saveProfile(
        _id: string,
        input: CommunityProfileInput,
    ): Promise<{ profile: UserProfile; community: CommunityProfile }> {
        const { data, error } = await supabase.rpc('save_unified_profile', {
            input,
        });
        if (error) throw error;
        return data;
    },
    async discover(
        search: string,
        offset: number,
    ): Promise<CommunityProfile[]> {
        let query = supabase
            .from('community_profiles')
            .select('*')
            .eq('is_visible', true)
            .order('created_at', { ascending: false })
            .order('user_id')
            .range(offset, offset + PAGE_SIZE - 1);
        if (search.trim())
            query = query.ilike(
                'artist_name',
                `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`,
            );
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },
    async following(userId: string): Promise<string[]> {
        const ids: string[] = [];
        // The Data API caps each response. Fetch every page before deciding
        // whether a DJ is already followed.
        for (let offset = 0; ; offset += 1000) {
            const { data, error } = await supabase
                .from('community_follows')
                .select('following_id')
                .eq('follower_id', userId)
                .order('following_id')
                .range(offset, offset + 999);
            if (error) throw error;
            const rows = data || [];
            ids.push(...rows.map((row) => row.following_id));
            if (rows.length < 1000) return ids;
        }
    },
    async follow(userId: string, targetId: string, enabled: boolean) {
        const result = enabled
            ? await supabase
                  .from('community_follows')
                  .insert({ follower_id: userId, following_id: targetId })
            : await supabase
                  .from('community_follows')
                  .delete()
                  .eq('follower_id', userId)
                  .eq('following_id', targetId);
        if (result.error && result.error.code !== '23505') throw result.error;
    },
    async feed(
        following: boolean,
        author: string | null,
        offset: number,
    ): Promise<CommunitySession[]> {
        const { data, error } = await supabase.rpc('community_feed', {
            only_following: following,
            author,
            page_offset: offset,
            page_size: PAGE_SIZE,
        });
        if (error) throw error;
        return data || [];
    },
    async shared(userId: string, sessionId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('community_session_shares')
            .select('session_id')
            .eq('user_id', userId)
            .eq('session_id', sessionId)
            .maybeSingle();
        if (error) throw error;
        return !!data;
    },
    async share(userId: string, sessionId: string, enabled: boolean) {
        const result = enabled
            ? await supabase
                  .from('community_session_shares')
                  .insert({ user_id: userId, session_id: sessionId })
            : await supabase
                  .from('community_session_shares')
                  .delete()
                  .eq('user_id', userId)
                  .eq('session_id', sessionId);
        if (result.error && result.error.code !== '23505') throw result.error;
    },
};
export { PAGE_SIZE };
