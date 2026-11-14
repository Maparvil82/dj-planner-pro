import { supabase } from '../lib/supabase';

// Reuse stable URLs so native image caches work across cards and screens.
const signedUrls = new Map<string, { url: string; expires: number }>();
const pendingUrls = new Map<string, Promise<string>>();
let viewer: string | undefined;
let generation = 0;
supabase.auth.onAuthStateChange((_event, session) => {
    const nextViewer = session?.user.id;
    if (nextViewer !== viewer) {
        viewer = nextViewer;
        generation++;
        signedUrls.clear();
        pendingUrls.clear();
    }
});
export function mediaLocation(uri: string) {
    try {
        const url = new URL(uri);
        if (url.origin !== process.env.EXPO_PUBLIC_SUPABASE_URL) return null;
        const match = url.pathname.match(
            /^\/storage\/v1\/object\/(?:public|sign)\/(avatars|sessions|venues)\/(.+)$/,
        );
        return match
            ? { bucket: match[1], path: decodeURIComponent(match[2]) }
            : null;
    } catch {
        return null;
    }
}
export function cachedMediaUrl(uri: string) {
    const asset = mediaLocation(uri);
    if (!asset) return uri;
    const cached = signedUrls.get(`${asset.bucket}/${asset.path}`);
    return cached && cached.expires > Date.now() ? cached.url : undefined;
}

// Reserve each URL synchronously, so mounted cards share the batch in flight.
export async function primeMediaUrls(uris: string[]) {
    const groups = new Map<string, Array<{
        key: string; path: string; resolve: (url: string) => void;
        reject: (error: unknown) => void; promise: Promise<string>;
    }>>();
    const currentGeneration = generation;
    const started = Date.now();
    const requests = [...new Set(uris)].map((uri) => {
        const cached = cachedMediaUrl(uri);
        if (cached) return Promise.resolve(cached);
        const asset = mediaLocation(uri)!;
        const key = `${asset.bucket}/${asset.path}`;
        const pending = pendingUrls.get(key);
        if (pending) return pending;
        let resolve!: (url: string) => void;
        let reject!: (error: unknown) => void;
        const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
        pendingUrls.set(key, promise);
        const group = groups.get(asset.bucket) || [];
        group.push({ key, path: asset.path, resolve, reject, promise });
        groups.set(asset.bucket, group);
        return promise;
    });
    for (const [bucket, group] of groups) {
        void (async () => {
            try {
                const { data, error } = await supabase.storage.from(bucket)
                    .createSignedUrls(group.map((item) => item.path), 300);
                if (error) throw error;
                for (const item of group) {
                    const row = data?.find((entry) => entry.path === item.path);
                    if (!row?.signedUrl || row.error) {
                        item.reject(new Error(row?.error || 'Unable to load image'));
                    } else if (generation !== currentGeneration) {
                        item.reject(new Error('Image session changed'));
                    } else {
                        if (signedUrls.size >= 300) signedUrls.delete(signedUrls.keys().next().value!);
                        signedUrls.set(item.key, { url: row.signedUrl, expires: started + 240000 });
                        item.resolve(row.signedUrl);
                    }
                }
            } catch (error) {
                group.forEach((item) => item.reject(error));
            } finally {
                for (const item of group) {
                    if (pendingUrls.get(item.key) === item.promise) pendingUrls.delete(item.key);
                }
            }
        })();
    }
    return Promise.allSettled(requests);
}
export async function signedMediaUrl(uri: string) {
    const asset = mediaLocation(uri);
    if (!asset) return uri;
    const key = `${asset.bucket}/${asset.path}`;
    const cached = signedUrls.get(key);
    if (cached && cached.expires > Date.now()) return cached.url;
    const pending = pendingUrls.get(key);
    if (pending) return pending;
    const currentGeneration = generation;
    const started = Date.now();
    const request = (async () => {
        const { data, error } = await supabase.storage
            .from(asset.bucket)
            .createSignedUrl(asset.path, 300);
        if (error) throw error;
        if (generation !== currentGeneration) throw new Error('Image session changed');
        if (generation === currentGeneration) {
            if (signedUrls.size >= 300) signedUrls.delete(signedUrls.keys().next().value!);
            signedUrls.set(key, { url: data.signedUrl, expires: started + 240000 });
        }
        return data.signedUrl;
    })();
    pendingUrls.set(key, request);
    try {
        return await request;
    } finally {
        if (pendingUrls.get(key) === request) pendingUrls.delete(key);
    }
}
