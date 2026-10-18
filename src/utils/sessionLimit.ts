export const FREE_SESSION_LIMIT = 15;
export interface SessionUsage {
    count: number;
    limit: number;
    isPro: boolean;
    remaining: number;
    paidPro?: boolean;
    serverNow?: string;
    trial?: { eligible: boolean; status: 'available' | 'active' | 'expired'; startedAt: string | null; expiresAt: string | null };
}
export function exceedsSessionLimit(
    usage: SessionUsage,
    requested: number,
): boolean {
    return !usage.isPro && usage.count + requested > usage.limit;
}
export class SessionLimitError extends Error {
    constructor(
        public usage: SessionUsage,
        public requested: number,
    ) {
        super('session_limit_reached');
        this.name = 'SessionLimitError';
    }
}
