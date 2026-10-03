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
    const travel = useRef(0);
    useFocusEffect(
        useCallback(() => {
            setHidden(false);
            travel.current = 0;
            return () => setHidden(false);
        }, [setHidden]),
    );
    return useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const { contentOffset, contentSize, layoutMeasurement } =
                event.nativeEvent;
            const max = Math.max(
                0,
                contentSize.height - layoutMeasurement.height,
            );
            const y = Math.max(0, Math.min(contentOffset.y, max));
            const delta = y - previous.current;
            previous.current = y;
            if (y <= 12 || max <= 12) {
                travel.current = 0;
                setHidden(false);
                return;
            }
            // Ignore bounce and tiny direction changes; reveal after a deliberate upward scroll.
            if (delta === 0) return;
            travel.current =
                Math.sign(delta) === Math.sign(travel.current)
                    ? travel.current + delta
                    : delta;
            if (Math.abs(travel.current) >= 14) {
                setHidden(travel.current > 0);
                travel.current = 0;
            }
        },
        [setHidden],
    );
}
