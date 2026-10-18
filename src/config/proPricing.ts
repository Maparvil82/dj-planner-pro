// Reference prices approved for Spain; native checkout always uses store prices.
export const PRO_REFERENCE_PRICES = {
    currency: 'EUR', monthly: 4.99, annualLaunch: 14.99, annualStandardPlanned: 39.99,
} as const;
export function hasReferencePrices(region?: string | null): boolean {
    return region?.toUpperCase() === 'ES';
}
export function isAnnualLaunchPrice(product: { price: number; currencyCode: string }): boolean {
    return product.currencyCode === PRO_REFERENCE_PRICES.currency && Math.abs(product.price - PRO_REFERENCE_PRICES.annualLaunch) < 0.005;
}

/** Storefront country codes can be ISO alpha-2 (Android) or alpha-3 (Apple). */
export function isSpanishStorefront(country?: string | null): boolean {
    return ['ES', 'ESP'].includes(country?.toUpperCase() || '');
}

export function hasSpanishPricing(country?: string | null, deviceRegion?: string | null): boolean {
    return country ? isSpanishStorefront(country) : hasReferencePrices(deviceRegion);
}

/** Never relabel a USD product as EUR. An inconsistent catalogue needs confirmation. */
export function needsSpanishPriceConfirmation(product: { currencyCode: string } | null | undefined, country?: string | null): boolean {
    return !!product && isSpanishStorefront(country) && product.currencyCode !== PRO_REFERENCE_PRICES.currency;
}

export function planPricingState(plan: 'monthly' | 'yearly', product: { price: number; currencyCode: string } | null | undefined,
    nativeStore: boolean, country?: string | null, deviceRegion?: string | null) {
    const needsConfirmation = nativeStore && needsSpanishPriceConfirmation(product, country);
    const reference = needsConfirmation || (!nativeStore && hasReferencePrices(deviceRegion));
    const launch = plan === 'yearly' && (reference || (hasSpanishPricing(country, deviceRegion) && !!product && isAnnualLaunchPrice(product)));
    return { source: reference ? 'reference' as const : product ? 'store' as const : 'unavailable' as const, needsConfirmation, launch };
}
