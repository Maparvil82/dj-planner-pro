import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { startOperation } from '../monitoring';

/** Time from focused screen mount to its initial data being ready; no route parameters. */
export function useScreenMonitoring(screen: 'home' | 'history' | 'dashboard' | 'calendar', loading: boolean, failed: boolean) {
    const routeFocused = useIsFocused();
    const [active, setActive] = useState(AppState.currentState === 'active');
    const focused = routeFocused && active;
    useEffect(() => { const listener = AppState.addEventListener('change', state => setActive(state === 'active')); return () => listener.remove(); }, []);
    const current = useRef<ReturnType<typeof startOperation> | null>(null);
    const complete = useRef(false);
    useEffect(() => {
        if (!focused) return;
        complete.current = false; current.current = startOperation(`screen.${screen}`);
        return () => { current.current?.(true, true); current.current = null; };
    }, [focused, screen]);
    useEffect(() => {
        if (!focused || loading || complete.current) return;
        const frame = requestAnimationFrame(() => { current.current?.(failed); current.current = null; complete.current = true; });
        return () => cancelAnimationFrame(frame);
    }, [focused, loading, failed]);
}
