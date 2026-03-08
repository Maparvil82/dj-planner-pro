import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SubscriptionState {
    isPro: boolean;
    hasCheckedSubscription: boolean;
    setPro: (val: boolean) => void;
    checkSubscription: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>()(
    persist(
        (set) => ({
            isPro: false,
            hasCheckedSubscription: false,
            setPro: (isPro) => set({ isPro }),
            checkSubscription: async () => {
                // Mocking subscription check logic
                // In a real app, this would call RevenueCat / App Store / Play Store
                set({ hasCheckedSubscription: true });
            },
        }),
        {
            name: 'dj-subscription-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
