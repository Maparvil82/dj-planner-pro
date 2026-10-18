import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';

const TabBarVisibilityContext = createContext({
    hidden: false,
    setHidden: (_hidden: boolean) => {},
});
export function TabBarVisibilityProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [hidden, setHidden] = useState(false);
    const value = useMemo(() => ({ hidden, setHidden }), [hidden]);
    return (
        <TabBarVisibilityContext.Provider value={value}>
            {children}
        </TabBarVisibilityContext.Provider>
    );
}
export const useTabBarVisibility = () => useContext(TabBarVisibilityContext);

export function useTabBarScroll() {
    const { setHidden } = useTabBarVisibility();
    const previous = useRef(0);
    const focused = useRef(false);
    const bouncing = useRef(false);
    useFocusEffect(
        useCallback(() => {
            focused.current = true;
            previous.current = 0;
            bouncing.current = false;
            setHidden(false);
            return () => {
                focused.current = false;
                setHidden(false);
            };
        }, [setHidden]),
    );
    const onScrollBeginDrag = useCallback(() => { bouncing.current = false; }, []);
    const onScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (!focused.current) return 0;
            const { contentOffset, contentSize, layoutMeasurement } =
                event.nativeEvent;
            const max = Math.max(
                0,
                contentSize.height - layoutMeasurement.height,
            );
            const y = Math.max(0, Math.min(contentOffset.y, max));
            // Compare both offsets within today's bounds. A shrinking header
            // grows the viewport and can move its bottom without a user gesture.
            const previousY = Math.max(0, Math.min(previous.current, max));
            const delta = y - previousY;
            previous.current = contentOffset.y;
            // Native rubber-band recovery is not an upward user gesture, even
            // when its spring briefly settles inside the content boundary.
            const recoveringBounce = bouncing.current;
            if (contentOffset.y > max || contentOffset.y < 0) bouncing.current = true;
            if (recoveringBounce) return 0;
            // Stationary events and overscroll keep the current visibility.
            if (delta === 0) return 0;
            // React to the first movement instead of accumulating scroll distance.
            if (delta > 0) setHidden(true);
            else if (delta < 0) setHidden(false);
            return delta;
        },
        [setHidden],
    );
    return { onScroll, onScrollBeginDrag };
}
