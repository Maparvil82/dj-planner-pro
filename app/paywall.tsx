import React, { useContext, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Image,
    Dimensions,
} from 'react-native';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from '../src/i18n/useTranslation';
import { ThemeContext } from '../src/contexts/ThemeContext';
import { useSubscriptionStore } from '../src/store/useSubscriptionStore';
import {
    Check,
    X,
    ChevronLeft,
    Sparkles,
    ShieldCheck,
    BarChart3,
    FileText,
    Quote,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function PaywallScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { setPro } = useSubscriptionStore();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';
    const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');

    const handleSubscribe = () => {
        // Mock success
        Alert.alert(
            t('subscription_success_title'),
            t('subscription_success_msg'),
            [{
                text: "OK", onPress: () => {
                    setPro(true);
                    router.replace('/');
                }
            }]
        );
    };

    const handleRestore = () => {
        Alert.alert(t('restore_purchases'), t('restore_no_purchases'));
    };

    const features = [
        t('unlimited_sessions'),
        t('advanced_analytics'),
        t('priority_docs'),
    ];

    return (
        <View className="flex-1 bg-black">
            {/* HEADER IMAGE SECTION */}
            <View className="relative w-full h-[45%]">
                <Image
                    source={require('../assets/paywall_header.png')}
                    style={{ width: '100%', height: '100%', position: 'absolute' }}
                    resizeMode="cover"
                />
                <LinearGradient
                    colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.8)', 'black']}
                    style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                />
                <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
                    <View className="px-6 py-4 flex-row items-center justify-between">
                        <TouchableOpacity
                            onPress={() => router.replace('/')}
                            className="w-10 h-10 rounded-full bg-white/10 items-center justify-center"
                        >
                            <X size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>

            {/* CONTENT SECTION */}
            <View className="flex-1 px-6 justify-between pb-10">
                <View>
                    <View className="-mt-16">
                        {/* PRICING PLANS SIDE-BY-SIDE */}
                        <View className="flex-row mt-4 mb-2 gap-4">
                            {/* MONTHLY PLAN CARD */}
                            <TouchableOpacity
                                onPress={() => setSelectedPlan('monthly')}
                                activeOpacity={0.8}
                                className={`flex-1 p-5 rounded-[22px] border-2 flex-row items-center justify-between ${selectedPlan === 'monthly' ? 'border-[#FFC2AD] bg-[#1C1C1E]' : 'border-white/10 bg-[#1C1C1E]'
                                    }`}
                                style={{ minHeight: 120 }}
                            >
                                <View className="flex-1">
                                    <Text className="text-white font-bold text-lg leading-tight">{t('plan_monthly')}</Text>
                                    <Text className="text-white/60 text-sm mt-1">4,99 € / mes</Text>
                                    <Text className="text-[#4FD1C5] text-xs font-bold mt-2">{t('plan_monthly_trial')}</Text>
                                </View>
                                <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ml-2 ${selectedPlan === 'monthly' ? 'border-[#FFC2AD]' : 'border-white/30'
                                    }`}>
                                    {selectedPlan === 'monthly' && <View className="w-3 h-3 rounded-full bg-[#FFC2AD]" />}
                                </View>
                            </TouchableOpacity>

                            {/* YEARLY PLAN CARD */}
                            <TouchableOpacity
                                onPress={() => setSelectedPlan('yearly')}
                                activeOpacity={0.8}
                                className={`flex-1 p-5 rounded-[22px] border-2 flex-row items-center justify-between relative ${selectedPlan === 'yearly' ? 'border-[#FFC2AD] bg-[#1C1C1E]' : 'border-white/10 bg-[#1C1C1E]'
                                    }`}
                                style={{ minHeight: 120 }}
                            >
                                <View className="flex-1">
                                    <Text className="text-white font-bold text-lg leading-tight">{t('plan_yearly')}</Text>
                                    <Text className="text-white/60 text-sm mt-1">14,99 € / año</Text>
                                    <Text className="text-[#4FD1C5] text-xs font-bold mt-2">{t('plan_yearly_trial')}</Text>
                                </View>
                                <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ml-2 ${selectedPlan === 'yearly' ? 'border-[#FFC2AD]' : 'border-white/30'
                                    }`}>
                                    {selectedPlan === 'yearly' && <View className="w-3 h-3 rounded-full bg-[#FFC2AD]" />}
                                </View>

                                {/* SAVE BADGE */}
                                <View className="absolute -top-3 right-4 bg-white px-2 py-0.5 rounded-full shadow-lg">
                                    <Text className="text-black font-black text-[9px] uppercase">
                                        -{t('save_badge', { percent: '70' }).match(/\d+/)?.[0]}%
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* MAIN CTA BUTTON */}
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={handleSubscribe}
                            className="bg-[#FFC2AD] py-6 rounded-[22px] items-center mt-8 shadow-2xl shadow-[#FFC2AD]/20"
                        >
                            <Text className="text-black font-black text-xl uppercase tracking-widest">
                                {selectedPlan === 'monthly' ? t('trial_button_7') : t('trial_button_14')}
                            </Text>
                        </TouchableOpacity>

                        {/* COMPLIANCE INFO */}
                        <Text className="text-center text-white/40 text-[11px] mt-4 leading-5">
                            {selectedPlan === 'monthly'
                                ? "4,99 €/mes tras la primera semana."
                                : "14,99 €/año tras los primeros 14 días."}
                        </Text>
                    </View>
                </View>

                {/* FOOTER */}
                <View className="items-center pb-8">
                    <View className="flex-row items-center gap-2 px-4">
                        <TouchableOpacity onPress={() => Linking.openURL('https://www.notion.so/Terms-of-Use-Dj-Planner-Pro-31df3ade92a98085a4a0cebf75fed619')}>
                            <Text className="text-white/40 text-[11px] font-medium">{t('terms_of_use')}</Text>
                        </TouchableOpacity>
                        <View className="w-1 h-1 rounded-full bg-white/10" />
                        <TouchableOpacity onPress={() => Linking.openURL('https://www.notion.so/Privacy-Policy-Dj-Planner-Pro-31df3ade92a9808588b2e54ac612c8b5')}>
                            <Text className="text-white/40 text-[11px] font-medium">{t('privacy_policy')}</Text>
                        </TouchableOpacity>
                        <View className="w-1 h-1 rounded-full bg-white/10" />
                        <TouchableOpacity onPress={handleRestore}>
                            <Text className="text-white/40 text-[11px] font-medium">{t('restore_purchases')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}
