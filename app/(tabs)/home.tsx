import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useRouter } from 'expo-router';
import { Avatar } from '../../src/components/ui/Avatar';
import { useSessionsQuery, useUpcomingSessionsQuery } from '../../src/hooks/useSessionsQuery';
import { CalendarPlus, Inbox, Users, TrendingUp, Wallet } from 'lucide-react-native';
import { useContext, useState, useMemo } from 'react';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { setupCalendarLocales } from '../../src/i18n/calendarLocales';

export default function HomeScreen() {
    const { t, currentLanguage } = useTranslation();
    const { session, profile } = useAuthStore();
    const router = useRouter();
    const themeCtx = useContext(ThemeContext);

    const isDark = themeCtx?.activeTheme === 'dark';
    const [sessionFilter, setSessionFilter] = useState<'all' | 'month'>('all');
    // Calendar localization is now handled where the calendar is used

    const { data: upcomingSessions, isLoading: isLoadingUpcoming } = useUpcomingSessionsQuery();

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const { data: monthSessions, isLoading: isLoadingMonth } = useSessionsQuery(currentYear, currentMonth);

    const calculateSessionEarnings = (session: any) => {
        if (session.earning_type === 'fixed') return session.earning_amount || 0;
        if (session.earning_type === 'hourly') {
            const [startH, startM] = (session.start_time || '00:00').split(':').map(Number);
            const [endH, endM] = (session.end_time || '00:00').split(':').map(Number);
            let startMins = startH * 60 + startM;
            let endMins = endH * 60 + endM;
            if (endMins <= startMins) endMins += 24 * 60;
            return (session.earning_amount || 0) * ((endMins - startMins) / 60);
        }
        return 0;
    };

    const { earnedSoFar, projectedTotal } = useMemo(() => {
        if (!monthSessions) return { earnedSoFar: 0, projectedTotal: 0 };

        let earned = 0;
        let projected = 0;
        const todayStr = new Date().toISOString().split('T')[0];

        monthSessions.forEach((session: any) => {
            const amount = calculateSessionEarnings(session);
            projected += amount;

            if (session.date <= todayStr) {
                earned += amount;
            }
        });

        return { earnedSoFar: earned, projectedTotal: projected };
    }, [monthSessions]);

    const filteredUpcomingSessions = useMemo(() => {
        if (!upcomingSessions) return [];
        if (sessionFilter === 'all') return upcomingSessions;

        return upcomingSessions.filter((session: any) => {
            const [y, m] = session.date.split('-');
            return Number(y) === currentYear && Number(m) === currentMonth;
        });
    }, [upcomingSessions, sessionFilter, currentYear, currentMonth]);

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top']}>
            {/* HEADER */}
            <View className="flex-row items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                <View>
                    <Text className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        DJ Planner PRO
                    </Text>
                </View>
                <Avatar
                    url={profile?.avatar_url}
                    name={session?.user?.email || '?'}
                    size="sm"
                    onPress={() => router.push('/settings')}
                />
            </View>

            <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

                {/* MONTHLY EARNINGS CARD */}
                <View className="mb-8">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4 px-2 tracking-tight">
                        {t('current_month_earnings') || 'Ganancias del mes actual'}
                    </Text>

                    <View className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-sm shadow-black/5 border border-indigo-100 dark:border-indigo-900/40">
                        <View className="flex-row items-center mb-4">
                            <View className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 items-center justify-center mr-3">
                                <Wallet size={20} color={isDark ? '#818CF8' : '#4F46E5'} />
                            </View>
                            <View>
                                <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('earned_so_far') || 'Llevas ganado'}
                                </Text>
                                <View className="flex-row items-end flex-wrap h-8">
                                    <Text className="text-3xl font-extrabold text-gray-900 dark:text-white leading-8">
                                        {earnedSoFar.toFixed(2)}
                                    </Text>
                                    <Text className="text-lg font-bold text-gray-500 dark:text-gray-400 ml-1 mb-0.5">€</Text>
                                </View>
                            </View>
                        </View>

                        <View className="h-px bg-gray-100 dark:bg-gray-800 mb-4" />

                        <View className="flex-row items-center justify-between">
                            <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                {t('projected_total') || 'Prevees ganar'}
                            </Text>
                            <View className="flex-row items-center">
                                <TrendingUp size={16} color={isDark ? '#34D399' : '#10B981'} className="mr-1" />
                                <Text className="text-base font-bold text-gray-900 dark:text-white">
                                    {projectedTotal.toFixed(2)} €
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* UPCOMING SESSIONS */}
                <View>
                    <View className="flex-row items-center justify-between mb-4 px-2">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                            {t('upcoming_sessions')}
                        </Text>

                        <View className="flex-row bg-gray-200 dark:bg-gray-800 rounded-full p-1 border border-gray-300/50 dark:border-gray-700/50">
                            <TouchableOpacity
                                onPress={() => setSessionFilter('all')}
                                className={`px-3 py-1.5 rounded-full ${sessionFilter === 'all' ? 'bg-white dark:bg-gray-600 shadow-sm shadow-black/10' : ''}`}
                            >
                                <Text className={`text-xs font-bold ${sessionFilter === 'all' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {t('filter_all') || 'Todas'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setSessionFilter('month')}
                                className={`px-3 py-1.5 rounded-full ${sessionFilter === 'month' ? 'bg-white dark:bg-gray-600 shadow-sm shadow-black/10' : ''}`}
                            >
                                <Text className={`text-xs font-bold ${sessionFilter === 'month' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {t('filter_this_month') || 'Este Mes'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {isLoadingUpcoming ? (
                        <View className="flex-1 items-center justify-center p-8">
                            <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
                        </View>
                    ) : filteredUpcomingSessions && filteredUpcomingSessions.length > 0 ? (
                        <View className="flex-col gap-0">
                            {filteredUpcomingSessions.map((session: any) => {
                                const [y, m, d] = session.date.split('-');
                                const sessionDateObj = new Date(Number(y), Number(m) - 1, Number(d));
                                const monthName = sessionDateObj.toLocaleDateString(currentLanguage, { month: 'short' });

                                return (
                                    <View key={session.id} className="bg-white dark:bg-gray-900 p-3 border border-gray-100 dark:border-gray-800 shadow-sm shadow-black/5 flex-row items-center">
                                        <View className="w-14 h-14 rounded-xl items-center justify-center mr-4" style={{ backgroundColor: (session.color || '#3B82F6') + '26' }}>
                                            <Text className="font-extrabold text-xl leading-tight" style={{ color: session.color || '#3B82F6' }}>
                                                {d}
                                            </Text>
                                            <Text className="text-xs font-bold uppercase" style={{ color: session.color || '#3B82F6', opacity: 0.8 }}>
                                                {monthName}
                                            </Text>
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-lg font-bold text-gray-900 dark:text-white mb-1" numberOfLines={1}>{session.title}</Text>
                                            <Text className="text-gray-500 dark:text-gray-400 text-sm mb-2" numberOfLines={1}>{session.venue}</Text>
                                            <View className="flex-row items-center flex-wrap gap-2">
                                                <Text className="text-xs font-medium px-2 py-1 rounded-md overflow-hidden" style={{ color: session.color || '#3B82F6', backgroundColor: (session.color || '#3B82F6') + '1A' }}>{session.start_time} - {session.end_time}</Text>

                                                {session.is_collective && session.djs && session.djs.length > 0 && (
                                                    <View className="flex-row items-center px-1.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-md max-w-[50%]">
                                                        <Users size={12} color={isDark ? '#9CA3AF' : '#6B7280'} className="mr-1" />
                                                        <Text className="text-xs font-medium text-gray-600 dark:text-gray-400" numberOfLines={1}>
                                                            {session.djs.join(', ')}
                                                        </Text>
                                                    </View>
                                                )}

                                                {session.earning_type && session.earning_type !== 'free' && (
                                                    <View className="flex-row items-center px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800/30">
                                                        <Text className="text-xs font-bold text-green-700 dark:text-green-400">
                                                            {calculateSessionEarnings(session)} €
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View className="bg-white dark:bg-gray-900 items-center justify-center rounded-3xl p-10 mt-2 border border-gray-100 dark:border-gray-800">
                            <Text className="text-gray-900 dark:text-white font-bold text-lg mb-2">
                                {t('no_sessions_yet')}
                            </Text>
                            <Text className="text-gray-500 dark:text-gray-400 text-center">
                                {t('sync_calendars_empty_state')}
                            </Text>
                        </View>
                    )}
                </View>

            </ScrollView>

            {/* FLOATING ACTION BUTTON (Add Session) */}
            <TouchableOpacity
                activeOpacity={0.8}
                className="absolute bottom-6 right-6 w-16 h-16 bg-blue-600 dark:bg-blue-500 rounded-full items-center justify-center shadow-lg shadow-blue-500/40"
                style={{ elevation: 8 }}
                onPress={() => router.push('/add-session')}
            >
                <CalendarPlus size={28} color="#FFFFFF" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}
