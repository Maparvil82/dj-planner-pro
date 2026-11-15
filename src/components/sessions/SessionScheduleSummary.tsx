import { useDarkPalette } from '../../contexts/ThemeContext';
import { View, Text } from 'react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';
import { sessionDuration } from '../../utils/sessionPlanning';
import { parseSessionAmount } from '../../utils/sessionWorkflow';
export function SessionScheduleSummary({
    start,
    end,
    type,
    amount,
    currency,
}: {
    start: string;
    end: string;
    type: 'free' | 'hourly' | 'fixed' | 'agreement';
    amount: string;
    currency: string;
}) {
    const darkPalette = useDarkPalette();
    const { t, formatMoney, numberLocale } = useTranslation();
    const { activeTheme } = useTheme();
    let total: number | null = null;
    try {
        total =
            parseSessionAmount(amount, type) *
            (type === 'hourly'
                ? sessionDuration({ start_time: start, end_time: end })
                : 1);
    } catch {}
    const validTimes = [start, end].every((time) =>
        /^([01]\d|2[0-3]):[0-5]\d$/.test(time),
    );
    const equal = start === end;
    return (
        <View
            style={{
                backgroundColor: activeTheme === 'dark' ? '#25233c' : '#f2effc',
                borderRadius: 15,
                padding: 15,

                gap: 6,
            }}
        >
            <Text
                style={{
                    color: activeTheme === 'dark' ? darkPalette.primary : '#7666cf',
                    fontWeight: '700',
                    fontSize: 13,
                }}
            >
                {!validTimes
                    ? t('workflow.invalidTime')
                    : equal
                      ? t('workflow.equalTimes')
                      : `${t('duration')}: ${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 }).format(sessionDuration({ start_time: start, end_time: end }))} h`}
            </Text>
            {validTimes && !equal && end < start ? (
                <Text
                    style={{
                        color: activeTheme === 'dark' ? darkPalette.primary : '#7666cf',
                        fontSize: 12,
                    }}
                >
                    {t('workflow.nextDay')}
                </Text>
            ) : null}
            {validTimes && !equal && total !== null && type !== 'agreement' ? (
                <Text
                    style={{
                        color: activeTheme === 'dark' ? darkPalette.primary : '#7666cf',
                        fontSize: 12,
                    }}
                >
                    {t('workflow.totalFee')}:{' '}
                    {formatMoney(total, currency)}
                </Text>
            ) : null}
        </View>
    );
}
