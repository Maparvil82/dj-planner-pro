import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../services/profile';

interface AuthState {
    session: Session | null;
    user: User | null;
    profile: UserProfile | null;
    initialized: boolean;
    hasHydrated: boolean;
    hasSeenOnboarding: boolean;
    setSession: (session: Session | null) => void;
    setProfile: (profile: UserProfile | null) => void;
    signOut: () => Promise<void>;
    setInitialized: (val: boolean) => void;
    setHasSeenOnboarding: (val: boolean) => void;
    setHasHydrated: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            session: null,
            user: null,
            profile: null,
            initialized: false,
            hasHydrated: false,
            hasSeenOnboarding: false,
            setSession: (session) =>
                set((state) => ({
                    session,
                    user: session?.user || null,
                    profile: state.user?.id === session?.user.id ? state.profile : null,
                })),
            setProfile: (profile) => set({ profile }),
            setInitialized: (initialized) => set({ initialized }),
            setHasSeenOnboarding: (hasSeenOnboarding) => set({ hasSeenOnboarding }),
            setHasHydrated: (hasHydrated) => set({ hasHydrated }),
            signOut: async () => {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
                set({ session: null, user: null, profile: null, hasSeenOnboarding: false });
            },
        }),
        {
            name: 'dj-auth-storage-v2',
            version: 3,
            migrate: (persisted) => ({ hasSeenOnboarding: !!(persisted as {hasSeenOnboarding?: boolean})?.hasSeenOnboarding }),
            merge: (persisted, current) => ({...current, hasSeenOnboarding: !!(persisted as {hasSeenOnboarding?: boolean})?.hasSeenOnboarding}),
            storage: createJSONStorage(() => AsyncStorage),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
            partialize: (state) => ({
                hasSeenOnboarding: state.hasSeenOnboarding
            }),
        }
    )
);
