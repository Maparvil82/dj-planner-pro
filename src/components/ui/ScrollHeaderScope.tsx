import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useScrollHeader } from '../../hooks/useScrollHeader';

/** A sheet owns its scroll state independently from the page underneath it. */
export function ScrollHeaderScope({ children }: {
    children: (value: { progress: SharedValue<number>; onScrollBeginDrag: () => void; onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void }) => ReactNode;
}) {
    const value = useScrollHeader('compact');
    return <>{children(value)}</>;
}
