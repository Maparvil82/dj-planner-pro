import { useEffect, useState } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
    BottomTabBar,
    type BottomTabBarProps,
} from 'expo-router/build/react-navigation/bottom-tabs';
import { useTabBarVisibility } from '../../contexts/TabBarVisibilityContext';

export function ScrollTabBar(props: BottomTabBarProps) {
    const { hidden, setHidden } = useTabBarVisibility();
    const progress = useSharedValue(0);
    const [height, setHeight] = useState(100);
    useEffect(() => {
        setHidden(false);
    }, [props.state.index, setHidden]);
    useEffect(() => {
        progress.value = withTiming(hidden ? 1 : 0, {
            duration: 240,
            easing: Easing.inOut(Easing.quad),
        });
    }, [hidden, progress]);
    const motion = useAnimatedStyle(() => ({ transform: [{ translateY: (height + 8) * progress.value }] }));
    return (
        <Animated.View
            testID="scroll-tab-bar"
            onLayout={event => { const next = event.nativeEvent.layout.height; if (next > 0 && next !== height) setHeight(next); }}
            aria-hidden={hidden}
            accessibilityElementsHidden={hidden}
            importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
            style={[{
                pointerEvents: hidden ? 'none' : 'auto',
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
            }, motion]}
        >
            <BottomTabBar {...props} />
        </Animated.View>
    );
}
