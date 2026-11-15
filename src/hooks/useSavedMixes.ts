import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueries,
    useQueryClient,
} from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { savedMixesService, SAVED_MIX_PAGE_SIZE } from '../services/savedMixes';
export function useSavedMixFlags(ids: string[], enabled = true) {
    const { session, initialized } = useAuthStore();
    const viewer = session?.user.id;
    const client = useQueryClient();
    const unique = [...new Set(ids)];
    const batches = Array.from(
        { length: Math.ceil(unique.length / 20) },
        (_, i) => unique.slice(i * 20, i * 20 + 20),
    );
    const results = useQueries({
        queries: batches.map((batch) => ({
            queryKey: ['saved-mixes', 'flags', viewer, batch],
            enabled: enabled && !!viewer && initialized,
            queryFn: () => savedMixesService.flags(viewer!, batch),
            staleTime: 60000,
        })),
    });
    return {
        data: Object.assign(
            {},
            ...results.map((result) => result.data || {}),
        ) as Record<string, boolean>,
        isPending: results.some((result) => result.isPending),
        isError: results.some((result) => result.isError),
        refetch: () =>
            client.refetchQueries({
                queryKey: ['saved-mixes', 'flags', viewer],
                type: 'active',
            }),
    };
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
