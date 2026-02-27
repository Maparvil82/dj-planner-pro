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
    setSession: (session: Session | null) => void;
    setProfile: (profile: UserProfile | null) => void;
    signOut: () => Promise<void>;
    setInitialized: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            session: null,
            user: null,
            profile: null,
            initialized: false,
            setSession: (session) =>
                set({
                    session,
                    user: session?.user || null,
                }),
            setProfile: (profile) => set({ profile }),
            setInitialized: (initialized) => set({ initialized }),
            signOut: async () => {
                await supabase.auth.signOut();
                set({ session: null, user: null, profile: null });
            },
        }),
        {
            name: 'dj-auth-storage', // key in AsyncStorage
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ session: state.session, user: state.user, profile: state.profile }), // Persist session + profile
        }
    )
);
