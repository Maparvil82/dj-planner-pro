import { supabase } from '../lib/supabase';
export interface EventGuest {
    id: string;
    session_id: string;
    full_name: string;
    companions: number;
    revision: number;
    total: number;
    admitted: number;
    created_at: string;
}
function check(error: { message: string } | null) {
    if (error)
        throw new Error(
            /^(guests|tickets)\./.test(error.message)
                ? error.message
                : 'tickets.connectionError',
        );
}
export const guestService = {
    async list(session: string): Promise<EventGuest[]> {
        const { data, error } = await supabase.rpc('event_guest_list', {
            p_session: session,
        });
        check(error);
        return data || [];
    },
    async save(
        session: string,
        id: string,
        name: string,
        companions: number,
        revision: number,
    ) {
        const { error } = await supabase.rpc('save_event_guest', {
            p_session: session,
            p_guest: id,
            p_name: name.trim(),
            p_companions: companions,
            p_revision: revision,
        });
        check(error);
    },
    async access(
        session: string,
        guest: string,
        action: 'admit' | 'undo',
        quantity: number,
        request: string,
    ) {
        const { error } = await supabase.rpc('register_guest_access', {
            p_session: session,
            p_guest: guest,
            p_action: action,
            p_quantity: quantity,
            p_request: request,
        });
        check(error);
    },
    async remove(session: string, guest: string) {
        const { error } = await supabase.rpc('remove_event_guest', {
            p_session: session,
            p_guest: guest,
        });
        check(error);
    },
};
export function guestSearch(value: string) {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}
