import { useState, type ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

export function ScrollHeaderContainer({ children, progress, hasIcons: _hasIcons, style }: {
    children: ReactNode; progress: SharedValue<number>; hasIcons: boolean; style?: ViewStyle;
}) {
    const [height, setHeight] = useState(0);
    const container = useAnimatedStyle(() => height ? { height: height * (1 - progress.value) } : {});
    const body = useAnimatedStyle(() => ({
        opacity: 1 - 0.35 * progress.value,
        transform: [{ translateY: -12 * progress.value }],
    }));
    return <Animated.View testID="scroll-toolbar-hide" style={[style, { overflow: 'hidden' }, container]}>
        <Animated.View onLayout={event => { const next = event.nativeEvent.layout.height; if (next > 0 && next !== height) setHeight(next); }}
            style={[{ position: height ? 'absolute' : undefined, left: 0, right: 0 }, body]}>
            {children}
        </Animated.View>
    </Animated.View>;
}
