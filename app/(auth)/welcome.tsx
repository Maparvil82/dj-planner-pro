import {
    View,
    Text,
    ScrollView,
    ImageBackground,
    useWindowDimensions,
    TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Redirect } from 'expo-router';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';

import { AUTH_IMAGE, AUTH_COLORS, AuthBrand } from '../../src/components/auth/AuthUI';

export default function WelcomeScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { height, width } = useWindowDimensions();
    const session = useAuthStore((state) => state.session);
    const compact = height < 700;
    if (session) return <Redirect href="/(tabs)/home" />;
    return (
        <View style={{ flex: 1, backgroundColor: AUTH_COLORS.bg }}>
            <StatusBar style="light" />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    flexGrow: 1,
                    paddingTop: insets.top + 12,
                    paddingBottom: Math.max(insets.bottom, 12),
                    paddingHorizontal: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <ImageBackground
                    source={AUTH_IMAGE}
                    resizeMode="cover"
                    imageStyle={{ borderRadius: 28 }}
                    style={{
                        width: '100%',
                        maxWidth: 480,
                        height: Math.min(width >= 700 ? 900 : Infinity, Math.max(500, height - insets.top - Math.max(insets.bottom, 12) - 12)),
                        borderRadius: 28,
                        overflow: 'hidden',
                        backgroundColor: AUTH_COLORS.card,
                        justifyContent: 'space-between',
                    }}
                >
                    <LinearGradient
                        pointerEvents="none"
                        colors={['rgba(0,0,0,0.3)', 'transparent']}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130 }}
                    />
                    <View style={{ margin: 24 }}>
                        <AuthBrand light />
                    </View>
                    <View style={{ minHeight: compact ? 150 : 240, flex: 1 }} />
                    <LinearGradient
                        colors={['rgba(35,35,35,0.88)', 'rgba(43,48,32,0.97)', '#232323']}
                        style={{ borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: width < 360 ? 20 : 24, paddingTop: 28, gap: 14 }}
                    >
                        <Text
                            accessibilityRole="header"
                            style={{
                                color: AUTH_COLORS.fg,
                                fontSize: compact ? 28 : 32,
                                lineHeight: compact ? 32 : 36,
                                fontWeight: '500',
                                letterSpacing: -0.8,
                                maxWidth: 330,
                            }}
                        >
                            {t('authExperience.welcomeTitle')}
                        </Text>
                        <Text style={{ color: AUTH_COLORS.muted, fontSize: 13, lineHeight: 20, maxWidth: 350 }}>
                            {t('authExperience.welcomeHint')}
                        </Text>
                        <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => {
                                useAuthStore.getState().setHasSeenOnboarding(true);
                                router.replace('/(auth)/login');
                            }}
                            style={{
                                backgroundColor: AUTH_COLORS.accent,
                                borderRadius: 16,
                                minHeight: 52,
                                padding: 16,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: 10,
                            }}
                        >
                            <Text style={{ color: AUTH_COLORS.card, fontSize: 15, fontWeight: '600' }}>
                                {t('authExperience.next')}
                            </Text>
                        </TouchableOpacity>
                    </LinearGradient>
                </ImageBackground>
            </ScrollView>
        </View>
    );
}
