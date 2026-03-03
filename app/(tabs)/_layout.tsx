import { Tabs as ExpoTabs, useRouter } from 'expo-router';
import { Home, Calendar, MapPin, LayoutDashboard, PlusCircle } from 'lucide-react-native';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Redirect } from 'expo-router';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { useContext } from 'react';

export default function TabLayout() {
    const { t } = useTranslation();
    const router = useRouter();
    const session = useAuthStore((state) => state.session);
    const themeCtx = useContext(ThemeContext);

    if (!session) {
        return <Redirect href="/(auth)/login" />;
    }

    const isDark = themeCtx?.activeTheme === 'dark';

    return (
        <ExpoTabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: isDark ? '#60A5FA' : '#2563EB', // blue-400 : blue-600
                tabBarInactiveTintColor: isDark ? '#6B7280' : '#9CA3AF', // gray-500 : gray-400
                tabBarStyle: {
                    backgroundColor: isDark ? '#111827' : '#ffffff', // gray-900 : white
                    borderTopWidth: 1,
                    borderTopColor: isDark ? '#1F2937' : '#F3F4F6', // gray-800 : gray-100
                    elevation: 0,
                },
            }}
        >
            <ExpoTabs.Screen
                name="dashboard"
                options={{
                    title: t('dashboard'),
                    // @ts-ignore
                    tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
                }}
            />
            <ExpoTabs.Screen
                name="home"
                options={{
                    title: t('home'),
                    // @ts-ignore
                    tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
                }}
            />
            <ExpoTabs.Screen
                name="add"
                options={{
                    title: t('add_session'),
                    // @ts-ignore
                    tabBarIcon: ({ color, size }) => <PlusCircle color={color} size={size * 1.3} />,
                }}
                listeners={{
                    tabPress: (e) => {
                        e.preventDefault();
                        router.push('/add-session');
                    },
                }}
            />
            <ExpoTabs.Screen
                name="history"
                options={{
                    title: t('history'),
                    // @ts-ignore
                    tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
                }}
            />
            <ExpoTabs.Screen
                name="venues"
                options={{
                    title: t('venues_title'),
                    // @ts-ignore
                    tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />,
                }}
            />
        </ExpoTabs>
    );
}
