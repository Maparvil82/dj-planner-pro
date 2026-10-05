import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import {
    communityService,
    CommunityProfileInput,
    CommunityFilters,
    PAGE_SIZE,
} from '../services/community';
export function useCommunityProfile(id?: string) {
    const viewer = useAuthStore((state) => state.session?.user.id);
    return useQuery({
        queryKey: ['community', 'profile', viewer, id],
        queryFn: () => communityService.profile(id!),
        enabled: !!viewer && !!id,
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
        queryFn: ({ pageParam }) =>
            communityService.discover(search, pageParam, filters),
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
        queryFn: ({ pageParam }) =>
            communityService.followedDjs(search, pageParam, filters),
        enabled: enabled && !!userId,
        getNextPageParam: (last, pages) =>
            last.length === PAGE_SIZE && pages.length * PAGE_SIZE <= 5000
                ? pages.length * PAGE_SIZE
                : undefined,
    });
}
export function useCommunityFilterOptions(
    mode: 'sessions' | 'djs',
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
    const sortedIds = [...new Set(ids)].sort();
    return useQuery({
        queryKey: ['community', 'session-counts', viewer, sortedIds],
        queryFn: () => communityService.sessionCounts(sortedIds),
        enabled: enabled && !!viewer && sortedIds.length > 0,
        staleTime: 60000,
    });
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
