import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';

export default function Index() {
    const session = useAuthStore((state) => state.session);

    // For now, if no session we go to auth layout, else to tabs
    if (!session) {
        return <Redirect href="/(auth)/login" />;
    }

    return <Redirect href="/(tabs)/home" />;
}
