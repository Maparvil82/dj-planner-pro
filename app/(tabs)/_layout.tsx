import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { StyleSheet } from 'react-native';
import { useDarkPalette } from '../../src/contexts/ThemeContext';
import { AddSessionButton } from '../../src/components/ui/AddSessionButton';
import {
    AccountDrawerProvider,
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
    Image as PosterIcon,
} from 'lucide-react-native';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Redirect } from 'expo-router';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { useContext } from 'react';
import { FEATURES } from '../../src/config/features';

// In SDK 58, href:null also redirects away from the route. Secondary pages
// must stay registered; hide only their bottom-bar button and its space.
const secondaryTabOptions = {
    tabBarButton: () => null,
    tabBarItemStyle: { display: 'none' as const },
};

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
    const darkPalette = useDarkPalette();
    const { t } = useTranslation();
    const { width } = useWindowDimensions();
    const { session, initialized } = useAuthStore();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';
    const nativeGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

    if (!initialized) {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDark ? darkPalette.background : '#FFFFFF',
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
                tabBarActiveTintColor: isDark ? darkPalette.primary : '#6554df',
                tabBarInactiveTintColor: isDark ? darkPalette.muted : '#9CA3AF', // gray-500 : gray-400
                tabBarStyle: {
                    backgroundColor: 'transparent',
                    borderTopWidth: 0,
                    elevation: 0,
                    paddingTop: 4,
                    paddingBottom: 4,
                    height: 60,
                },
                tabBarBackground: () => nativeGlass ? (
                    <GlassView glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
                ) : (
                    <BlurView intensity={85} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(24,24,38,0.48)' : 'rgba(255,255,255,0.45)' }]} />
                    </BlurView>
                ),
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
                                paddingBottom: 0,
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

            <ExpoTabs.Screen name="calendar" options={secondaryTabOptions} />
            <ExpoTabs.Screen
                name="history"
                options={secondaryTabOptions}
            />
            <ExpoTabs.Screen
                name="venues"
                options={{
                    ...secondaryTabOptions,
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
                name="carteles"
                options={{
                    title: t('accountMenu.posters'),
                    tabBarIcon: ({ color, size }) => <PosterIcon color={color} size={size} />,
                }}
            />
            <ExpoTabs.Screen name="account" options={secondaryTabOptions} />
        </ExpoTabs>
    );
}
