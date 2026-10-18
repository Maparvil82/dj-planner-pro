/** Keep regional conventions separate from the language of the interface. */
export function regionalDateLocale(language: string, deviceTag: string, region?: string | null) {
    const languageCode = language.split('-')[0] || 'en';
    const deviceRegion = region || deviceTag.split('-').find((part) => /^[A-Z]{2}$|^\d{3}$/.test(part));
    return deviceRegion ? `${languageCode}-${deviceRegion}` : deviceTag || language;
}

export function regionalFirstDay(locale: string, nativeFirstWeekday?: number | null): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
    // Expo numbers Sunday as 1; react-native-calendars/date-fns number it as 0.
    if (nativeFirstWeekday && nativeFirstWeekday >= 1 && nativeFirstWeekday <= 7) {
        return (nativeFirstWeekday - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    }
    try {
        const regional = new Intl.Locale(locale) as Intl.Locale & {
            getWeekInfo?: () => { firstDay: number };
            weekInfo?: { firstDay: number };
        };
        const info = regional.getWeekInfo?.() || regional.weekInfo;
        if (info) return (info.firstDay % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    } catch { /* Older runtimes may not expose week information. */ }
    const region = locale.split('-').find((part) => /^[A-Z]{2}$/.test(part));
    if (['AF', 'BH', 'DJ', 'DZ', 'EG', 'IQ', 'IR', 'JO', 'KW', 'LY', 'OM', 'QA', 'SD', 'SY'].includes(region || '')) return 6;
    if (['US', 'CA', 'MX', 'BR', 'JP', 'PH', 'KR', 'TW', 'TH', 'IL', 'SA', 'IN', 'AU', 'NZ', 'CO', 'VE', 'PE', 'PT'].includes(region || '')) return 0;
    return 1;
}

export function formatRegionalDate(date: string, locale: string) {
    return new Date(`${date}T12:00:00`).toLocaleDateString(locale, {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
}
