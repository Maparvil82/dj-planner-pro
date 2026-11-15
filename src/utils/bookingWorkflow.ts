import { validSessionDate } from './sessionWorkflow';
import type { BookingThread, BookingProposal } from '../services/bookings';
export function validBookingSchedule(input: {
    date: string;
    start_time: string;
    end_time: string;
}) {
    const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
    return (
        validSessionDate(input.date) &&
        clock.test(input.start_time) &&
        clock.test(input.end_time) &&
        input.start_time !== input.end_time
    );
}
export function bookingAmount(value: string): number | null {
    if (!/^\d{1,8}([.,]\d{1,2})?$/.test(value.trim())) return null;
    const number = Number(value.trim().replace(',', '.'));
    return Number.isFinite(number) ? number : null;
}
export function currentProposal(
    thread: BookingThread,
): BookingProposal | undefined {
    return thread.proposals.find(
        (p) => p.id === thread.request.latest_proposal_id,
    );
}
export function canAcceptProposal(
    thread: BookingThread,
    now = Date.now(),
): boolean {
    const p = currentProposal(thread);
    return (
        thread.request.state === 'proposed' &&
        !!p &&
        Date.parse(p.expires_at) > now
    );
}

// Never surface SQL diagnostics or internal error text in the product.
export function bookingErrorKey(error: unknown): string {
    const supported = new Set([
        'temporarily_unavailable',
        'not_authenticated',
        'pro_required',
        'service_not_ready',
        'public_profile_required',
        'slug_taken',
        'invalid_input',
        'invalid_message',
        'invalid_timezone',
        'invalid_date',
        'invalid_deadline',
        'request_not_found',
        'request_closed',
        'link_unavailable',
        'access_expired',
        'email_unverified',
        'proposal_changed',
        'proposal_expired',
        'schedule_conflict',
        'booking_hold_conflict',
        'session_limit_reached',
        'email_delivery_pending',
        'rate_limit',
        'share_failed',
        'web_required',
    ]);
    return typeof error === 'string' && supported.has(error)
        ? error
        : 'temporarily_unavailable';
}
