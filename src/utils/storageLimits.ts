export const IMAGE_MAX_BYTES = 1024 * 1024;
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const STORAGE_MAX_BYTES = 100 * 1024 * 1024;
export const DOCUMENT_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
export function validateDocument(type: string, bytes: number) {
    if (!DOCUMENT_TYPES.includes(type))
        throw new Error('storageSafety.unsupported');
    if (
        !Number.isSafeInteger(bytes) ||
        bytes <= 0 ||
        bytes > DOCUMENT_MAX_BYTES
    )
        throw new Error('storageSafety.documentTooLarge');
}
export function storageError(error: { message?: string }) {
    return error.message?.includes('STORAGE_QUOTA_EXCEEDED')
        ? new Error('storageSafety.quota')
        : error;
}
