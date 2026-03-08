import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../src/store/useAuthStore';
import { AppProviders } from '../src/providers/AppProviders';
import '../global.css';
import '../src/i18n';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const { initialized, hasHydrated } = useAuthStore();

    useEffect(() => {
        if (initialized && hasHydrated) {
            SplashScreen.hideAsync();
        }
    }, [initialized, hasHydrated]);

    return (
        <AppProviders>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="add-session" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
        </AppProviders>
    );
}
