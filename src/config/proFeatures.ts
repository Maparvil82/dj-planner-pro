import { FEATURES } from './features';

// Commercial catalogue shared by the plans and the creation menu.
// Basic dashboard statistics and session organisation remain free.
export const PRO_FEATURES = [
    { id: 'unlimited', title: 'proPage.unlimited', description: 'proPage.unlimitedHint', enabled: true },
    { id: 'analytics', title: 'proPage.analytics', description: 'proPage.analyticsHint', enabled: true },
    { id: 'conditional', title: 'conditional.title', description: 'conditional.proBenefit', enabled: FEATURES.conditionalSessions || FEATURES.feeAgreements },
    { id: 'guests', title: 'guests.title', description: 'proPage.guestsHint', enabled: true },
    { id: 'access', title: 'entryCounter.title', description: 'proPage.accessHint', enabled: true },
] as const;
export type ProFeature = typeof PRO_FEATURES[number]['id'];
export function isProCreationAction(action: string): boolean {
    const feature = action === 'tickets' ? 'access' : action;
    return PRO_FEATURES.some(item => item.id === feature && item.enabled);
}
