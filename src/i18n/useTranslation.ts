import { useTranslation as useI18nextTranslation } from 'react-i18next';
import { useLocales, useCalendars } from 'expo-localization';
import { regionalDateLocale, regionalFirstDay } from './regionalDates';
import { useCallback } from 'react';
import { formatMoney as regionalMoney, regionalNumberLocale, regionalCurrency } from './money';

export function useTranslation() {
    const { t, i18n } = useI18nextTranslation();
    const device = useLocales()[0];
    const calendar = useCalendars()[0];
    const dateLocale = regionalDateLocale(i18n.language, device?.languageTag || 'en-US', device?.regionCode);
    const firstDay = regionalFirstDay(dateLocale, calendar?.firstWeekday);
    const numberLocale = regionalNumberLocale(device?.languageTag || 'en-US', device?.regionCode);
    const formatMoney = useCallback((amount: number, currency: string) => regionalMoney(amount, currency, numberLocale), [numberLocale]);
    return { t, i18n, currentLanguage: i18n.language, dateLocale, firstDay, numberLocale, formatMoney, regionCode: device?.regionCode, defaultCurrency: regionalCurrency(device?.currencyCode, device?.regionCode) };
}
