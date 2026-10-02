import { Text, View } from 'react-native';
import { useTranslation } from '../../i18n/useTranslation';

export function CurrencyTotals({
    totals,
    projected = false,
    color,
}: {
    totals: Record<string, number>;
    projected?: boolean;
    color?: string;
}) {
    const { currentLanguage } = useTranslation();
    const entries = Object.entries(totals);
    return (
        <View className="mt-5">
            {(entries.length ? entries : [['€', 0] as const]).map(
                ([currency, value]) => (
                    <Text
                        key={currency}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.5}
                        className={
                            projected
                                ? 'text-neutral-400 dark:text-emerald-400'
                                : 'text-gray-900 dark:text-white'
                        }
                        style={{
                            fontSize: entries.length > 1 ? 22 : 32,
                            fontWeight: '800',
                            ...(color ? { color } : {}),
                        }}
                    >
                        {value.toLocaleString(currentLanguage, {
                            maximumFractionDigits: 2,
                        })}{' '}
                        {currency}
                    </Text>
                ),
            )}
        </View>
    );
}
