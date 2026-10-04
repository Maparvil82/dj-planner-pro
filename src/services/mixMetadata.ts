import { parseMixSource, type MixSource } from '../utils/profileMixes';

export interface MixMetadata {
    artwork: string | null;
    author: string;
    genres: string[];
    duration: number | null;
    plays: number | null;
}
function imageUrl(
    value: unknown,
    platform: MixSource['platform'],
): string | null {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        const suffix =
            platform === 'mixcloud' ? '.mixcloud.com' : '.sndcdn.com';
        return url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            !url.port &&
            url.hostname.endsWith(suffix)
            ? url.href
            : null;
    } catch {
        return null;
    }
}
function nonnegative(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? Math.floor(value)
        : null;
}
export async function fetchMixMetadata(
    source: MixSource,
    signal?: AbortSignal,
): Promise<MixMetadata> {
    const verified = parseMixSource(source.source_url);
    if (verified.platform !== source.platform) throw new Error('INVALID_MIX');
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 10000);
    try {
        const endpoint =
            source.platform === 'mixcloud'
                ? `https://api.mixcloud.com${new URL(verified.source_url).pathname}`
                : `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(verified.source_url)}`;
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) throw new Error('METADATA_UNAVAILABLE');
        const data = await response.json();
        if (
            source.platform === 'mixcloud' &&
            data.key !== new URL(verified.source_url).pathname
        )
            throw new Error('INVALID_METADATA');
        return {
            artwork: imageUrl(
                source.platform === 'mixcloud'
                    ? data.pictures?.large
                    : data.thumbnail_url,
                source.platform,
            ),
            author: String(
                source.platform === 'mixcloud'
                    ? data.user?.name || ''
                    : data.author_name || '',
            ).slice(0, 100),
            genres:
                source.platform === 'mixcloud' && Array.isArray(data.tags)
                    ? data.tags
                          .map((tag: { name?: unknown }) =>
                              typeof tag?.name === 'string'
                                  ? tag.name.slice(0, 50)
                                  : '',
                          )
                          .filter(Boolean)
                          .slice(0, 10)
                    : [],
            duration:
                source.platform === 'mixcloud'
                    ? nonnegative(data.audio_length)
                    : null,
            plays:
                source.platform === 'mixcloud'
                    ? nonnegative(data.play_count)
                    : null,
        };
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
    }
}
export function mixDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    return minutes >= 60
        ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
        : `${minutes}m`;
}
