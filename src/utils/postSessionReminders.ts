import type { Session } from '../types/session';
import { sessionRange } from './sessionPlanning';

export const POST_SESSION_NOTIFICATION_PREFIX = 'dj-session-review:';
export const POST_SESSION_DELAY_MS = 24 * 60 * 60 * 1000;
export type ReviewSession = Pick<Session, 'id' | 'user_id' | 'date' | 'start_time' | 'end_time' | 'venue' | 'booking_timezone' | 'status' | 'is_guest'>;

export function postSessionReminderPlan(rows: ReviewSession[], userId: string, now = Date.now()) {
    const unique = new Map<string, ReviewSession>();
    for (const row of rows) if (row.user_id === userId && !row.is_guest && row.status !== 'cancelled') unique.set(row.id, row);
    return [...unique.values()].flatMap(row => {
        try {
            const at = new Date(sessionRange(row).end.getTime() + POST_SESSION_DELAY_MS);
            if (!Number.isFinite(at.getTime()) || at.getTime() <= now) return [];
            return [{ ...row, at, identifier: `${POST_SESSION_NOTIFICATION_PREFIX}${row.id}` }];
        } catch { return []; }
    }).sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function sessionNotificationTarget(data: Record<string, unknown> | undefined, userId?: string) {
    if (!data || !userId || (data.notificationUserId && data.notificationUserId !== userId)) return null;
    if (typeof data.sessionReviewId === 'string')
        return { pathname: '/session/[id]' as const, params: { id: data.sessionReviewId, postSessionReview: '1' } };
    if (typeof data.voiceSessionId === 'string')
        return { pathname: '/session-notice' as const, params: { sessionId: data.voiceSessionId, voiceReminder: '1' } };
    return null;
}
