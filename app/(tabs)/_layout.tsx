import { AddSessionButton } from '../../src/components/ui/AddSessionButton';
import {
    AccountDrawerProvider,
    AccountAvatarButton,
    useOpenAccountMenu,
} from '../../src/components/navigation/AccountDrawer';
import { TabBarVisibilityProvider } from '../../src/contexts/TabBarVisibilityContext';
import { ScrollTabBar } from '../../src/components/ui/ScrollTabBar';
import { View, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Tabs as ExpoTabs } from 'expo-router';
import {
    CalendarDays,
    MapPin,
    LayoutDashboard,
    Users,
} from 'lucide-react-native';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Redirect } from 'expo-router';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { useContext } from 'react';
import { FEATURES } from '../../src/config/features';

export default function TabLayout() {
    return (
        <TabBarVisibilityProvider>
            <AccountDrawerProvider>
                <TabLayoutContent />
            </AccountDrawerProvider>
        </TabBarVisibilityProvider>
    );
}

function TabLayoutContent() {
    const { t } = useTranslation();
    const openAccountMenu = useOpenAccountMenu();
    const { width } = useWindowDimensions();
    const { session, initialized } = useAuthStore();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';

    if (!initialized) {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDark ? '#111827' : '#FFFFFF',
                }}
            >
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    if (!session) {
        return <Redirect href="/(auth)/login" />;
    }

    return (
        <ExpoTabs
            tabBar={(props) => <ScrollTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: isDark ? '#bdb0f5' : '#6554df',
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
                    fontSize: width < 360 ? 9 : 10,
                    fontWeight: '600',
                    marginBottom: 5,
                },
            }}
        >
            <ExpoTabs.Screen
                name="home"
                options={{
                    title: t('community.sessions'),
                    // @ts-ignore
                    tabBarIcon: ({ color, size }) => (
                        <CalendarDays color={color} size={size} />
                    ),
                }}
            />
            <ExpoTabs.Screen
                name="dashboard"
                options={{
                    title: t('dashboard'),
                    // @ts-ignore
                    tabBarIcon: ({ color, size }) => (
                        <LayoutDashboard color={color} size={size} />
                    ),
                }}
            />

            <ExpoTabs.Screen
                name="create-session"
                options={{
                    title: t('createMenu.title'),
                    tabBarShowLabel: false,
                    tabBarButton: () => (
                        <View
                            style={{
                                flex: 1,
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingBottom: 16,
                            }}
                        >
                            <AddSessionButton />
                        </View>
                    ),
                }}
            />

            <ExpoTabs.Screen
                name="vault"
                options={{
                    href: FEATURES.documents ? undefined : null,
                    title: t('vault_title') || t('vault') || 'Documentos',
                    // @ts-ignore
                    tabBarIcon: ({ color, size }) => {
                        const { FileText } = require('lucide-react-native');
                        return <FileText color={color} size={size} />;
                    },
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
                    href: null,
                    title: t('venues_title'),
                    // @ts-ignore
                    tabBarIcon: ({ color, size }) => (
                        <MapPin color={color} size={size} />
                    ),
                }}
            />
            <ExpoTabs.Screen
                name="community"
                options={{
                    title: t('community.title'),
                    tabBarIcon: ({ color, size }) => (
                        <Users color={color} size={size} />
                    ),
                }}
            />
            <ExpoTabs.Screen
                name="account"
                listeners={{
                    tabPress: (event) => {
                        event.preventDefault();
                        openAccountMenu();
                    },
                }}
                options={{
                    title: t('tab_you'),
                    tabBarAccessibilityLabel: t('accountMenu.open'),
                    tabBarIcon: () => <AccountAvatarButton tab />,
                }}
            />
        </ExpoTabs>
    );
}
