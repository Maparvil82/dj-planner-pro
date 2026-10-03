import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import {
    BottomTabBar,
    type BottomTabBarProps,
} from 'expo-router/build/react-navigation/bottom-tabs';
import { useTabBarVisibility } from '../../contexts/TabBarVisibilityContext';

export function ScrollTabBar(props: BottomTabBarProps) {
    const { hidden, setHidden } = useTabBarVisibility();
    const translateY = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        setHidden(false);
    }, [props.state.index, setHidden]);
    useEffect(() => {
        const animation = Animated.timing(translateY, {
            toValue: hidden ? 100 : 0,
            duration: 180,
            useNativeDriver: true,
        });
        animation.start();
        return () => animation.stop();
    }, [hidden, translateY]);
    return (
        <Animated.View
            aria-hidden={hidden}
            accessibilityElementsHidden={hidden}
            importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
            style={{
                pointerEvents: hidden ? 'none' : 'auto',
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                transform: [{ translateY }],
            }}
        >
            <BottomTabBar {...props} />
        </Animated.View>
    );
}
