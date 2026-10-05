import { agreementAmount, validateFeeAgreement } from './feeAgreement';
import type { CreateSessionInput, Session } from '../types/session';
import { localDateString, sessionRange } from './sessionPlanning';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';
export function sessionPhase(session: Session, now = new Date()) {
    if (session.status === 'cancelled') return 'cancelled';
    const { start, end } = sessionRange(session);
    return now < start ? 'confirmed' : now < end ? 'ongoing' : 'finished';
}
export function validSessionDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1900 || year > 2100) return false;
    const date = new Date(year, month - 1, day);
    return localDateString(date) === value;
}
export function parseSessionAmount(
    value: string,
    type: CreateSessionInput['earning_type'],
) {
    if (type === 'free' || type === 'agreement') return 0;
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))
        throw new Error('invalid_earning_amount');
    const amount = Number(value.trim().replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999)
        throw new Error('invalid_earning_amount');
    return amount;
}
export function validateSessionInput(
    input: CreateSessionInput,
): CreateSessionInput {
    if (!input.venue.trim()) throw new Error('missing_fields');
    if (input.booking_timezone !== undefined && !input.booking_timezone?.trim())
        throw new Error('location.invalidTimezone');
    if (input.booking_timezone) {
        try {
            new Intl.DateTimeFormat('en', {
                timeZone: input.booking_timezone,
            }).format();
        } catch {
            throw new Error('location.invalidTimezone');
        }
    }
    if (!validSessionDate(input.date)) throw new Error('workflow.invalidDate');
    if (
        ![input.start_time, input.end_time].every((time) =>
            /^([01]\d|2[0-3]):[0-5]\d$/.test(time),
        )
    )
        throw new Error('workflow.invalidTime');
    if (input.start_time === input.end_time)
        throw new Error('workflow.equalTimes');
    if (
        !['pending', 'confirmed', 'cancelled'].includes(
            input.status || 'pending',
        )
    )
        throw new Error('workflow.invalidStatus');
    if (
        !['free', 'fixed', 'hourly', 'agreement'].includes(
            input.earning_type || 'free',
        )
    )
        throw new Error('invalid_earning_amount');
    if (input.earning_type === 'agreement')
        validateFeeAgreement(input.fee_agreement!);
    if ((input.earning_type || 'free') !== 'free')
        parseSessionAmount(String(input.earning_amount), input.earning_type);
    const djs = input.is_collective
        ? [...new Set((input.djs || []).map((d) => d.trim()).filter(Boolean))]
        : [];
    if (input.is_collective && !djs.length)
        throw new Error('workflow.missingDjs');
    if (
        input.recurrence_type &&
        input.recurrence_type !== 'none' &&
        (!input.recurrence_end_date ||
            !validSessionDate(input.recurrence_end_date) ||
            input.recurrence_end_date < input.date)
    )
        throw new Error('invalid_recurrence');
    return {
        ...input,
        title: input.title.trim(),
        venue: input.venue.trim(),
        djs,
        dj_profile_ids: input.is_collective
            ? [...new Set(input.dj_profile_ids || [])]
            : [],
        fee_agreement:
            input.earning_type === 'agreement' ? input.fee_agreement : null,
        earning_amount:
            input.earning_type === 'agreement'
                ? agreementAmount(input.fee_agreement)
                : (input.earning_type || 'free') === 'free'
                  ? 0
                  : Number(input.earning_amount),
        status: input.status === 'cancelled' ? 'cancelled' : 'confirmed',
    };
}
export function relatedSessionTargets(
    sessions: Session[],
    current: Session,
    allFollowing: boolean,
): Session[] {
    if (!allFollowing) return [current];
    const root = current.parent_session_id || current.id;
    return sessions.filter(
        (s) =>
            (s.id === root || s.parent_session_id === root) &&
            s.date >= current.date,
    );
}
