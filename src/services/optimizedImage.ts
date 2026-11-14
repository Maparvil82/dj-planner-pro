import { Image, Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';
import { IMAGE_MAX_BYTES } from '../utils/storageLimits';

// Bound both dimensions and encoded bytes. Never crop or upscale artwork.
export async function optimizedImage(
    uri: string,
    maxEdge: number,
    dimensions?: { width: number; height: number },
): Promise<Uint8Array | ArrayBuffer> {
    const { manipulateAsync, SaveFormat } =
        await import('expo-image-manipulator');
    const File =
        Platform.OS !== 'web'
            ? (await import('expo-file-system')).File
            : undefined;
    const size =
        dimensions ||
        (await new Promise<{ width: number; height: number }>(
            (resolve, reject) =>
                Image.getSize(
                    uri,
                    (width, height) => resolve({ width, height }),
                    reject,
                ),
        ));
    if (!size.width || !size.height)
        throw new Error('storageSafety.invalidImage');
    for (const quality of [0.8, 0.65, 0.5]) {
        const scale = Math.min(1, maxEdge / Math.max(size.width, size.height));
        const img = await manipulateAsync(
            uri,
            [
                {
                    resize: {
                        width: Math.max(1, Math.round(size.width * scale)),
                        height: Math.max(1, Math.round(size.height * scale)),
                    },
                },
            ],
            {
                compress: quality,
                format: SaveFormat.JPEG,
                base64: Platform.OS === 'web',
            },
        );
        try {
            const bytes =
                Platform.OS === 'web' && img.base64
                    ? decode(img.base64)
                    : await new File!(img.uri).bytes();
            if (bytes.byteLength <= IMAGE_MAX_BYTES) return bytes;
        } finally {
            if (Platform.OS !== 'web') {
                try {
                    new File!(img.uri).delete();
                } catch {
                    /* temporary cache */
                }
            }
        }
    }
    throw new Error('storageSafety.imageTooLarge');
}
