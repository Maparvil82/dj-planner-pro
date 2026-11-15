import { supabase } from '../lib/supabase';
import { bookingErrorKey } from '../utils/bookingWorkflow';
export type BookingState =
    'new' | 'negotiating' | 'proposed' | 'accepted' | 'declined' | 'closed';
export interface BookingRequest {
    id: string;
    owner_id?: string;
    promoter_name: string;
    promoter_email: string;
    event_title: string;
    venue: string;
    city: string;
    date: string;
    start_time: string;
    end_time: string;
    budget: number;
    currency: string;
    timezone: string;
    state: BookingState;
    latest_proposal_id: string | null;
    session_id: string | null;
    created_at: string;
    updated_at: string;
}
export interface BookingProposal {
    id: string;
    version: number;
    event_title: string;
    venue: string;
    city: string;
    date: string;
    start_time: string;
    end_time: string;
    timezone: string;
    fee: number;
    currency: string;
    terms: string;
    expires_at: string;
    hold_until: string | null;
}
export interface BookingThread {
    request: BookingRequest;
    messages: {
        id: string;
        sender: 'dj' | 'promoter';
        body: string;
        created_at: string;
    }[];
    proposals: BookingProposal[];
}
export interface BookingSettings {
    slug: string;
    enabled: boolean;
    timezone: string;
    default_terms: string;
}
export interface BookingStatus {
    settings: BookingSettings | null;
    profile: { is_visible: boolean; artist_name: string } | null;
    isPro: boolean;
    serviceReady: boolean;
    webOrigin: string | null;
}
export async function bookingCall<T = any>(
    action: string,
    input: Record<string, unknown> = {},
): Promise<T> {
    const { data, error } = await supabase.functions.invoke('booking-gateway', {
        body: { action, input },
    });
    if (error) {
        let key = 'temporarily_unavailable';
        try {
            const response = await error.context?.json();
            if (response?.error) key = bookingErrorKey(response.error);
        } catch {}
        throw new Error(`bookings.errors.${key}`);
    }
    if (data?.error)
        throw new Error(`bookings.errors.${bookingErrorKey(data.error)}`);
    return data;
}
export async function listBookings(
    userId: string,
    offset = 0,
): Promise<BookingRequest[]> {
    const { data, error } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false })
        .order('id')
        .range(offset, offset + 19);
    if (error) throw new Error('bookings.errors.temporarily_unavailable');
    return data || [];
}
