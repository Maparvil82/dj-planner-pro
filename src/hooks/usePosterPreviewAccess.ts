import { useAuthStore } from '../store/useAuthStore';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// This controls navigation only. The server independently authorizes every request.
export function usePosterPreviewAccess() {
    const user = useAuthStore(state => state.session?.user);
    const query = useQuery({
        queryKey: ['poster-access', user?.id],
        enabled: !!user?.email_confirmed_at,
        staleTime: 30_000,
        queryFn: async () => {
            const { data, error } = await supabase.rpc('poster_feature_access');
            if (error) throw error;
            return data === true;
        },
    });
    return { data: !!user?.email_confirmed_at && query.data === true, isFetching: query.isFetching };
}
