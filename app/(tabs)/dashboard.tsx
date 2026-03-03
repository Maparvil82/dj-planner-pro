import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import React, { useContext } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { LayoutDashboard, Wallet, Calendar, ArrowUpRight, TrendingUp, Plus, History } from 'lucide-react-native';
import { useAllSessionsQuery, useUpcomingSessionsQuery } from '../../src/hooks/useSessionsQuery';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Avatar } from '../../src/components/ui/Avatar';

export default function DashboardScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const themeCtx = useContext(ThemeContext) as { activeTheme?: string };
    const { session, profile } = useAuthStore();
    const isDark = themeCtx?.activeTheme === 'dark';
    const { data: sessions = [], isLoading } = useAllSessionsQuery();
    const { data: upcomingSessions = [] } = useUpcomingSessionsQuery();

    // Basic stats calculation
    const totalSessions = sessions.length;
    const totalEarnings = sessions.reduce((sum, s) => sum + (Number(s.earning_amount) || 0), 0);

    // Total upcoming sessions count
    const upcomingCount = upcomingSessions.length;

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-white dark:bg-gray-950">
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top', 'left', 'right']}>
            {/* Header */}
            <View className="px-6 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 justify-center">
                <View className="flex-row items-center justify-between h-10">
                    {/* Left Actions - Empty for balance */}
                    <View className="w-8" />

                    {/* Centered Title */}
                    <View className="absolute left-0 right-0 items-center justify-center">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{t('dashboard')}</Text>
                    </View>

                    {/* Right Actions */}
                    <View className="flex-row items-center gap-3 ml-auto">
                        <TouchableOpacity
                            onPress={() => router.push('/history')}
                            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
                        >
                            <Calendar size={20} color={isDark ? '#FFFFFF' : '#111827'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => router.push('/add-session')}
                            className="w-8 h-8 rounded-full bg-blue-600 items-center justify-center shadow-lg shadow-blue-500/30"
                        >
                            <Plus size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>

                {/* Primary Stats Grid */}
                <View className="flex-row gap-4 mb-8">
                    <View className="flex-1 bg-blue-600 rounded-[32px] p-6 shadow-xl shadow-blue-500/20">
                        <View className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center mb-4">
                            <Wallet size={20} color="#FFF" />
                        </View>
                        <Text className="text-white/80 font-bold text-xs uppercase tracking-wider mb-1">{t('earned_history')}</Text>
                        <Text className="text-white text-2xl font-black">{totalEarnings.toLocaleString()}€</Text>
                    </View>

                    <View className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-[32px] p-6 border border-gray-100 dark:border-gray-800">
                        <View className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 items-center justify-center mb-4">
                            <TrendingUp size={20} color="#3B82F6" />
                        </View>
                        <Text className="text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">{t('history')}</Text>
                        <Text className="text-gray-900 dark:text-white text-2xl font-black">{totalSessions}</Text>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}
