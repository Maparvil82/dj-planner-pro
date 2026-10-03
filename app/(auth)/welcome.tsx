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
import { AuthBrand, AUTH_IMAGE } from '../../src/components/auth/AuthUI';
export default function WelcomeScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { height, width } = useWindowDimensions();
    const session = useAuthStore((state) => state.session);
    if (session) return <Redirect href="/(tabs)/home" />;
    return (
        <View
            style={{ flex: 1, backgroundColor: '#08070f', overflow: 'hidden' }}
        >
            <StatusBar style="light" />
            <ImageBackground
                source={AUTH_IMAGE}
                resizeMode="cover"
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    height: width >= 900 ? height : height * 0.75,
                    width: '100%',
                    overflow: 'hidden',
                    left: 0,
                }}
            />
            <LinearGradient
                pointerEvents="none"
                colors={[
                    'rgba(8,7,15,0.25)',
                    'rgba(8,7,15,0.02)',
                    'rgba(8,7,15,0.85)',
                    '#08070f',
                ]}
                locations={[0, 0.3, 0.7, 1]}
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                }}
            />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    minHeight: height,
                    paddingTop: insets.top + 28,
                    paddingBottom: Math.max(insets.bottom, 28),
                    paddingHorizontal: width >= 900 ? 64 : 28,
                    width: '100%',
                    maxWidth: 1120,
                    alignSelf: 'center',
                }}
            >
                <AuthBrand light />
                <View style={{ flex: 1, minHeight: height * 0.34 }} />
                <View
                    style={{
                        gap: 18,
                        maxWidth: 480,
                        width: '100%',
                        minWidth: 0,
                    }}
                >
                    <Text
                        style={{
                            color: '#c8b9ff',
                            fontSize: 13,
                            fontWeight: '700',
                            letterSpacing: 0.4,
                        }}
                    >
                        {t('authExperience.welcome')}
                    </Text>
                    <Text
                        accessibilityRole="header"
                        style={{
                            color: '#fff',
                            fontSize: width < 360 ? 38 : 44,
                            lineHeight: width < 360 ? 43 : 49,
                            fontWeight: '900',
                            letterSpacing: -1.7,
                        }}
                    >
                        {t('authExperience.welcomeTitle')}
                    </Text>
                    <Text
                        style={{
                            color: '#c4bfd0',
                            fontSize: 15,
                            lineHeight: 24,
                        }}
                    >
                        {t('authExperience.welcomeHint')}
                    </Text>
                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => {
                            useAuthStore.getState().setHasSeenOnboarding(true);
                            router.replace('/(auth)/login');
                        }}
                        style={{
                            backgroundColor: '#6554df',
                            borderRadius: 18,
                            minHeight: 56,
                            padding: 17,
                            alignItems: 'center',
                            marginTop: 10,
                        }}
                    >
                        <Text
                            style={{
                                color: '#fff',
                                fontSize: 16,
                                fontWeight: '800',
                            }}
                        >
                            {t('authExperience.next')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
