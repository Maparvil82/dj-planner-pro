import { useIsFocused } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';

export function usePosterIntro() {
    const userId = useAuthStore(state => state.session?.user.id);
    const focused = useIsFocused();
    const client = useQueryClient();
    const key = ['poster-intro', userId];
    const query = useQuery({
        queryKey: key,
        enabled: !!userId && focused,
        staleTime: Infinity,
        queryFn: async () => {
            const { data, error } = await supabase.rpc('poster_intro_seen');
            if (error) throw error;
            return data === true;
        },
    });
    const complete = useMutation({
        mutationFn: async () => {
            const account = userId;
            if (!account) throw new Error('Authentication required');
            const { data, error } = await supabase.rpc('complete_poster_intro');
            if (error) throw error;
            if (data !== true) throw new Error('Introduction not saved');
            return { userId: account };
        },
        // A response from the previous account cannot dismiss the new account's intro.
        onSuccess: data => { client.setQueryData(['poster-intro', data.userId], true); },
    });
    return { query, complete };
}
