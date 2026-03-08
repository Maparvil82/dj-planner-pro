import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
    const { session, initialized, hasSeenOnboarding } = useAuthStore();

    if (!initialized) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    // For now, if no session we go to auth layout, else to tabs
    if (!hasSeenOnboarding) {
        return <Redirect href="/(auth)/onboarding" />;
    }

    if (!session) {
        return <Redirect href="/(auth)/login" />;
    }

    return <Redirect href="/(tabs)/home" />;
}
