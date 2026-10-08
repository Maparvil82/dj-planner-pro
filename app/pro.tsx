import { FEATURES } from '../src/config/features';
import {
    ImageBackground,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../src/store/useAuthStore';
import { useSessionUsage } from '../src/hooks/useSessionUsage';
import { useTranslation } from '../src/i18n/useTranslation';
import {
    CommunityButton,
    useCommunityColors,
} from '../src/components/community/CommunityUI';

export default function ProScreen() {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const router = useRouter();
    const session = useAuthStore((state) => state.session);
    const usage = useSessionUsage();
    if (!session) return <Redirect href="/(auth)/login" />;
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
            <View
                style={{
                    paddingHorizontal: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    height: 56,
                    gap: 12,
                }}
            >
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('back')}
                    onPress={() =>
                        router.canGoBack()
                            ? router.back()
                            : router.replace('/(tabs)/home')
                    }
                    style={{
                        width: 44,
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <ArrowLeft size={22} color={c.fg} />
                </Pressable>
                <Text style={{ fontSize: 15, fontWeight: '800', color: c.fg }}>
                    DJ Planner Pro
                </Text>
            </View>
            <ScrollView
                contentContainerStyle={{
                    width: '100%',
                    maxWidth: 680,
                    alignSelf: 'center',
                    padding: 20,
                    paddingBottom: 36,
                    gap: 24,
                }}
            >
                <View
                    style={{
                        borderRadius: 28,
                        overflow: 'hidden',
                        backgroundColor: '#302578',
                    }}
                >
                    <ImageBackground
                        source={require('../assets/auth/welcome-dj-booth.jpg')}
                        resizeMode="cover"
                        style={{ minHeight: 300 }}
                    >
                        <LinearGradient
                            colors={['#23175833', '#33277ecc', '#302578']}
                            style={{
                                flex: 1,
                                justifyContent: 'flex-end',
                                padding: 24,
                                paddingTop: 110,
                                gap: 12,
                            }}
                        >
                            <Text
                                style={{
                                    color: '#d9d1ff',
                                    fontSize: 11,
                                    letterSpacing: 2,
                                    fontWeight: '800',
                                }}
                            >
                                DJ PLANNER PRO
                            </Text>
                            <Text
                                style={{
                                    color: '#fff',
                                    fontSize: 34,
                                    lineHeight: 39,
                                    letterSpacing: -1,
                                    fontWeight: '900',
                                }}
                            >
                                {t('proPage.title')}
                            </Text>
                            <Text
                                style={{
                                    color: '#eee9ff',
                                    fontSize: 15,
                                    lineHeight: 23,
                                }}
                            >
                                {t('proPage.intro')}
                            </Text>
                        </LinearGradient>
                    </ImageBackground>
                </View>
                <View style={{ gap: 14 }}>
                    <Text
                        style={{ fontSize: 22, fontWeight: '800', color: c.fg }}
                    >
                        {t('proPage.benefits')}
                    </Text>
                    <View
                        style={{
                            borderRadius: 24,
                            padding: 22,
                            backgroundColor: c.card,
                            gap: 12,
                            borderWidth: 1,
                            borderColor: c.border,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 36,
                                fontWeight: '800',
                                color: c.accent,
                            }}
                        >
                            ∞
                        </Text>
                        <Text
                            style={{
                                color: c.fg,
                                fontSize: 19,
                                fontWeight: '800',
                            }}
                        >
                            {t('proPage.unlimited')}
                        </Text>
                        <Text
                            style={{
                                color: c.muted,
                                fontSize: 14,
                                lineHeight: 22,
                            }}
                        >
                            {t('proPage.unlimitedHint')}
                        </Text>
                    </View>
                    {(FEATURES.feeAgreements ||
                        FEATURES.conditionalSessions) && (
                        <View
                            style={{
                                backgroundColor: c.card,
                                padding: 22,
                                borderRadius: 24,
                                gap: 12,
                                borderWidth: 1,
                                borderColor: c.border,
                            }}
                        >
                            <Text
                                style={{
                                    color: c.fg,
                                    fontWeight: '800',
                                    fontSize: 19,
                                }}
                            >
                                {t('conditional.title')} · PRO
                            </Text>
                            <Text style={{ color: c.muted, lineHeight: 22 }}>
                                {t('conditional.proBenefit')}
                            </Text>
                        </View>
                    )}
                    {FEATURES.bookings && (
                        <View
                            style={{
                                borderRadius: 24,
                                padding: 22,
                                backgroundColor: c.card,
                                gap: 12,
                                borderWidth: 1,
                                borderColor: c.border,
                            }}
                        >
                            <Text
                                style={{
                                    color: c.accent,
                                    fontSize: 11,
                                    fontWeight: '800',
                                    letterSpacing: 1,
                                }}
                            >
                                {t('proPage.soon')}
                            </Text>
                            <Text
                                style={{
                                    color: c.fg,
                                    fontSize: 19,
                                    fontWeight: '800',
                                }}
                            >
                                {t('bookings.title')}
                            </Text>
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 14,
                                    lineHeight: 22,
                                }}
                            >
                                {t('proPage.bookingsHint')}
                            </Text>
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 12,
                                    lineHeight: 19,
                                }}
                            >
                                {t('proPage.bookingsPending')}
                            </Text>
                        </View>
                    )}
                </View>
                <View
                    style={{
                        padding: 20,
                        borderRadius: 22,
                        backgroundColor: c.tint,
                        gap: 8,
                    }}
                >
                    <Text
                        style={{ color: c.fg, fontSize: 16, fontWeight: '800' }}
                    >
                        {t('proPage.freeTitle')}
                    </Text>
                    <Text
                        style={{ color: c.muted, fontSize: 13, lineHeight: 21 }}
                    >
                        {t('proPage.freeHint')}
                    </Text>
                </View>
                {usage.isError && (
                    <Text style={{ color: c.muted }}>
                        {t('billing.usageError')}
                    </Text>
                )}
                <CommunityButton
                    label={t(
                        usage.data?.isPro ? 'proPage.active' : 'proPage.plans',
                    )}
                    disabled={usage.isPending}
                    onPress={() =>
                        usage.data?.isPro
                            ? router.push('/profile?section=plan')
                            : router.push('/paywall')
                    }
                />
                <Text
                    style={{
                        color: c.muted,
                        fontSize: 12,
                        lineHeight: 19,
                        textAlign: 'center',
                    }}
                >
                    {t('proPage.purchaseHint')}
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}
