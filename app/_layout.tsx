import { AccountDeletionGate } from '../src/components/profile/AccountDeletionGate';
import { NotificationSync } from '../src/components/profile/NotificationSync';
import { StorageMaintenance } from '../src/components/profile/StorageMaintenance';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../src/store/useAuthStore';
import { AppProviders } from '../src/providers/AppProviders';
import { useTheme } from '../src/contexts/ThemeContext';
import '../global.css';
import '../src/i18n';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function AppReady() {
    const { initialized, hasHydrated } = useAuthStore();
    const { isReady: themeReady } = useTheme();

    useEffect(() => {
        if (initialized && hasHydrated && themeReady) {
            void SplashScreen.hideAsync();
        }
    }, [initialized, hasHydrated, themeReady]);
    return null;
}

export default function RootLayout() {
    const authReady = useAuthStore((state) => state.initialized && state.hasHydrated);
    return (
        <AppProviders>
            <AppReady />
            {/* Restoring a saved session must finish before route guards run. */}
            {authReady && <>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                    name="edit-dj-profile"
                    options={{
                        presentation: 'transparentModal',
                        animation: 'slide_from_bottom',
                        gestureEnabled: false,
                        contentStyle: { backgroundColor: 'transparent' },
                    }}
                />
                <Stack.Screen
                    name="add-mix"
                    options={{
                        presentation: 'transparentModal',
                        animation: 'slide_from_bottom',
                        gestureEnabled: false,
                        contentStyle: { backgroundColor: 'transparent' },
                    }}
                />
                <Stack.Screen
                    name="delete-account"
                    options={{ gestureEnabled: false }}
                />
                <Stack.Screen
                    name="add-session"
                    options={{ headerShown: false }}
                />
            </Stack>
            <AccountDeletionGate />
            <StorageMaintenance />
            <NotificationSync />
            </>}
            <StatusBar style="auto" />
        </AppProviders>
    );
}
