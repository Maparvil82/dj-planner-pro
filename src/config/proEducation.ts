export const PRO_TRIAL_DAYS = 15;
export const EDUCATED_PRO_FEATURES = ['conditional', 'guests', 'access'] as const;
export type EducatedProFeature = typeof EDUCATED_PRO_FEATURES[number];
export function proEducationFeature(value?: string | string[]): EducatedProFeature | null {
    const feature = Array.isArray(value) ? value[0] : value;
    return EDUCATED_PRO_FEATURES.find(item => item === feature) ?? null;
}
export const PRO_TOOL_ROUTES = {
    conditional: '/conditional-session',
    guests: '/guests',
    access: '/tickets',
} as const;
