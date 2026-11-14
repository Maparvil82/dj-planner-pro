import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const useAnalyticsConsent = create<{
    choices: Record<string, boolean>;
    hydrated: boolean;
    choose: (userId: string, value: boolean) => void;
}>()(persist((set) => ({
    choices: {}, hydrated: false,
    choose: (userId, value) => set((state) => ({ choices: { ...state.choices, [userId]: value } })),
}), {
    name: 'djplanner-analytics-consent-v1',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: ({ choices }) => ({ choices }),
    onRehydrateStorage: () => () => useAnalyticsConsent.setState({ hydrated: true }),
}));
