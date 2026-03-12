import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from '../src/i18n/useTranslation';
import { useSubscription } from '../src/hooks/useSubscription';
import {
    X,
    ArrowRight,
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
            <View className="flex-1 px-6 justify-between pt-10 pb-10">
                <View>
                    <View className="mt-4">
                        <Text className="text-black font-semibold text-3xl mb-8 tracking-tight text-center">
                            {t('choose_plan').replace(/\|/g, '')}
                        </Text>

                        {/* PRICING PLANS SIDE-BY-SIDE */}
                        <View className="flex-row mb-2 gap-4">
                            {/* MONTHLY PLAN CARD */}
                            <TouchableOpacity
                                onPress={() => setSelectedPlan('monthly')}
                                activeOpacity={0.8}
                                className={`flex-1 p-5 rounded-3xl border-2 flex-row items-center justify-between ${selectedPlan === 'monthly' ? 'border-black bg-gray-50' : 'border-gray-100 bg-white'
                                    }`}
                                style={{ minHeight: 120 }}
                            >
                                <View className="flex-1">
                                    <Text className="text-black font-semibold text-lg leading-tight">{t('plan_monthly')}</Text>
                                    <Text className="text-gray-500 text-sm mt-1">{monthlyPriceString}</Text>
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
                                className={`flex-1 p-5 rounded-3xl border-2 flex-row items-center justify-between relative ${selectedPlan === 'yearly' ? 'border-black bg-gray-50' : 'border-gray-100 bg-white'
                                    }`}
                                style={{ minHeight: 120 }}
                            >
                                <View className="flex-1">
                                    <Text className="text-black font-semibold text-lg leading-tight">{t('plan_yearly')}</Text>
                                    <Text className="text-gray-500 text-sm mt-1">{annualPriceString}</Text>
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
                            className={`py-5 rounded-full flex-row items-center justify-center mt-8 shadow-lg ${isLoading ? 'bg-gray-400' : 'bg-black'}`}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text className="text-white font-semibold text-lg mr-2">
                                        {selectedPlan === 'monthly' ? t('trial_button_7') : t('trial_button_14')}
                                    </Text>
                                    <ArrowRight size={20} color="white" />
                                </>
                            )}
                        </TouchableOpacity>

                        {/* COMPLIANCE INFO */}
                        <Text className="text-center text-gray-400 text-[11px] mt-4 leading-5 px-4">
                            {selectedPlan === 'monthly'
                                ? t('plan_monthly_disclaimer')
                                : t('plan_yearly_disclaimer')}
                        </Text>
                    </View>
                </View>

                {/* FOOTER */}
                <View className="items-center pb-4">
                    <View className="flex-row items-center gap-2 px-4">
                        <TouchableOpacity onPress={() => Linking.openURL(t('terms_of_use_url'))}>
                            <Text className="text-gray-400 text-[11px] font-medium">{t('terms_of_use')}</Text>
                        </TouchableOpacity>
                        <View className="w-1 h-1 rounded-full bg-gray-200" />
                        <TouchableOpacity onPress={() => Linking.openURL(t('privacy_policy_url'))}>
                            <Text className="text-gray-400 text-[11px] font-medium">{t('privacy_policy')}</Text>
                        </TouchableOpacity>
                        <View className="w-1 h-1 rounded-full bg-gray-200" />
                        <TouchableOpacity onPress={handleRestore} disabled={isLoading}>
                            <Text className={`text-[11px] font-medium ${isLoading ? 'text-gray-300' : 'text-gray-400'}`}>{t('restore_purchases')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}
