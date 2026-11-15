import { useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';

// Small background batches: never delay a form or the startup screen.
export function StorageMaintenance() {
    const id = useAuthStore((s) => s.session?.user.id);
    useEffect(() => {
        if (!id) return;
        let active = true,
            busy = false,
            last = 0;
        const run = async () => {
            if (!active || busy || Date.now() - last < 15 * 60 * 1000) return;
            busy = true;
            last = Date.now();
            try {
                const { error } = await supabase.functions.invoke(
                    'storage-maintenance',
                );
                if (error && __DEV__)
                    console.warn('Storage maintenance will retry later');
            } catch {
                if (__DEV__)
                    console.warn('Storage maintenance will retry later');
            } finally {
                busy = false;
            }
        };
        const timer = setTimeout(() => void run(), 5000);
        const listener = AppState.addEventListener('change', (state) => {
            if (state === 'active') void run();
        });
        return () => {
            active = false;
            clearTimeout(timer);
            listener.remove();
        };
    }, [id]);
    return null;
}
