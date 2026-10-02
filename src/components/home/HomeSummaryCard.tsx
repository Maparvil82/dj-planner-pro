import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, CheckCheck, TrendingUp } from 'lucide-react-native';
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
    const Icon = highlighted ? TrendingUp : CheckCheck;
    const content = (
        <>
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 14,
                }}
            >
                <View
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 11,
                        backgroundColor: highlighted
                            ? '#ffffff16'
                            : dark
                              ? '#123c3b'
                              : '#e7f6f3',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Icon
                        size={17}
                        color={highlighted ? '#cec4ff' : '#099a91'}
                    />
                </View>
                <ArrowUpRight size={16} color={muted} />
            </View>
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
    const layout = { padding: 18, borderRadius: 24, flex: 1, minHeight: 194 };
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
