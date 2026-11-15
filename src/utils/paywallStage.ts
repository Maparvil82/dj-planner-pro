type TrialState = { status: string; eligible: boolean } | null | undefined;

export function paywallStage(paidPro: boolean, trial: TrialState, showPlans: boolean): 'intro' | 'active' | 'plans' | 'member' {
    if (paidPro) return 'member';
    if (showPlans) return 'plans';
    if (trial?.status === 'active') return 'active';
    if (trial?.status === 'available' && trial.eligible) return 'intro';
    return 'plans';
}
