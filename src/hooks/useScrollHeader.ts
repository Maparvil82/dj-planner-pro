import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { cancelAnimation, Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useTabBarScroll } from '../contexts/TabBarVisibilityContext';

export function useScrollHeader(_variant: 'compact' | 'hide') {
    const progress = useSharedValue(0);
    const target = useRef(0);
    const focused = useRef(false);
    const { onScroll: onTabScroll, onScrollBeginDrag } = useTabBarScroll();
    useFocusEffect(useCallback(() => {
        focused.current = true;
        cancelAnimation(progress);
        target.current = 0;
        progress.value = 0;
        return () => { focused.current = false; cancelAnimation(progress); };
    }, [progress]));
    const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!focused.current) return;
        const delta = onTabScroll(event);
        if (delta === 0) return;
        // Start the transition on the first pixel in the new direction.
        const next = delta > 0 ? 1 : 0;
        if (target.current === next) return;
        target.current = next;
        cancelAnimation(progress);
        progress.value = withTiming(next, {
            duration: 240,
            easing: Easing.inOut(Easing.quad),
        });
    }, [onTabScroll, progress]);
    return { progress, onScroll, onScrollBeginDrag };
}
