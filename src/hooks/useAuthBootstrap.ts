import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { profileService } from '../services/profile';

export function useAuthBootstrap() {
    const [isLoading, setIsLoading] = useState(true);
    const { setSession, setProfile, setInitialized, setHasHydrated } = useAuthStore();

    useEffect(() => {
        let active = true;
        const timers = new Set<ReturnType<typeof setTimeout>>();
        const loadProfile = async (userId: string) => {
            try {
                const profile = await profileService.getProfile(userId);
                if (active && useAuthStore.getState().user?.id === userId) setProfile(profile);
            } catch (error) {
                console.warn('Could not load profile', error);
            }
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!active) return;
            setSession(session);
            if (session?.user) void loadProfile(session.user.id);
        }).catch(error => {
            console.warn('Could not restore session', error);
        }).finally(() => {
            if (!active) return;
            setInitialized(true);
            setIsLoading(false);
        });

        // Supabase holds its auth lock during this callback. Calling its API
        // here would deadlock session restoration, so defer profile requests.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                if (!active) return;
                setSession(session);
                if (session?.user) {
                    const timer = setTimeout(() => {
                        timers.delete(timer);
                        if (active) void loadProfile(session.user.id);
                    }, 0);
                    timers.add(timer);
                } else {
                    setProfile(null);
                }
            }
        );

        return () => {
            active = false;
            timers.forEach(clearTimeout);
            subscription.unsubscribe();
        };
    }, []);

    return { isLoading };
}
