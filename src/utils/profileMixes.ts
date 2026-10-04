export type MixPlatform = 'mixcloud' | 'soundcloud';
export interface MixSource {
    platform: MixPlatform;
    source_url: string;
}
const RESERVED = new Set([
    'discover',
    'search',
    'genres',
    'live',
    'upload',
    'settings',
    'you',
    'stream',
    'charts',
    'playlists',
    'sets',
    'tracks',
    'likes',
    'reposts',
    'followers',
    'following',
    'favorites',
]);
// Store links to individual public recordings, never pasted HTML or arbitrary embeds.
export function parseMixSource(input: string): MixSource {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const parts = url.pathname.split('/').filter(Boolean);
    if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        !['mixcloud.com', 'soundcloud.com'].includes(host) ||
        parts.length !== 2 ||
        parts.some(
            (part) =>
                !/^[A-Za-z0-9_-]+$/.test(part) ||
                RESERVED.has(part.toLowerCase()),
        )
    ) {
        throw new Error('INVALID_MIX');
    }
    return {
        platform: host === 'mixcloud.com' ? 'mixcloud' : 'soundcloud',
        source_url: `https://${host === 'mixcloud.com' ? 'www.' : ''}${host}/${parts.join('/')}${host === 'mixcloud.com' ? '/' : ''}`,
    };
}
export function mixEmbedUrl(source: MixSource): string {
    const verified = parseMixSource(source.source_url);
    if (verified.platform !== source.platform) throw new Error('INVALID_MIX');
    return source.platform === 'mixcloud'
        ? `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(new URL(verified.source_url).pathname)}&hide_cover=0&light=1`
        : `https://w.soundcloud.com/player/?url=${encodeURIComponent(verified.source_url)}&auto_play=false&color=%236554df&show_artwork=true&single_active=true`;
}
// Mixcloud redirects its official iframe to this player host. Keep that
// redirect inside the app while ordinary provider links open externally.
export function isMixPlayerNavigation(
    input: string,
    source: MixSource,
): boolean {
    try {
        const url = new URL(input);
        if (
            url.protocol !== 'https:' ||
            url.username ||
            url.password ||
            url.port
        )
            return false;
        if (source.platform === 'mixcloud') {
            const widget =
                (url.hostname === 'www.mixcloud.com' &&
                    url.pathname === '/widget/iframe/') ||
                (url.hostname === 'player-widget.mixcloud.com' &&
                    ['/', '/widget/iframe/'].includes(url.pathname));
            const feed = url.searchParams.get('feed');
            return (
                widget &&
                (feed === new URL(source.source_url).pathname ||
                    feed === source.source_url)
            );
        }
        return (
            url.hostname === 'w.soundcloud.com' &&
            url.pathname === '/player/' &&
            url.searchParams.get('url') === source.source_url
        );
    } catch {
        return false;
    }
}
