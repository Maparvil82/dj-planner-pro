import { supabase } from '../lib/supabase';
import { parsePhotonCities, type CitySuggestion } from '../utils/cities';

export async function communityCities(
    query: string,
): Promise<CitySuggestion[]> {
    const { data, error } = await supabase.rpc('community_city_suggestions', {
        search_city: query,
    });
    if (error) throw error;
    return data || [];
}

export async function externalCities(
    query: string,
    signal?: AbortSignal,
): Promise<CitySuggestion[]> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(abort, 6000);
    try {
        const url = new URL('https://photon.komoot.io/api/');
        url.searchParams.set('q', query.trim().slice(0, 100));
        url.searchParams.set('limit', '6');
        url.searchParams.append('layer', 'city');
        url.searchParams.append('layer', 'locality');
        const response = await fetch(url.toString(), {
            signal: controller.signal,
        });
        if (!response.ok) throw new Error('City search unavailable');
        return parsePhotonCities(await response.json());
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
    }
}
