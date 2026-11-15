import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';
import { View, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { doorAccess } from '../src/services/doorAccess';
import { AppLogo } from '../src/components/ui/AppLogo';

export default function Index() {
    const { session, initialized, hasHydrated } = useAuthStore();
    const [door, setDoor] = useState<boolean | null>(null);
    useEffect(() => {
        let active = true;
        if (initialized && hasHydrated && !session) {
            void doorAccess.active().then(credential => {if (active) setDoor(!!credential);});
        }
        return () => {active = false;};
    }, [initialized, hasHydrated, session?.user.id]);

    if (!initialized || !hasHydrated || (!session && door === null)) {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#171717',
                    gap: 24,
                }}
            >
                <AppLogo size={112} />
                <ActivityIndicator size="large" color="#00c8ee" />
            </View>
        );
    }

    if (!session) {
        if (door) return <Redirect href="/door" />;
        return <Redirect href="/(auth)/welcome" />;
    }

    return <Redirect href="/(tabs)/home" />;
}
