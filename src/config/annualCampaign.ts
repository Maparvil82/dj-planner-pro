import prices from './annualStorePrices.json';
import storefronts from './appleStorefronts.json';

// Apple equivalents previewed in App Store Connect on November 4, 2026.
// This is presentation data; purchases always use the current store product.
export function annualCampaignPrice(country?: string | null, deviceRegion?: string | null, now = new Date()) {
    const code = (country || deviceRegion || '').toUpperCase();
    const territory = code.length === 2 ? storefronts[code as keyof typeof storefronts] : code;
    const entry = prices[territory as keyof typeof prices];
    if (!entry) return null;
    const promotion = now < new Date(2027, 0, 7);
    return { currency: entry.currency, price: promotion ? entry.promotion : entry.standard, standard: entry.standard, promotion };
}
