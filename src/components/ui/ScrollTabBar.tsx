import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import {
    BottomTabBar,
    type BottomTabBarProps,
} from 'expo-router/build/react-navigation/bottom-tabs/index.js';

export function ScrollTabBar(props: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    const bottom = Math.max(insets.bottom - 16, 8);
    return (
        <View
            testID="scroll-tab-bar"
            style={{
                position: 'absolute',
                bottom,
                left: 24,
                right: 24,
                borderRadius: 30,
                shadowColor: '#000',
                shadowOpacity: dark ? 0.3 : 0.12,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 6 },
                elevation: 8,
            }}
        >
            <View style={{ borderRadius: 30, overflow: 'hidden', borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.7)' }}>
                <BottomTabBar {...props} insets={{ ...props.insets, bottom: 0 }} />
            </View>
        </View>
    );
}
