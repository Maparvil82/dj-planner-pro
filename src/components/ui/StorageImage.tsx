import { Image as NativeImage, View, type ImageProps } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/useAuthStore';
import { cachedMediaUrl, mediaLocation, signedMediaUrl } from '../../services/storageMedia';

function MediaImage(props: ImageProps & { className?: string }) {
    const id = useAuthStore((s) => s.session?.user.id);
    const uri =
        props.source &&
        !Array.isArray(props.source) &&
        typeof props.source === 'object' && 'uri' in props.source
            ? props.source.uri
            : undefined;
    const protectedAsset = uri ? mediaLocation(uri) : null;
    const query = useQuery({
        queryKey: ['storage-media', id, uri],
        queryFn: () => signedMediaUrl(uri!),
        enabled: !!id && !!protectedAsset,
        staleTime: 240000,
        gcTime: 300000,
        refetchInterval: 240000,
        retry: 1,
    });
    const resolvedUri = uri ? cachedMediaUrl(uri) || query.data : undefined;
    const source = protectedAsset
        ? resolvedUri
            ? { ...(props.source as object), uri: resolvedUri }
            : undefined
        : props.source;
    // Do not mount a native image with an empty source while signing its URL.
    // A premature native error can make callers permanently show their fallback.
    if (protectedAsset && !source) {
        return <View style={props.style} className={props.className} />;
    }
    return <NativeImage {...props} source={source} />;
}

export const StorageImage = Object.assign(MediaImage, {
    getSize(
        uri: string,
        success: (width: number, height: number) => void,
        failure?: (error: unknown) => void,
    ) {
        void signedMediaUrl(uri)
            .then((url) => NativeImage.getSize(url, success, failure))
            .catch((error) => failure?.(error));
    },
});
