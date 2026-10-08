import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
    const { session, initialized, hasHydrated } = useAuthStore();

    if (!initialized || !hasHydrated) {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#0d1220',
                }}
            >
                <ActivityIndicator size="large" color="#bdb0f5" />
            </View>
        );
    }

    if (!session) {
        return <Redirect href="/(auth)/welcome" />;
    }

    return <Redirect href="/(tabs)/home" />;
}
