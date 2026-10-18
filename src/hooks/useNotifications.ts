import { useIsFocused } from 'expo-router';
import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import {
    notificationService,
    NOTIFICATION_PAGE_SIZE,
} from '../services/notifications';
export function useUnreadNotifications(poll = false) {
    const userId = useAuthStore((state) => state.session?.user.id);
    return useQuery({
        queryKey: ['notifications', 'unread', userId],
        enabled: !!userId,
        queryFn: () => notificationService.unread(userId!),
        staleTime: 30000,
        refetchInterval: poll ? 60000 : false,
    });
}
export function useNotifications() {
    const focused = useIsFocused();
    const userId = useAuthStore((state) => state.session?.user.id);
    return useInfiniteQuery({
        queryKey: ['notifications', 'list', userId],
        enabled: !!userId && focused,
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            notificationService.list(userId!, pageParam),
        getNextPageParam: (last, pages) =>
            last.length === NOTIFICATION_PAGE_SIZE
                ? pages.length * NOTIFICATION_PAGE_SIZE
                : undefined,
        staleTime: 30000,
        refetchInterval: focused ? 60000 : false,
    });
}
export function useMarkNotificationsRead() {
    const userId = useAuthStore((state) => state.session?.user.id);
    const client = useQueryClient();
    return useMutation({
        mutationFn: (id?: string) => {
            if (!userId) throw new Error('Unauthenticated');
            return notificationService.markRead(userId, id);
        },
        onSuccess: () =>
            client.invalidateQueries({ queryKey: ['notifications'] }),
    });
}
