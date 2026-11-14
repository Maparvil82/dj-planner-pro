import { useCommunityTerms } from '../components/community/CommunityTerms';
import {
    useInfiniteQuery,
    useQueries,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { prefetchCommunityImages } from '../services/communityImages';
import {
    communityService,
    CommunityProfileInput,
    CommunityFilters,
    PAGE_SIZE,
} from '../services/community';
export function useCommunityProfile(id?: string, enabled = true) {
    const viewer = useAuthStore((state) => state.session?.user.id);
    return useQuery({
        queryKey: ['community', 'profile', viewer, id],
        queryFn: () => communityService.profile(id!),
        enabled: enabled && !!viewer && !!id,
    });
}
export function useCommunityFollowing(enabled = true) {
    const userId = useAuthStore((state) => state.session?.user.id);
    return useQuery({
        queryKey: ['community', 'following', userId],
        queryFn: () => communityService.following(userId!),
        enabled: enabled && !!userId,
    });
}
export function useCommunityDiscover(
    search: string,
    filters?: CommunityFilters,
    enabled = true,
) {
    const userId = useAuthStore((state) => state.session?.user.id);
    return useInfiniteQuery({
        queryKey: [
            'community',
            'discover',
            userId,
            search,
            filters?.city || '',
            filters?.genre || '',
        ],
        initialPageParam: 0,
        queryFn: async ({ pageParam }) => {
            const profiles = await communityService.discover(search, pageParam, filters);
            prefetchCommunityImages(profiles);
            return profiles;
        },
        enabled: enabled && !!userId,
        getNextPageParam: (last, pages) =>
            last.length === PAGE_SIZE && pages.length * PAGE_SIZE <= 5000
                ? pages.length * PAGE_SIZE
                : undefined,
    });
}
export function useCommunityFeed(
    following = false,
    author: string | null = null,
    filters?: CommunityFilters,
    enabled = true,
    search = '',
) {
    const userId = useAuthStore((state) => state.session?.user.id);
    return useInfiniteQuery({
        queryKey: [
            'community',
            'feed',
            userId,
            following,
            author,
            filters?.city || '',
            filters?.genre || '',
            search,
        ],
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            communityService.feed(
                following,
                author,
                pageParam,
                filters,
                search,
            ),
        enabled: enabled && !!userId,
        getNextPageParam: (last, pages) =>
            last.length === PAGE_SIZE && pages.length * PAGE_SIZE <= 5000
                ? pages.length * PAGE_SIZE
                : undefined,
    });
}
export function useCommunityFollowedDjs(
    search: string,
    filters?: CommunityFilters,
    enabled = true,
) {
    const userId = useAuthStore((state) => state.session?.user.id);
    return useInfiniteQuery({
        queryKey: [
            'community',
            'followed-djs',
            userId,
            search,
            filters?.city || '',
            filters?.genre || '',
        ],
        initialPageParam: 0,
        queryFn: async ({ pageParam }) => {
            const profiles = await communityService.followedDjs(search, pageParam, filters);
            prefetchCommunityImages(profiles);
            return profiles;
        },
        enabled: enabled && !!userId,
        getNextPageParam: (last, pages) =>
            last.length === PAGE_SIZE && pages.length * PAGE_SIZE <= 5000
                ? pages.length * PAGE_SIZE
                : undefined,
    });
}
export function useCommunityFilterOptions(
    mode: 'sessions' | 'djs' | 'activity',
    enabled = true,
) {
    const userId = useAuthStore((state) => state.session?.user.id);
    return useQuery({
        queryKey: ['community', 'filter-options', userId, mode],
        queryFn: () => communityService.filterOptions(mode),
        enabled: enabled && !!userId,
        staleTime: 60000,
    });
}
export function useCommunityShare(sessionId: string) {
    const userId = useAuthStore((state) => state.session?.user.id);
    return useQuery({
        queryKey: ['community', 'share', userId, sessionId],
        queryFn: () => communityService.shared(userId!, sessionId),
        enabled: !!userId && !!sessionId,
    });
}
export function useCommunityMutation() {
    const requireTerms = useCommunityTerms();
    const userId = useAuthStore((state) => state.session?.user.id);
    const client = useQueryClient();
    return useMutation({
        mutationFn: async (
            action:
                | { kind: 'profile'; input: CommunityProfileInput }
                | { kind: 'follow'; target: string; enabled: boolean }
                | { kind: 'share'; sessionId: string; enabled: boolean },
        ) => {
            if (!userId) throw new Error('Unauthenticated');
            if (
                (action.kind === 'profile' && action.input.is_visible) ||
                (action.kind !== 'profile' && action.enabled)
            ) {
                if (!(await requireTerms()))
                    throw new Error('COMMUNITY_CANCELLED');
            }
            if (action.kind === 'profile')
                return communityService.saveProfile(userId, action.input);
            if (action.kind === 'follow')
                return communityService.follow(
                    userId,
                    action.target,
                    action.enabled,
                );
            return communityService.share(
                userId,
                action.sessionId,
                action.enabled,
            );
        },
        onSuccess: (data) => {
            if (data) {
                useAuthStore.getState().setProfile(data.profile);
                client.setQueryData(['account-profile', userId], data.profile);
            }
            return client.invalidateQueries({ queryKey: ['community'] });
        },
    });
}

export function useCommunitySessionCounts(ids: string[], enabled = true) {
    const viewer = useAuthStore((state) => state.session?.user.id);
    const client = useQueryClient();
    // Stable page-sized groups: adding a page does not refetch previous counts.
    const unique = [...new Set(ids)];
    const batches = Array.from(
        { length: Math.ceil(unique.length / PAGE_SIZE) },
        (_, i) => unique.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE),
    );
    const results = useQueries({
        queries: batches.map((batch) => ({
            queryKey: ['community', 'session-counts', viewer, batch],
            queryFn: () => communityService.sessionCounts(batch),
            enabled: enabled && !!viewer,
            staleTime: 60000,
        })),
    });
    return {
        data: Object.assign(
            {},
            ...results.map((result) => result.data || {}),
        ) as Record<string, number>,
        isPending: results.some((result) => result.isPending),
        isError: results.some((result) => result.isError),
        refetch: () =>
            client.refetchQueries({
                queryKey: ['community', 'session-counts', viewer],
                type: 'active',
            }),
    };
}

export function useCommunityPosters(author: string) {
    const viewer = useAuthStore((state) => state.session?.user.id);
    return useInfiniteQuery({
        queryKey: ['community', 'posters', viewer, author],
        enabled: !!viewer && !!author,
        initialPageParam: 0,
        queryFn: ({ pageParam }) => communityService.posters(author, pageParam),
        getNextPageParam: (last, pages) =>
            last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    });
}

export function useCommunityActivity(
    search: string,
    filters: CommunityFilters,
    enabled: boolean,
) {
    const viewer = useAuthStore((state) => state.session?.user.id);
    return useInfiniteQuery({
        queryKey: [
            'community',
            'activity',
            viewer,
            search,
            filters.city,
            filters.genre,
        ],
        enabled: enabled && !!viewer,
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            communityService.activity(search, pageParam, filters),
        getNextPageParam: (last, pages) =>
            last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    });
}

export function useCommunitySessionShelf(
    shelf: 'following' | 'city' | 'rest',
    city: string,
    filters: CommunityFilters,
    search: string,
    enabled: boolean,
) {
    const viewer = useAuthStore((state) => state.session?.user.id);
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return useInfiniteQuery({
        queryKey: [
            'community',
            'shelf',
            viewer,
            shelf,
            city,
            today,
            filters.city,
            filters.genre,
            search,
        ],
        enabled: enabled && !!viewer,
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            communityService.shelf(
                shelf,
                city,
                today,
                pageParam,
                filters,
                search,
            ),
        getNextPageParam: (last, pages) =>
            last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    });
}
