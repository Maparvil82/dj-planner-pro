import { View, ActivityIndicator } from 'react-native';
import { Tabs as ExpoTabs } from 'expo-router';
import { Home, Calendar, MapPin, LayoutDashboard } from 'lucide-react-native';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Redirect } from 'expo-router';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { useContext } from 'react';
import { Avatar } from '../../src/components/ui/Avatar';

export default function TabLayout() {
    const { t } = useTranslation();
    const { session, profile, initialized } = useAuthStore();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';

    if (!initialized) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#111827' : '#FFFFFF' }}>
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    return (
        <ExpoTabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: isDark ? '#60A5FA' : '#2563EB', // blue-400 : blue-600
                tabBarInactiveTintColor: isDark ? '#6B7280' : '#9CA3AF', // gray-500 : gray-400
                tabBarStyle: {
                    backgroundColor: isDark ? '#111827' : '#fbfbfbff', // gray-900 : white
                    borderTopWidth: 1,
                    borderTopColor: isDark ? '#1F2937' : '#F3F4F6', // gray-800 : gray-100
                    elevation: 0,
                    paddingBottom: 5,
                    height: 80,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '600',
                    marginBottom: 5,
                },
            }}
        >
            <ExpoTabs.Screen
                name="home"
                options={{
                    title: t('home'),
                    // @ts-ignore
                    tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
                }}
            />
            <ExpoTabs.Screen
                name="dashboard"
                options={{
                    title: t('dashboard'),
                    // @ts-ignore
                    tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
                }}
            />

            <ExpoTabs.Screen
                name="history"
                options={{
                    href: null,
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
            <ExpoTabs.Screen
                name="profile"
                options={{
                    title: t('tab_you'),
                    // @ts-ignore
                    tabBarIcon: ({ color, size }) => (
                        <View className={`p-0.5 rounded-full border-2 ${color === (isDark ? '#60A5FA' : '#2563EB') ? 'border-blue-500' : 'border-transparent'}`}>
                            <Avatar
                                url={profile?.avatar_url}
                                name={session?.user?.email}
                                size="sm"
                            />
                        </View>
                    ),
                }}
            />
        </ExpoTabs>
    );
}
