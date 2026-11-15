import type { Session, SessionEventType } from '../types/session';
import { SESSION_EVENT_TYPES } from '../types/session';

export interface SessionTemplateFields {
    venue: string;
    venue_id: string | null;
    start_time: string;
    end_time: string;
    booking_timezone: string | null;
    event_type: SessionEventType | null;
    earning_type: 'free' | 'fixed' | 'hourly';
    earning_amount: number;
    currency: string;
    color: string;
}
export interface SessionTemplate {
    id: string;
    name: string;
    fields: SessionTemplateFields;
}
export function templateName(value: string): string {
    const name = value.trim();
    if (!name || name.length > 80) throw new Error('templates.invalidName');
    return name;
}
export function sessionTemplateFields(session: Session): SessionTemplateFields {
    if (session.earning_type === 'agreement') throw new Error('templates.agreementUnsupported');
    return {
        venue: session.venue,
        venue_id: session.venue_id || null,
        start_time: session.start_time.slice(0, 5),
        end_time: session.end_time.slice(0, 5),
        booking_timezone: session.booking_timezone || null,
        event_type: session.event_type || null,
        earning_type: session.earning_type,
        earning_amount: session.earning_type === 'free' ? 0 : session.earning_amount,
        currency: session.currency,
        color: session.color,
    };
}
export function validTemplate(value: unknown): value is SessionTemplate {
    if (!value || typeof value !== 'object') return false;
    const row = value as SessionTemplate;
    const f = row.fields;
    return typeof row.id === 'string' && !!row.id && typeof row.name === 'string' && !!row.name.trim() && row.name.length <= 80 && !!f &&
        typeof f.venue === 'string' && !!f.venue.trim() && (f.venue_id === null || typeof f.venue_id === 'string') &&
        [f.start_time, f.end_time].every(time => typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) && f.start_time !== f.end_time &&
        (f.booking_timezone === null || typeof f.booking_timezone === 'string') &&
        (f.event_type === null || SESSION_EVENT_TYPES.includes(f.event_type)) &&
        ['free', 'fixed', 'hourly'].includes(f.earning_type) && Number.isFinite(f.earning_amount) && f.earning_amount >= 0 &&
        typeof f.currency === 'string' && /^[A-Z]{3}$/.test(f.currency) && typeof f.color === 'string';
}
