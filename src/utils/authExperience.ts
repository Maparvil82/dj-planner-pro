export function validAuthEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
export function authErrorKey(
    error: { code?: string; status?: number } | null | undefined,
): string {
    if (error?.status === 429) return 'authExperience.rateLimit';
    switch (error?.code) {
        case 'invalid_credentials':
            return 'authExperience.invalidCredentials';
        case 'email_not_confirmed':
            return 'authExperience.emailUnconfirmed';
        case 'user_already_exists':
        case 'email_exists':
            return 'authExperience.accountExists';
        case 'email_address_invalid':
            return 'invalid_email';
        case 'weak_password':
            return 'authExperience.passwordHint';
        case 'over_email_send_rate_limit':
        case 'over_request_rate_limit':
            return 'authExperience.rateLimit';
        case 'signup_disabled':
            return 'authExperience.signupUnavailable';
        default:
            return 'authExperience.connectionError';
    }
}
