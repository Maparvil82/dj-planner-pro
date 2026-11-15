import { useCallback } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

// Keep headers expanded while preserving the interface used by screen scroll views.
export function useScrollHeader(_variant: 'compact' | 'hide') {
    const progress = useSharedValue(0);
    const onScroll = useCallback((_event: NativeSyntheticEvent<NativeScrollEvent>) => {}, []);
    const onScrollBeginDrag = useCallback(() => {}, []);
    return { progress, onScroll, onScrollBeginDrag };
}
