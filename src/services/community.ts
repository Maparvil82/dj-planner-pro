import type { ProfileMix } from './profileMixes';
import type { UserProfile } from './profile';
import { supabase } from '../lib/supabase';
import { cityKey, normalizeCity, type CityLocation } from '../utils/cities';
export interface CommunityProfile {
    user_id: string;
    artist_name: string;
    city: string;
    city_location?: CityLocation | null;
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
    | 'city_location'
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
    poster_focus_x?: number;
    poster_focus_y?: number;
    shared_at: string;
    collaborators?: {
        user_id: string;
        artist_name: string;
        avatar_url: string | null;
    }[];
}
export type CommunityActivity =
    | {
          kind: 'session';
          id: string;
          published_at: string;
          payload: CommunitySession;
      }
    | {
          kind: 'mix';
          id: string;
          published_at: string;
          payload: ProfileMix & {
              artist_name: string;
              avatar_url: string | null;
              city: string;
          };
      };
export type CommunityFilters = { city: string; genre: string };
export type CommunityFilterOptions = { cities: string[]; genres: string[] };
const PAGE_SIZE = 20;
export const communityService = {
    async shelf(
        shelf: 'following' | 'city' | 'rest',
        city: string,
        today: string,
        offset: number,
        filters: CommunityFilters,
        search: string,
    ): Promise<CommunitySession[]> {
        const { data, error } = await supabase.rpc('community_session_shelf', {
            shelf,
            home_city: city,
            from_date: today,
            page_offset: offset,
            page_size: PAGE_SIZE,
            search_text: search.trim(),
            filter_city: filters.city,
            filter_genre: filters.genre,
        });
        if (error) throw error;
        return data || [];
    },
    async activity(
        search: string,
        offset: number,
        filters?: CommunityFilters,
    ): Promise<CommunityActivity[]> {
        const { data, error } = await supabase.rpc(
            'community_following_activity',
            {
                search_text: search.trim(),
                filter_city: filters?.city || '',
                filter_genre: filters?.genre || '',
                page_offset: offset,
                page_size: PAGE_SIZE,
            },
        );
        if (error) throw error;
        return data || [];
    },
    async posters(author: string, offset: number): Promise<CommunitySession[]> {
        const { data, error } = await supabase.rpc(
            'community_profile_posters',
            { author, page_offset: offset, page_size: PAGE_SIZE },
        );
        if (error) throw error;
        return data || [];
    },
    async sessionCounts(ids: string[]): Promise<Record<string, number>> {
        const batches = await Promise.all(
            Array.from({ length: Math.ceil(ids.length / 50) }, (_, index) =>
                supabase.rpc('community_profile_session_counts', {
                    author_ids: ids.slice(index * 50, index * 50 + 50),
                }),
            ),
        );
        const counts: Record<string, number> = {};
        for (const { data, error } of batches) {
            if (error) throw error;
            for (const row of data || [])
                counts[row.user_id] = Number(row.session_count);
        }
        return counts;
    },
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
        const location =
            input.city_location &&
            cityKey(input.city_location.name) === cityKey(input.city)
                ? input.city_location
                : null;
        const { data, error } = await supabase.rpc('save_unified_profile', {
            input: {
                ...input,
                city: location?.name || normalizeCity(input.city),
                ...(input.city_location !== undefined
                    ? { city_location: location }
                    : {}),
            },
        });
        if (error) throw error;
        return data;
    },
    async discover(
        search: string,
        offset: number,
        filters?: CommunityFilters,
    ): Promise<CommunityProfile[]> {
        const { data, error } = await supabase.rpc(
            'community_discover_filtered',
            {
                search_name: search,
                filter_city: filters?.city || '',
                filter_genre: filters?.genre || '',
                page_offset: offset,
                page_size: PAGE_SIZE,
            },
        );
        if (error) throw error;
        return data || [];
    },
    async filterOptions(
        mode: 'sessions' | 'djs' | 'activity',
    ): Promise<CommunityFilterOptions> {
        if (mode === 'activity') {
            const [sessions, djs] = await Promise.all([
                communityService.filterOptions('sessions'),
                communityService.filterOptions('djs'),
            ]);
            return {
                cities: [...new Set([...sessions.cities, ...djs.cities])],
                genres: [...new Set([...sessions.genres, ...djs.genres])],
            };
        }
        const { data, error } = await supabase.rpc('community_filter_options', {
            mode,
        });
        if (error) throw error;
        return data || { cities: [], genres: [] };
    },
    async followedDjs(
        search: string,
        offset: number,
        filters?: CommunityFilters,
    ): Promise<CommunityProfile[]> {
        const { data, error } = await supabase.rpc('community_followed_djs', {
            search_name: search,
            filter_city: filters?.city || '',
            filter_genre: filters?.genre || '',
            page_offset: offset,
            page_size: PAGE_SIZE,
        });
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
        filters?: CommunityFilters,
        search = '',
    ): Promise<CommunitySession[]> {
        const { data, error } = await supabase.rpc(
            search.trim()
                ? 'community_feed_search'
                : filters?.city || filters?.genre
                  ? 'community_feed_filtered'
                  : 'community_feed',
            {
                ...(filters?.city || filters?.genre || search.trim()
                    ? {
                          filter_city: filters?.city || '',
                          filter_genre: filters?.genre || '',
                      }
                    : {}),
                ...(search.trim() ? { search_text: search.trim() } : {}),
                only_following: following,
                author,
                page_offset: offset,
                page_size: PAGE_SIZE,
            },
        );
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
