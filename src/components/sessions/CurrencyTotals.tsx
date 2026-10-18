import { Text, View } from 'react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { moneyCurrencyCode } from '../../i18n/money';

export function CurrencyTotals({
    totals,
    projected = false,
    color,
}: {
    totals: Record<string, number>;
    projected?: boolean;
    color?: string;
}) {
    const { formatMoney, defaultCurrency } = useTranslation();
    const combined: Record<string, number> = {};
    for (const [currency, amount] of Object.entries(totals)) {
        const code = moneyCurrencyCode(currency);
        combined[code] = (combined[code] || 0) + amount;
    }
    const entries = Object.entries(combined);
    return (
        <View className="mt-5">
            {(entries.length ? entries : [[defaultCurrency, 0] as const]).map(
                ([currency, value]) => (
                    <Text
                        key={currency}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.5}
                        className={
                            projected
                                ? 'text-neutral-400 dark:text-emerald-400'
                                : 'text-gray-900 dark:text-djDark-text'
                        }
                        style={{
                            fontSize: entries.length > 1 ? 22 : 32,
                            fontWeight: '800',
                            ...(color ? { color } : {}),
                        }}
                    >
                        {formatMoney(value, currency)}
                    </Text>
                ),
            )}
        </View>
    );
}
