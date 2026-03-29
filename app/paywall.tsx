import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from '../src/i18n/useTranslation';
import { useSubscription } from '../src/hooks/useSubscription';
import {
    X,
    ArrowRight,
    Check,
} from 'lucide-react-native';

export default function PaywallScreen() {
    const { t } = useTranslation();
    const router = useRouter();

    const {
        purchaseMonthly,
        purchaseAnnual,
        restorePurchases,
        isLoading,
        monthlyPackage,
        annualPackage
    } = useSubscription();

    const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');

    const handleSubscribe = async () => {
        let success = false;
        if (selectedPlan === 'monthly') {
            success = await purchaseMonthly();
        } else {
            success = await purchaseAnnual();
        }

        if (success) {
            router.replace('/');
        }
    };

    const handleRestore = async () => {
        const success = await restorePurchases();
        if (success) {
            Alert.alert(
                t('restore_purchases_success_title', { defaultValue: 'Restored' }),
                t('restore_purchases_success_msg', { defaultValue: 'Your purchases have been restored successfully.' })
            );
            router.replace('/');
        } else {
            Alert.alert(t('restore_purchases'), t('restore_no_purchases'));
        }
    };

    // Use dynamic prices from RevenueCat if available, fallback to translations
    const monthlyPriceString = monthlyPackage?.product.priceString || t('plan_monthly_desc');
    const annualPriceString = annualPackage?.product.priceString || t('plan_yearly_desc');

    return (
        <View className="flex-1 bg-white">
            {/* HEADER SECTION */}
            <SafeAreaView edges={['top']}>
                <View className="px-6 py-4 flex-row items-center justify-between">
                    <TouchableOpacity
                        onPress={() => router.replace('/')}
                        className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
                    >
                        <X size={24} color="#000000" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* CONTENT SECTION */}
            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 }}
            >
                <View className="flex-1 justify-between">
                    <View className="mt-2">
                        <Text className="text-black font-semibold text-3xl mb-4 tracking-tight text-left">
                            {t('choose_plan').replace(/\|/g, '')}
                        </Text>
                        
                        <Text className="text-gray-600 text-sm mb-6 leading-5">
                            {t('subscription_explanation')}
                        </Text>

                        {/* PRO BENEFITS */}
                        <View className="mb-6 bg-gray-50 p-4 rounded-2xl">
                            <Text className="text-black font-bold text-base mb-3">{t('pro_benefits_title')}</Text>
                            <View className="flex-row flex-wrap gap-y-3">
                                <View className="w-1/2 flex-row items-center pr-2">
                                    <Check size={16} color="#000" className="mr-2" />
                                    <Text className="text-gray-700 text-xs font-medium leading-tight">{t('pro_sessions')}</Text>
                                </View>
                                <View className="w-1/2 flex-row items-center pr-2">
                                    <Check size={16} color="#000" className="mr-2" />
                                    <Text className="text-gray-700 text-xs font-medium leading-tight">{t('pro_venues_rates')}</Text>
                                </View>
                                <View className="w-1/2 flex-row items-center pr-2">
                                    <Check size={16} color="#000" className="mr-2" />
                                    <Text className="text-gray-700 text-xs font-medium leading-tight">{t('pro_economy')}</Text>
                                </View>
                                <View className="w-1/2 flex-row items-center pr-2">
                                    <Check size={16} color="#000" className="mr-2" />
                                    <Text className="text-gray-700 text-xs font-medium leading-tight">{t('pro_analytics')}</Text>
                                </View>
                                <View className="w-1/2 flex-row items-center pr-2">
                                    <Check size={16} color="#000" className="mr-2" />
                                    <Text className="text-gray-700 text-xs font-medium leading-tight">{t('pro_ai')}</Text>
                                </View>
                                <View className="w-1/2 flex-row items-center pr-2">
                                    <Check size={16} color="#000" className="mr-2" />
                                    <Text className="text-gray-700 text-xs font-medium leading-tight">{t('pro_billing')}</Text>
                                </View>
                            </View>
                        </View>

                        {/* PRICING PLANS STACKED */}
                        <View className="flex-col mb-2 gap-4">
                            {/* MONTHLY PLAN CARD */}
                            <TouchableOpacity
                                onPress={() => setSelectedPlan('monthly')}
                                activeOpacity={0.8}
                                className={`w-full p-5 rounded-3xl border-2 flex-row items-center justify-between ${selectedPlan === 'monthly' ? 'border-black bg-gray-50' : 'border-gray-100 bg-white'
                                    }`}
                                style={{ minHeight: 110 }}
                            >
                                <View className="flex-1">
                                    <Text className="text-black font-semibold text-base leading-tight">{t('subscription_name_monthly')}</Text>
                                    <Text className="text-gray-600 text-sm mt-1">{t('plan_monthly')}: {monthlyPriceString}</Text>
                                    <Text className="text-black text-xs font-bold mt-2">{t('plan_monthly_trial')}</Text>
                                </View>
                                <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ml-2 ${selectedPlan === 'monthly' ? 'border-black' : 'border-gray-300'
                                    }`}>
                                    {selectedPlan === 'monthly' && <View className="w-2.5 h-2.5 rounded-full bg-black" />}
                                </View>
                            </TouchableOpacity>

                            {/* YEARLY PLAN CARD */}
                            <TouchableOpacity
                                onPress={() => setSelectedPlan('yearly')}
                                activeOpacity={0.8}
                                className={`w-full p-5 rounded-3xl border-2 flex-row items-center justify-between relative ${selectedPlan === 'yearly' ? 'border-black bg-gray-50' : 'border-gray-100 bg-white'
                                    }`}
                                style={{ minHeight: 110 }}
                            >
                                <View className="flex-1">
                                    <Text className="text-black font-semibold text-base leading-tight">{t('subscription_name_yearly')}</Text>
                                    <Text className="text-gray-600 text-sm mt-1">{t('plan_yearly')}: {annualPriceString}</Text>
                                    <Text className="text-black text-xs font-bold mt-2">{t('plan_yearly_trial')}</Text>
                                </View>
                                <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ml-2 ${selectedPlan === 'yearly' ? 'border-black' : 'border-gray-300'
                                    }`}>
                                    {selectedPlan === 'yearly' && <View className="w-2.5 h-2.5 rounded-full bg-black" />}
                                </View>

                                {/* SAVE BADGE */}
                                <View className="absolute -top-3 right-4 bg-black px-2 py-0.5 rounded-full shadow-sm">
                                    <Text className="text-white font-bold text-[9px] uppercase">
                                        -{t('save_badge', { percent: '70' }).match(/\d+/)?.[0]}%
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* MAIN CTA BUTTON */}
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleSubscribe}
                            disabled={isLoading}
                            className={`py-5 rounded-full flex-row items-center justify-center mt-6 shadow-md ${isLoading ? 'bg-gray-400' : 'bg-black'}`}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text className="text-white font-semibold text-base mr-2">
                                        {selectedPlan === 'monthly' ? t('trial_button_7') : t('trial_button_14')}
                                    </Text>
                                    <ArrowRight size={20} color="white" />
                                </>
                            )}
                        </TouchableOpacity>

                        {/* COMPLIANCE INFO & DISCLAIMERS */}
                        <View className="mt-8">
                            <Text className="text-center text-gray-500 text-[10px] leading-4 px-2 mb-3">
                                {selectedPlan === 'monthly'
                                    ? t('plan_monthly_disclaimer')
                                    : t('plan_yearly_disclaimer')}
                            </Text>

                            <Text className="text-justify text-gray-400 text-[9px] leading-3 mb-2">
                                {t('subscription_notice')}
                            </Text>

                            <Text className="text-justify text-gray-400 text-[9px] leading-3">
                                {t('manage_apple_id')}
                            </Text>
                        </View>
                    </View>

                    {/* FOOTER LINKS */}
                    <View className="items-center mt-8 pb-4 border-t border-gray-100 pt-6">
                        <View className="flex-row items-center flex-wrap justify-center gap-x-3 gap-y-2">
                            <TouchableOpacity onPress={() => Linking.openURL(t('terms_of_use_url'))}>
                                <Text className="text-gray-500 text-[10px] font-medium underline">{t('terms_of_use')}</Text>
                            </TouchableOpacity>
                            <View className="w-1 h-1 rounded-full bg-gray-300 hidden sm:flex" />
                            <TouchableOpacity onPress={() => Linking.openURL(t('privacy_policy_url'))}>
                                <Text className="text-gray-500 text-[10px] font-medium underline">{t('privacy_policy')}</Text>
                            </TouchableOpacity>
                            <View className="w-1 h-1 rounded-full bg-gray-300 hidden sm:flex" />
                            <TouchableOpacity onPress={handleRestore} disabled={isLoading}>
                                <Text className={`text-[10px] font-medium underline ${isLoading ? 'text-gray-300' : 'text-gray-500'}`}>{t('restore_purchases')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
