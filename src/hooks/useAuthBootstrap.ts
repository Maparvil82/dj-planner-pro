import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { profileService } from '../services/profile';

export function useAuthBootstrap() {
    const [isLoading, setIsLoading] = useState(true);
    const { setSession, setProfile, setInitialized, setHasHydrated } = useAuthStore();

    useEffect(() => {
        // Check active session on boot
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session);
            if (session?.user) {
                const pd = await profileService.getProfile(session.user.id);
                setProfile(pd);
            }
            setInitialized(true);
            setIsLoading(false);
        });

        // Listen for auth events (e.g. token refresh, sign in, sign out)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setSession(session);
                if (session?.user) {
                    const pd = await profileService.getProfile(session.user.id);
                    setProfile(pd);
                } else {
                    setProfile(null);
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return { isLoading };
}
