import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { CurrencyTotals } from '../sessions/CurrencyTotals';

export function HomeSummaryCard({
    title,
    totals,
    caption,
    highlighted = false,
    onPress,
}: {
    title: string;
    totals: Record<string, number>;
    caption: string;
    highlighted?: boolean;
    onPress: () => void;
}) {
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    const foreground = highlighted ? '#fff' : dark ? '#f3f4f8' : '#202538';
    const muted = highlighted ? '#d4ceef' : dark ? '#a8b2c6' : '#6d7588';
    const content = (
        <>
            <Text
                style={{
                    color: highlighted ? '#e1dcff' : muted,
                    fontSize: 12,
                    fontWeight: '600',
                    lineHeight: 17,
                    minHeight: 34,
                }}
            >
                {title}
            </Text>
            <CurrencyTotals totals={totals} color={foreground} />
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
            accessibilityLabel={title}
            activeOpacity={0.8}
            onPress={onPress}
            style={{ flex: 1 }}
        >
            {highlighted ? (
                <LinearGradient
                    colors={['#202044', '#35316e', '#6250bb']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={layout}
                >
                    {content}
                </LinearGradient>
            ) : (
                <View
                    style={{
                        ...layout,
                        backgroundColor: dark ? '#171d2c' : '#fff',
                        borderWidth: 1,
                        borderColor: dark ? '#252d40' : '#e9ecf3',
                    }}
                >
                    {content}
                </View>
            )}
        </TouchableOpacity>
    );
}
