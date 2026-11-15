export const DJ_PLATFORMS = ['mixcloud', 'soundcloud', 'instagram'] as const;
export type DJPlatform = (typeof DJ_PLATFORMS)[number];

// Only open the named platform; never accept executable or misleading URLs.
export function normalizeDJLink(value: string, platform: DJPlatform): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const url = new URL(
        /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        ![`${platform}.com`, `www.${platform}.com`].includes(
            url.hostname.toLowerCase(),
        ) ||
        /[\s<>]/.test(trimmed) ||
        url.href.length > 500
    )
        throw new Error('Invalid platform URL');
    return url.href;
}
