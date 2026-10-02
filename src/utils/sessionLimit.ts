export const FREE_SESSION_LIMIT = 30;
export interface SessionUsage {
    count: number;
    limit: number;
    isPro: boolean;
    remaining: number;
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
