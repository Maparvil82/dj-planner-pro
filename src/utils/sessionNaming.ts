/** The stored title stays empty when the event has no name. */
type SessionName = {
    title?: string | null;
    venue?: string | null;
    venue_city?: string | null;
    city?: string | null;
};
export type SessionNameTranslator = (
    key: string,
    options?: { venue: string },
) => string;
export function sessionDisplayTitle(
    session: SessionName,
    t: SessionNameTranslator,
): string {
    const name = session.title?.trim();
    if (name) return name;
    const venue = session.venue?.trim();
    return venue
        ? t('sessionNaming.atVenue', { venue })
        : t('sessionNaming.untitled');
}
export function sessionDisplaySubtitle(session: SessionName): string {
    return session.title?.trim()
        ? session.venue?.trim() || ''
        : session.venue_city?.trim() || session.city?.trim() || '';
}
