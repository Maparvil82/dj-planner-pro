import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import React, { useContext } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { LayoutDashboard, Wallet, Calendar, ArrowUpRight, TrendingUp, Plus } from 'lucide-react-native';
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
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-950" edges={['top']}>
            <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="flex-row items-center justify-between mb-8">
                    <View>
                        <Text className="text-3xl font-black text-gray-900 dark:text-white">{t('dashboard')}</Text>
                        <Text className="text-gray-500 dark:text-gray-400 font-medium">{t('app_title')}</Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                        <TouchableOpacity
                            onPress={() => router.push('/add-session')}
                            className="w-10 h-10 rounded-full bg-blue-600 items-center justify-center shadow-lg shadow-blue-500/30"
                        >
                            <Plus size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Avatar
                            url={profile?.avatar_url}
                            name={session?.user?.email || '?'}
                            size="md"
                            onPress={() => router.push('/settings')}
                        />
                    </View>
                </View>

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

                {/* Quick Actions */}
                <View className="mb-8">
                    <Text className="text-lg font-black text-gray-900 dark:text-white mb-4">{t('welcome')}</Text>

                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => router.push('/add-session')}
                        className="bg-blue-600 rounded-[32px] p-6 flex-row items-center justify-between mb-4 shadow-xl shadow-blue-500/30"
                    >
                        <View className="flex-row items-center">
                            <View className="w-12 h-12 rounded-2xl bg-white/20 items-center justify-center mr-4">
                                <Plus size={24} color="#FFF" />
                            </View>
                            <View>
                                <Text className="text-white text-lg font-black">{t('add_session')}</Text>
                                <Text className="text-white/80 text-xs font-medium uppercase tracking-wider">{t('register_subtitle') || 'Crea una nueva sesión'}</Text>
                            </View>
                        </View>
                        <ArrowUpRight size={24} color="#FFF" />
                    </TouchableOpacity>

                    <View className="bg-gray-50 dark:bg-gray-900 rounded-[32px] p-6 border border-gray-100 dark:border-gray-800">
                        <View className="flex-row items-center mb-4">
                            <View className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/30 items-center justify-center mr-4">
                                <Calendar size={20} color="#10B981" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-gray-900 dark:text-white font-bold">{upcomingCount} {t('history')}</Text>
                                <Text className="text-gray-500 dark:text-gray-400 text-xs">{t('view_calendar')}</Text>
                            </View>
                            <ArrowUpRight size={20} color="#9CA3AF" />
                        </View>
                    </View>
                </View>

                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
