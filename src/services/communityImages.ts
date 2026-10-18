import { Image, Platform } from 'react-native';
import { primeMediaUrls } from './storageMedia';

// Warm only the first visible rows; do not download the whole directory.
export function prefetchCommunityImages(profiles: Array<{
    avatar_url: string | null; cover_url: string | null;
}>) {
    const uris = profiles.slice(0, 6).flatMap((profile) =>
        [profile.avatar_url, profile.cover_url].filter((uri): uri is string => !!uri),
    );
    void primeMediaUrls(uris).then((results) => {
        if (Platform.OS === 'web') return;
        for (const result of results) {
            if (result.status === 'fulfilled') {
                void Image.prefetch(result.value).catch(() => { /* rendering retries */ });
            }
        }
    }).catch(() => { /* Preloading must never block the directory. */ });
}
