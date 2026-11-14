import { Pressable, Text, View } from 'react-native';
import { useCommunityColors } from '../community/communityColors';
import { useDarkPalette } from '../../contexts/ThemeContext';

export function SegmentedTabs<T extends string>({ options, value, onChange, label }: {
    options: readonly { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    label: string;
}) {
    const c = useCommunityColors();
    const palette = useDarkPalette();
    return (
        <View accessibilityRole="tablist" accessibilityLabel={label}
            style={{ flexDirection: 'row', padding: 5, backgroundColor: c.dark ? palette.raised : '#e9eaf3', borderRadius: 16, gap: 4 }}>
            {options.map(option => (
                <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: value === option.value }} aria-selected={value === option.value}
                    onPress={() => onChange(option.value)}
                    style={{ flex: 1, minHeight: 44, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: value === option.value ? c.card : 'transparent' }}>
                    <Text style={{ color: value === option.value ? c.accent : c.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{option.label}</Text>
                </Pressable>
            ))}
        </View>
    );
}
