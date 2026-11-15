import { supabase } from '../lib/supabase';
import { parseMixSource, MixPlatform } from '../utils/profileMixes';
export const MIX_PAGE_SIZE = 20;
export interface ProfileMix {
    id: string;
    user_id: string;
    title: string;
    source_url: string;
    platform: MixPlatform;
    created_at: string;
}
export const profileMixesService = {
    async list(userId: string, offset: number): Promise<ProfileMix[]> {
        const { data, error } = await supabase
            .from('community_profile_mixes')
            .select('id,user_id,title,source_url,platform,created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .order('id')
            .range(offset, offset + MIX_PAGE_SIZE - 1);
        if (error) throw error;
        return data || [];
    },
    async save(userId: string, title: string, url: string, id?: string) {
        const source = parseMixSource(url);
        const input = { title: title.trim(), ...source };
        if (!input.title || input.title.length > 100)
            throw new Error('INVALID_TITLE');
        const query = id
            ? supabase
                  .from('community_profile_mixes')
                  .update(input)
                  .eq('id', id)
                  .eq('user_id', userId)
            : supabase
                  .from('community_profile_mixes')
                  .insert({ ...input, user_id: userId });
        const { data, error } = await query.select('id').single();
        if (error) throw error;
        return data;
    },
    async remove(userId: string, id: string) {
        const { error } = await supabase
            .from('community_profile_mixes')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);
        if (error) throw error;
    },
};
