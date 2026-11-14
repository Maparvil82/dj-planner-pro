import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';

export interface EntryCountResult {
    status: 'accepted' | 'already_used';
    checked_in_at: string;
    count: number;
}
export const entryCounterService = {
    async count(sessionId: string): Promise<number> {
        const { data, error } = await supabase.rpc('event_entry_count', { p_session: sessionId });
        if (error) throw new Error('tickets.connectionError');
        return Number(data);
    },
    async addManual(sessionId: string, requestId: string): Promise<EntryCountResult> {
        const { data, error } = await supabase.rpc('count_manual_event_entry', { p_session: sessionId, p_request: requestId });
        if (error) throw new Error(error.message === 'tickets.unavailable' ? error.message : 'tickets.connectionError');
        return data;
    },
    async scan(sessionId: string, code: string): Promise<EntryCountResult> {
        // Preserve exact payload: arbitrary provider codes must not be parsed as our tickets.
        if (!code || code.length > 16384) throw new Error('tickets.invalidQr');
        const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, code);
        const { data, error } = await supabase.rpc('count_event_entry', { p_session: sessionId, p_hash: hash });
        if (error) throw new Error(error.message === 'tickets.unavailable' ? error.message : 'tickets.connectionError');
        return data;
    },
};
