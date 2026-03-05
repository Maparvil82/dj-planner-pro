import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import '../global.css';
import '../src/i18n'; // Initializing i18n
import { AppProviders } from '../src/providers/AppProviders';

export default function RootLayout() {
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
