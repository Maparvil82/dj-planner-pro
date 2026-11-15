/** Currency aliases used by older sessions. Amounts are never converted. */
export function moneyCurrencyCode(value: string = 'EUR'): string {
    const code = value.trim();
    return ({ '€': 'EUR', '$': 'USD', '£': 'GBP', '¥': 'JPY' } as Record<string, string>)[code] || code.toUpperCase();
}

/** Number conventions follow the device region, independently of UI language. */
export function regionalNumberLocale(deviceTag: string, region?: string | null): string {
    try {
        const parts = (deviceTag || 'en-US').split('-');
        if (region) {
            // Works on native runtimes that support NumberFormat but not Locale.
            const index = parts.findIndex((part, i) => i > 0 && /^([A-Z]{2}|\d{3})$/.test(part));
            if (index > 0) parts[index] = region;
            else parts.splice(parts[1]?.length === 4 ? 2 : 1, 0, region);
        }
        const locale = parts.join('-');
        new Intl.NumberFormat(locale); // Validate without relying on Intl.Locale.
        return locale;
    } catch {
        return 'en-US';
    }
}

export function regionalCurrency(deviceCurrency?: string | null, region?: string | null): string {
    if (deviceCurrency && /^[A-Z]{3}$/.test(deviceCurrency)) return deviceCurrency;
    // Expo web does not provide currencyCode. Use an explicit region only.
    return ({ US: 'USD', GB: 'GBP', JP: 'JPY', BR: 'BRL', CA: 'CAD',
        CH: 'CHF', MX: 'MXN', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN',
        AU: 'AUD', NZ: 'NZD', CN: 'CNY', IN: 'INR', SE: 'SEK', NO: 'NOK',
        DK: 'DKK', PL: 'PLN', CZ: 'CZK' } as Record<string, string>)[region || ''] || 'EUR';
}

export function formatMoney(amount: number, currency: string, locale: string): string {
    const code = moneyCurrencyCode(currency);
    try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(amount);
    } catch {
        // Preserve an unknown legacy currency instead of relabelling its amount.
        return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount)} ${currency}`;
    }
}
