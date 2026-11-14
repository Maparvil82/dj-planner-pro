import { useDarkPalette } from '../../contexts/ThemeContext';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { CurrencyTotals } from '../sessions/CurrencyTotals';

export function HomeSummaryCard({
    title,
    subtitle,
    totals,
    caption,
    highlighted = false,
    onPress,
}: {
    title: string;
    subtitle?: string;
    totals: Record<string, number>;
    caption: string;
    highlighted?: boolean;
    onPress: () => void;
}) {
    const darkPalette = useDarkPalette();
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    const foreground = highlighted ? (dark ? darkPalette.onPrimary : '#fff') : dark ? darkPalette.onSurface : '#202538';
    const muted = highlighted ? (dark ? darkPalette.onPrimary : '#d4ceef') : dark ? darkPalette.onSurface : '#6d7588';
    const content = (
        <>
            <Text
                style={{
                    color: highlighted ? (dark ? darkPalette.onPrimary : '#e1dcff') : muted,
                    fontSize: 12,
                    fontWeight: '600',
                    lineHeight: 17,
                    minHeight: subtitle ? undefined : 34,
                }}
            >
                {title}
            </Text>
            {subtitle ? <Text style={{ color: muted, fontSize: 11, lineHeight: 16, marginTop: 3, marginBottom: 12 }}>{subtitle}</Text> : null}
            <CurrencyTotals totals={totals} color={foreground} fontSize={36} />
            <Text
                style={{
                    color: muted,
                    fontSize: 11,
                    lineHeight: 16,
                    marginTop: 12,
                }}
            >
                {caption}
            </Text>
        </>
    );
    const layout = { padding: 18, borderRadius: 24, flex: 1, minHeight: 148 };
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
            activeOpacity={0.8}
            onPress={onPress}
            style={{ flex: 1 }}
        >
            <View
                testID={highlighted ? 'home-agreed-fees' : 'home-completed-fees'}
                style={{
                    ...layout,
                    backgroundColor: highlighted ? (dark ? darkPalette.primary : '#35316e') : (dark ? darkPalette.surface : '#fff'),
                    borderWidth: dark || highlighted ? 0 : 1,
                    borderColor: dark ? darkPalette.border : '#e9ecf3',
                }}
            >
                {content}
            </View>
        </TouchableOpacity>
    );
}
