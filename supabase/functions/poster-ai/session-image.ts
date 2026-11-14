import { Image } from 'npm:imagescript@3.7.0';
import { PosterError } from './domain.ts';

export const SESSION_POSTER_MAX_BYTES = 1024 * 1024;
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
// Bound decoded pixel memory; current provider formats are below 2 MP.
const MAX_INPUT_PIXELS = 4 * 1024 * 1024;

/** A separate JPEG for the session bucket. Never mutate the provider's original. */
export async function sessionPosterImage(bytes: Uint8Array, mime: string): Promise<Uint8Array> {
    const signatureMatches = mime === 'image/jpeg'
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : mime === 'image/png' && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value);
    if (!bytes.length || bytes.length > MAX_INPUT_BYTES || !signatureMatches)
        throw new PosterError('poster_invalid_output');
    try {
        // The decoder checks the declared dimensions before allocating pixel buffers.
        // It also applies EXIF orientation before computing the target dimensions.
        const image = await Image.decode(bytes, { maxPixels: MAX_INPUT_PIXELS });
        if (mime === 'image/jpeg' && bytes.length <= SESSION_POSTER_MAX_BYTES && Math.max(image.width, image.height) <= 1600)
            return bytes;
        for (const [edge, quality] of [[1600, 82], [1600, 65], [1200, 70], [960, 60]]) {
            const scale = Math.min(1, edge / Math.max(image.width, image.height));
            if (scale < 1) image.resize(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
            // JPEG has no transparency. Composite on white rather than discard alpha.
            const pixels = image.bitmap;
            for (let i = 0; i < pixels.length; i += 4) {
                const alpha = pixels[i + 3];
                if (alpha === 255) continue;
                for (let channel = 0; channel < 3; channel++)
                    pixels[i + channel] = Math.round((pixels[i + channel] * alpha + 255 * (255 - alpha)) / 255);
                pixels[i + 3] = 255;
            }
            const jpeg = await image.encodeJPEG({ quality });
            if (jpeg.length && jpeg.length <= SESSION_POSTER_MAX_BYTES) return jpeg;
        }
        throw new PosterError('poster_invalid_output');
    } catch {
        throw new PosterError('poster_invalid_output');
    }
}
