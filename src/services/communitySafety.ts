import { supabase } from '../lib/supabase';
export type SafetyKind = 'profile' | 'session' | 'mix';
export type SafetyTarget = {
    kind: SafetyKind;
    id: string;
    authorId: string;
    name: string;
};
export const REPORT_REASONS = [
    'harassment',
    'hate',
    'sexual',
    'violence',
    'spam',
    'copyright',
    'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type SafetyStatus = {
    version: string;
    accepted: boolean;
    moderator: boolean;
    contact: string | null;
    restricted: boolean;
};
export type BlockedDJ = {
    user_id: string;
    artist_name: string;
    avatar_url: string | null;
};
export type CommunityReport = {
    id: string;
    kind: SafetyKind;
    target_id: string;
    author_id: string | null;
    reason: ReportReason;
    details: string;
    snapshot: Record<string, string | null>;
    status: 'open' | 'dismissed' | 'removed';
    created_at: string;
    review_note: string | null;
};
export async function safetyAction<T>(
    action: string,
    input: Record<string, unknown> = {},
): Promise<T> {
    const { data, error } = await supabase.rpc('community_safety', {
        action,
        input,
    });
    if (error) throw error;
    return data as T;
}
export const safetyService = {
    status: () => safetyAction<SafetyStatus>('status'),
    accept: (version: string) => safetyAction('accept', { version }),
    blocked: () => safetyAction<BlockedDJ[]>('blocked'),
    block: (userId: string) => safetyAction('block', { user_id: userId }),
    unblock: (userId: string) => safetyAction('unblock', { user_id: userId }),
    report: (target: SafetyTarget, reason: ReportReason, details: string) =>
        safetyAction('report', {
            kind: target.kind,
            target_id: target.id,
            reason,
            details,
        }),
    queue: (status: 'open' | 'closed', offset: number) =>
        safetyAction<CommunityReport[]>('queue', { status, offset }),
    review: (
        id: string,
        outcome: 'dismiss' | 'remove' | 'suspend' | 'restore',
        note: string,
    ) => safetyAction('review', { id, outcome, note }),
};
