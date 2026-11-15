import { supabase } from '../lib/supabase';
import type { ProfileMix } from './profileMixes';
export const SAVED_MIX_PAGE_SIZE = 20;
export type SavedMix = ProfileMix & {
    artist_name: string;
    avatar_url: string | null;
    saved_at: string;
};
export const savedMixesService = {
    async flags(
        viewer: string,
        ids: string[],
    ): Promise<Record<string, boolean>> {
        if (!ids.length) return {};
        const { data, error } = await supabase
            .from('saved_mixes')
            .select('mix_id')
            .eq('owner_id', viewer)
            .in('mix_id', ids);
        if (error) throw error;
        return Object.fromEntries(
            (data || []).map((row) => [row.mix_id, true]),
        );
    },
    async set(viewer: string, mixId: string, saved: boolean) {
        const { error } = saved
            ? await supabase
                  .from('saved_mixes')
                  .insert({ owner_id: viewer, mix_id: mixId })
            : await supabase
                  .from('saved_mixes')
                  .delete()
                  .eq('owner_id', viewer)
                  .eq('mix_id', mixId);
        if (error && !(saved && error.code === '23505')) throw error;
    },
    async list(offset: number): Promise<SavedMix[]> {
        const { data, error } = await supabase.rpc('saved_mix_list', {
            page_offset: offset,
            page_size: SAVED_MIX_PAGE_SIZE,
        });
        if (error) throw error;
        return data || [];
    },
};
