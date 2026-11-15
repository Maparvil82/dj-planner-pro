// A private draft can be saved at any point. Social actions need a complete,
// published DJ identity; removing a follow always remains possible.
export interface DJIdentity {
    avatar_url?: string | null;
    city?: string | null;
    genres?: string | null;
    is_visible?: boolean;
}
export function isDJProfileComplete(profile?: DJIdentity | null): boolean {
    return (
        !!profile?.avatar_url?.trim() &&
        !!profile.city?.trim() &&
        !!profile.genres?.split(/[,·;|]/).some((genre) => genre.trim())
    );
}
export function canUseDJProfile(profile?: DJIdentity | null): boolean {
    return !!profile?.is_visible && isDJProfileComplete(profile);
}
