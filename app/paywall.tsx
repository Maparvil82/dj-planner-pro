import React, { useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Alert,
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
    Zap,
    ShieldCheck,
    BarChart3,
    FileText
} from 'lucide-react-native';

export default function PaywallScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { isPro, setPro } = useSubscriptionStore();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';

    const handleSubscribe = (plan: 'monthly' | 'yearly') => {
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
        { key: 'unlimited_sessions', icon: Zap, free: false, pro: true },
        { key: 'advanced_analytics', icon: BarChart3, free: false, pro: true },
        { key: 'priority_docs', icon: FileText, free: false, pro: true },
        { key: 'cloud_backup', icon: ShieldCheck, free: true, pro: true },
    ];

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
            {/* HEADER */}
            <View className="px-6 py-4 flex-row items-center">
                <TouchableOpacity
                    onPress={() => router.replace('/')}
                    className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-900 items-center justify-center mr-4"
                >
                    <ChevronLeft size={24} color={isDark ? '#FFFFFF' : '#111827'} />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-gray-900 dark:text-white">
                    {t('paywall_title')}
                </Text>
            </View>

            <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                <View className="items-center mt-6 mb-10">
                    <View className="w-20 h-20 rounded-3xl bg-blue-600 items-center justify-center mb-6 shadow-xl shadow-blue-500/40">
                        <Zap size={40} color="#FFFFFF" fill="#FFFFFF" />
                    </View>
                    <Text className="text-3xl font-black text-gray-900 dark:text-white text-center">
                        {t('paywall_main_title')}
                    </Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-center mt-3 text-lg">
                        {t('paywall_subtitle')}
                    </Text>
                </View>

                {/* COMPARISON TABLE */}
                <View className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-6 mb-10 border border-gray-100 dark:border-gray-800">
                    <View className="flex-row mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                        <View className="flex-1" />
                        <Text className="w-16 text-center font-bold text-gray-400 uppercase text-[10px] tracking-widest">Free</Text>
                        <Text className="w-16 text-center font-bold text-blue-600 uppercase text-[10px] tracking-widest">Pro</Text>
                    </View>

                    {features.map((feature, index) => (
                        <View key={index} className="flex-row items-center py-4">
                            <View className="flex-1 flex-row items-center">
                                <feature.icon size={18} color={isDark ? '#9CA3AF' : '#6B7280'} className="mr-3" />
                                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t(feature.key) || feature.key.replace(/_/g, ' ')}
                                </Text>
                            </View>
                            <View className="w-16 items-center">
                                {feature.free ? <Check size={20} color="#10B981" /> : <X size={20} color="#EF4444" opacity={0.3} />}
                            </View>
                            <View className="w-16 items-center">
                                <Check size={24} color="#2563EB" strokeWidth={3} />
                            </View>
                        </View>
                    ))}
                </View>

                {/* PRICING PLANS */}
                <View className="gap-4">
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => handleSubscribe('yearly')}
                        className="bg-blue-600 p-6 rounded-3xl flex-row items-center justify-between shadow-xl shadow-blue-500/20"
                    >
                        <View>
                            <Text className="text-white font-bold text-lg">{t('plan_yearly')}</Text>
                            <Text className="text-blue-100 text-xs mt-1">{t('plan_yearly_desc')}</Text>
                        </View>
                        <View className="bg-white/20 px-3 py-1 rounded-full">
                            <Text className="text-white font-black text-xs uppercase">{t('best_value')}</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => handleSubscribe('monthly')}
                        className="bg-white dark:bg-gray-900 border-2 border-blue-600 p-6 rounded-3xl flex-row items-center justify-between"
                    >
                        <View>
                            <Text className="text-gray-900 dark:text-white font-bold text-lg">{t('plan_monthly')}</Text>
                            <Text className="text-gray-500 dark:text-gray-400 text-xs mt-1">{t('plan_monthly_desc')}</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* COMPLIANCE FOOTER */}
                <View className="mt-10 mb-10 items-center">
                    <TouchableOpacity onPress={handleRestore} className="mb-6">
                        <Text className="text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest text-[10px]">
                            {t('restore_purchases')}
                        </Text>
                    </TouchableOpacity>

                    <View className="flex-row items-center gap-4">
                        <TouchableOpacity onPress={() => Linking.openURL('https://www.notion.so/Terms-of-Use-Dj-Planner-Pro-31df3ade92a98085a4a0cebf75fed619')}>
                            <Text className="text-gray-400 dark:text-gray-500 text-[10px] underline">{t('terms_of_use')}</Text>
                        </TouchableOpacity>
                        <View className="w-1 h-1 rounded-full bg-gray-300" />
                        <TouchableOpacity onPress={() => Linking.openURL('https://www.notion.so/Privacy-Policy-Dj-Planner-Pro-31df3ade92a9808588b2e54ac612c8b5')}>
                            <Text className="text-gray-400 dark:text-gray-500 text-[10px] underline">{t('privacy_policy')}</Text>
                        </TouchableOpacity>
                    </View>

                    <Text className="text-center text-gray-400 dark:text-gray-600 text-[9px] mt-6 leading-4">
                        {t('subscription_notice')}
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
