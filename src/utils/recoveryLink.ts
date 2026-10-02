// Tokens may arrive in a browser fragment or in Expo Router query parameters.
// Only consume links explicitly marked as password recovery.
export function recoveryCredentials(
    url: string,
): { access_token: string; refresh_token: string } | null {
    const parsed = new URL(url);
    const query = parsed.searchParams;
    const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const get = (key: string) => fragment.get(key) || query.get(key);
    if (get('error') || get('error_code') || get('type') !== 'recovery')
        return null;
    const access_token = get('access_token');
    const refresh_token = get('refresh_token');
    return access_token && refresh_token
        ? { access_token, refresh_token }
        : null;
}
