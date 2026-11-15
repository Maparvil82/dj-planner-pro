import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useCurrencyPreference = create(persist<{
    currencies: Record<string, string>;
    setCurrency: (userId: string, currency: string | null) => void;
}>((set) => ({
    currencies: {},
    setCurrency: (userId, currency) => set(state => {
        const currencies = { ...state.currencies };
        if (currency) currencies[userId] = currency;
        else delete currencies[userId];
        return { currencies };
    }),
}), { name: 'dj-currency-preferences', storage: createJSONStorage(() => AsyncStorage) }));
