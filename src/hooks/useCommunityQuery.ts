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
export function useCommunityFollowing() {
    const userId = useAuthStore((state) => state.session?.user.id);
    return useQuery({
        queryKey: ['community', 'following', userId],
        queryFn: () => communityService.following(userId!),
        enabled: !!userId,
    });
}
export function useCommunityDiscover(search: string) {
    const userId = useAuthStore((state) => state.session?.user.id);
    return useInfiniteQuery({
        queryKey: ['community', 'discover', userId, search],
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            communityService.discover(search, pageParam),
        enabled: !!userId,
        getNextPageParam: (last, pages) =>
            last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    });
}
export function useCommunityFeed(
    following = false,
    author: string | null = null,
) {
    const userId = useAuthStore((state) => state.session?.user.id);
    return useInfiniteQuery({
        queryKey: ['community', 'feed', userId, following, author],
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            communityService.feed(following, author, pageParam),
        enabled: !!userId,
        getNextPageParam: (last, pages) =>
            last.length === PAGE_SIZE && pages.length * PAGE_SIZE <= 5000
                ? pages.length * PAGE_SIZE
                : undefined,
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
