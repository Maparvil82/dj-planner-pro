import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { decode } from 'base64-arraybuffer';
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
const bucket = 'expense-receipts';
export const RECEIPT_MAX_BYTES = 600 * 1024;
export const expenseReceipts = {
    async upload(
        userId: string,
        uri: string,
        width: number,
        height: number,
    ): Promise<string> {
        const { manipulateAsync, SaveFormat } =
            await import('expo-image-manipulator');
        let bytes: ArrayBuffer | Uint8Array | undefined;
        // Preserve the entire receipt, with a maximum long edge of 1600px.
        for (const quality of [0.8, 0.65, 0.5]) {
            const scale = Math.min(1, 1600 / Math.max(width, height));
            const img = await manipulateAsync(
                uri,
                [
                    {
                        resize: {
                            width: Math.round(width * scale),
                            height: Math.round(height * scale),
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
                bytes =
                    Platform.OS === 'web' && img.base64
                        ? decode(img.base64)
                        : await new File(img.uri).bytes();
            } finally {
                if (Platform.OS !== 'web')
                    try {
                        new File(img.uri).delete();
                    } catch {
                        /* cache may have been removed */
                    }
            }
            if (bytes.byteLength <= RECEIPT_MAX_BYTES) break;
        }
        if (!bytes || bytes.byteLength > RECEIPT_MAX_BYTES)
            throw new Error('tools.photoTooLarge');
        const path = `${userId}/${randomUUID()}.jpg`;
        const { error } = await supabase.storage
            .from(bucket)
            .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
        return path;
    },
    async url(path: string) {
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 300);
        if (error) throw error;
        return data.signedUrl;
    },
    async remove(path: string) {
        const { error } = await supabase.storage.from(bucket).remove([path]);
        if (error) throw error;
    },
};
