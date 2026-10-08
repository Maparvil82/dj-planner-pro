import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { savedMixesService, SAVED_MIX_PAGE_SIZE } from '../services/savedMixes';
export function useSavedMixFlags(ids: string[]) {
    const { session, initialized } = useAuthStore();
    const viewer = session?.user.id;
    const stableIds = [...new Set(ids)].sort();
    return useQuery({
        queryKey: ['saved-mixes', 'flags', viewer, stableIds.join(',')],
        enabled: !!viewer && initialized && !!ids.length,
        queryFn: () => savedMixesService.flags(viewer!, stableIds),
        staleTime: 60000,
    });
}
export function useSavedMixList() {
    const { session, initialized } = useAuthStore();
    const viewer = session?.user.id;
    return useInfiniteQuery({
        queryKey: ['saved-mixes', 'list', viewer],
        enabled: !!viewer && initialized,
        initialPageParam: 0,
        queryFn: ({ pageParam }) => savedMixesService.list(pageParam),
        getNextPageParam: (last, pages) =>
            last.length === SAVED_MIX_PAGE_SIZE
                ? pages.length * SAVED_MIX_PAGE_SIZE
                : undefined,
    });
}
export function useSaveMix() {
    const viewer = useAuthStore((state) => state.session?.user.id);
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, saved }: { id: string; saved: boolean }) => {
            if (!viewer) throw new Error('Unauthenticated');
            await savedMixesService.set(viewer, id, saved);
        },
        onSuccess: async (_, action) => {
            client.setQueriesData<Record<string, boolean>>(
                { queryKey: ['saved-mixes', 'flags', viewer] },
                (old) => (old ? { ...old, [action.id]: action.saved } : old),
            );
            await Promise.all([
                client.invalidateQueries({
                    queryKey: ['saved-mixes', 'flags', viewer],
                }),
                client.invalidateQueries({
                    queryKey: ['saved-mixes', 'list', viewer],
                }),
            ]);
        },
    });
}
