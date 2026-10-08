import { supabase } from '../lib/supabase';
export type TicketPayment = 'paid' | 'pending' | 'invitation';
export interface TicketType {
    id: string;
    session_id: string;
    name: string;
    price: number;
    is_invitation: boolean;
    created_at: string;
}
export interface EventTicket {
    id: string;
    session_id: string;
    type_id: string;
    token: string;
    batch_id: string;
    ordinal: number;
    payment_status: TicketPayment;
    state: 'issued' | 'used' | 'cancelled';
    checked_in_at: string | null;
    created_at: string;
}
export interface TicketSummary {
    issued: number;
    accepted: number;
    paid: number;
    pending: number;
    invited: number;
    cancelled: number;
    revenue: number;
    cancelled_paid_amount: number;
    by_type: (TicketType & {
        issued: number;
        accepted: number;
        paid: number;
        pending: number;
    })[];
}
export interface ScanResult {
    status: 'accepted' | 'already_used' | 'invalid' | 'cancelled' | 'pending';
    type_name?: string;
    checked_in_at?: string;
    ticket_id?: string;
    price?: number;
    payment_status?: TicketPayment;
}
function failure(error: { message: string; code?: string }) {
    if (error.code === '23505') throw new Error('tickets.duplicateType');
    throw new Error(
        error.message.startsWith('tickets.')
            ? error.message
            : 'tickets.connectionError',
    );
}
export const ticketService = {
    async types(sessionId: string): Promise<TicketType[]> {
        const { data, error } = await supabase
            .from('event_ticket_types')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at');
        if (error) failure(error);
        return data || [];
    },
    async summary(sessionId: string): Promise<TicketSummary> {
        const { data, error } = await supabase.rpc('event_ticket_summary', {
            p_session: sessionId,
        });
        if (error) failure(error);
        return data;
    },
    async list(sessionId: string, page = 0): Promise<EventTicket[]> {
        const { data, error } = await supabase
            .from('event_tickets')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .order('id')
            .range(page * 50, page * 50 + 49);
        if (error) failure(error);
        return data || [];
    },
    async addType(
        sessionId: string,
        name: string,
        price: number,
        invitation: boolean,
    ): Promise<TicketType> {
        const { data, error } = await supabase
            .rpc('add_event_ticket_type', {
                p_session: sessionId,
                p_name: name.trim(),
                p_price: price,
                p_invitation: invitation,
            })
            .single<TicketType>();
        if (error) failure(error);
        if (!data) throw new Error('tickets.connectionError');
        return data;
    },
    async issue(
        sessionId: string,
        typeId: string,
        quantity: number,
        payment: TicketPayment,
        batchId: string,
    ): Promise<EventTicket[]> {
        const { data, error } = await supabase.rpc('issue_event_tickets', {
            p_session: sessionId,
            p_type: typeId,
            p_quantity: quantity,
            p_payment: payment,
            p_batch: batchId,
        });
        if (error) failure(error);
        return data || [];
    },
    async scan(sessionId: string, token: string): Promise<ScanResult> {
        const { data, error } = await supabase.rpc('check_in_event_ticket', {
            p_session: sessionId,
            p_token: token,
        });
        if (error) failure(error);
        return data;
    },
    async change(
        sessionId: string,
        ticketId: string,
        action: 'cancel' | 'paid',
    ): Promise<EventTicket> {
        const { data, error } = await supabase
            .rpc('change_event_ticket', {
                p_session: sessionId,
                p_ticket: ticketId,
                p_action: action,
            })
            .single<EventTicket>();
        if (error) failure(error);
        if (!data) throw new Error('tickets.connectionError');
        return data;
    },
};
