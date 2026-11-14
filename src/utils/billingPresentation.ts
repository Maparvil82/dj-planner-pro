/** Only display a store product when its billing period matches the label. */
export function hasBillingPeriod(product: { subscriptionPeriod: string | null }, plan: 'monthly' | 'yearly') {
    return plan === 'monthly' ? product.subscriptionPeriod === 'P1M' : ['P1Y', 'P12M'].includes(product.subscriptionPeriod || '');
}
export function annualSaving(monthly?: { price: number; currencyCode: string } | null, annual?: { price: number; currencyCode: string } | null): number {
    if (!monthly || !annual || !Number.isFinite(monthly.price) || !Number.isFinite(annual.price) || monthly.price <= 0 || annual.price <= 0 || monthly.currencyCode !== annual.currencyCode) return 0;
    return Math.max(0, Math.min(99, Math.round((1 - annual.price / (monthly.price * 12)) * 100)));
}
export function subscriptionManagementUrl(platform: string, managementURL?: string | null): string {
    if (managementURL) return managementURL;
    return platform === 'android' ? 'https://play.google.com/store/account/subscriptions?package=com.djplannerpro.app' : 'https://apps.apple.com/account/subscriptions';
}

/** Advertise a store trial only when Apple confirms this customer's eligibility. */
export function freeIntroDuration(intro: { price: number; cycles: number; periodUnit: string; periodNumberOfUnits: number } | null | undefined, eligible: boolean, locale: string): string | null {
    if (!eligible || !intro || intro.price !== 0) return null;
    const unit = intro.periodUnit.toLowerCase();
    const count = intro.cycles * intro.periodNumberOfUnits;
    if (!['day', 'week', 'month', 'year'].includes(unit) || !Number.isInteger(count) || count <= 0) return null;
    try { return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' }).format(count); }
    catch { return null; }
}
