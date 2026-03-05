import React, { useContext, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { useAllSessionsQuery, useUpcomingSessionsQuery } from '../../src/hooks/useSessionsQuery';
import { useAllExpensesQuery } from '../../src/hooks/useExpensesQuery';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Avatar } from '../../src/components/ui/Avatar';
import { format, parseISO, isThisMonth, isWithinInterval, startOfMonth, subMonths, endOfMonth, addDays } from 'date-fns';
import { es, enUS, de, fr, it, ptBR, ja } from 'date-fns/locale';

const { width } = Dimensions.get('window');

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

export default function DashboardScreen() {
    const { t, i18n } = useTranslation();
    const [chartView, setChartView] = React.useState<'sessions' | 'finances'>('sessions');
    const router = useRouter();
    const themeCtx = useContext(ThemeContext) as { activeTheme?: string };
    const { profile, user } = useAuthStore();
    const insets = useSafeAreaInsets();
    const isDark = themeCtx?.activeTheme === 'dark';

    const { data: sessions = [], isLoading: isLoadingAll } = useAllSessionsQuery();
    const { data: upcomingSessions = [], isLoading: isLoadingUpcoming } = useUpcomingSessionsQuery();
    const { data: expenses = [], isLoading: isLoadingExpenses } = useAllExpensesQuery();

    const locale = useMemo(() => {
        switch (i18n.language) {
            case 'es': return es;
            case 'de': return de;
            case 'fr': return fr;
            case 'it': return it;
            case 'pt': return ptBR;
            case 'ja': return ja;
            default: return enUS;
        }
    }, [i18n.language]);

    // Financial calculations
    const { thisMonthEarnings, lastMonthEarnings, totalSessionsThisMonth, lastMonthSessions, topVenue } = useMemo(() => {
        let thisMonth = 0;
        let lastMonth = 0;
        let sessionsThisMonth = 0;
        let prevMonthSessions = 0;

        const now = new Date();
        const startOfCurrentMonth = startOfMonth(now);
        const startOfPreviousMonth = startOfMonth(subMonths(now, 1));
        const endOfPreviousMonth = endOfMonth(subMonths(now, 1));

        let currentYearVenues: Record<string, number> = {};
        const currentYear = now.getFullYear();

        sessions.forEach(session => {
            const earnings = session.status === 'cancelled' ? 0 : calculateSessionEarnings(session);

            if (session.date) {
                const sessionDate = parseISO(session.date);
                if (sessionDate.getFullYear() === currentYear && session.venue) {
                    currentYearVenues[session.venue] = (currentYearVenues[session.venue] || 0) + earnings;
                }

                if (isThisMonth(sessionDate)) {
                    thisMonth += earnings;
                    sessionsThisMonth++;
                } else if (isWithinInterval(sessionDate, { start: startOfPreviousMonth, end: endOfPreviousMonth })) {
                    lastMonth += earnings;
                    prevMonthSessions++;
                }
            }
        });

        // Find top venue
        let topVenueName = '—';
        let topVenueEarnings = 0;
        Object.entries(currentYearVenues).forEach(([venue, amount]) => {
            if (amount > topVenueEarnings) {
                topVenueEarnings = amount;
                topVenueName = venue;
            }
        });

        return {
            thisMonthEarnings: thisMonth,
            lastMonthEarnings: lastMonth,
            totalSessionsThisMonth: sessionsThisMonth,
            lastMonthSessions: prevMonthSessions,
            topVenue: { name: topVenueName, amount: topVenueEarnings }
        };
    }, [sessions]);

    const { thisMonthExpenses, lastMonthExpenses } = useMemo(() => {
        let thisMonthExp = 0;
        let lastMonthExp = 0;

        const now = new Date();
        const startOfCurrentMonth = startOfMonth(now);
        const startOfPreviousMonth = startOfMonth(subMonths(now, 1));
        const endOfPreviousMonth = endOfMonth(subMonths(now, 1));

        expenses.forEach(expense => {
            if (expense.date) {
                const expenseDate = parseISO(expense.date);
                if (isThisMonth(expenseDate)) {
                    thisMonthExp += Number(expense.amount) || 0;
                } else if (isWithinInterval(expenseDate, { start: startOfPreviousMonth, end: endOfPreviousMonth })) {
                    lastMonthExp += Number(expense.amount) || 0;
                }
            }
        });

        return { thisMonthExpenses: thisMonthExp, lastMonthExpenses: lastMonthExp };
    }, [expenses]);

    const differencePercentage = lastMonthEarnings === 0
        ? null
        : Math.round(((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100);

    const isPositiveGrowth = differencePercentage !== null && differencePercentage >= 0;

    const netProfit = thisMonthEarnings - thisMonthExpenses;
    const avgPerSession = totalSessionsThisMonth > 0 ? (thisMonthEarnings / totalSessionsThisMonth) : 0;

    const monthlyChartData = useMemo(() => {
        const data = [];
        const now = new Date();
        const currentYear = now.getFullYear();

        for (let i = 0; i < 12; i++) {
            const targetMonth = new Date(currentYear, i, 1);
            const start = startOfMonth(targetMonth);
            const end = endOfMonth(targetMonth);

            let monthEarnings = 0;
            let lostEarnings = 0;
            let confirmed = 0;
            let pending = 0;
            let cancelled = 0;

            sessions.forEach(session => {
                const earnings = calculateSessionEarnings(session);
                if (session.date) {
                    const sessionDate = parseISO(session.date);
                    if (isWithinInterval(sessionDate, { start, end })) {
                        if (session.status === 'cancelled') {
                            lostEarnings += earnings;
                            cancelled++;
                        } else {
                            monthEarnings += earnings;
                            if (session.status === 'pending') {
                                pending++;
                            } else {
                                confirmed++;
                            }
                        }
                    }
                }
            });

            data.push({
                month: format(targetMonth, 'MMM', { locale }),
                earnings: monthEarnings,
                lostEarnings: lostEarnings,
                confirmed,
                pending,
                cancelled,
                isCurrentMonth: i === now.getMonth()
            });
        }

        const maxVal = Math.max(...data.map(d => Math.max(d.earnings, d.lostEarnings)), 1);

        return data.map(d => ({
            ...d,
            percentage: (d.earnings / maxVal) * 100,
            lostPercentage: (d.lostEarnings / maxVal) * 100
        }));
    }, [sessions, locale]);

    // Derived values for progress bars (visual only, max 100%)
    const sessionGoal = lastMonthSessions > 0 ? Math.max(lastMonthSessions, 10) : 10;
    const sessionPercentage = Math.min(Math.round((totalSessionsThisMonth / sessionGoal) * 100), 100);

    const earningsGoal = lastMonthEarnings > 0 ? Math.max(lastMonthEarnings, 1000) : 1000;
    const earningsPercentage = Math.min(Math.round((thisMonthEarnings / earningsGoal) * 100), 100);

    const upcomingCount = upcomingSessions.length;
    const confirmedUpcoming = upcomingSessions.filter(s => s.status === 'confirmed' || !s.status).length;
    const pendingUpcoming = upcomingSessions.filter(s => s.status === 'pending').length;

    // Total upcoming is used to calculate the visual ratio. Let's base it out of 10.
    const upcomingRatio = Math.min(Math.round((upcomingCount > 0 ? (confirmedUpcoming / upcomingCount) : 0) * 100), 100);

    const isLoading = isLoadingAll || isLoadingUpcoming || isLoadingExpenses;

    if (isLoading) {
        return (
            <View className="flex-1 bg-white dark:bg-gray-950 items-center justify-center">
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    const fullName = user?.user_metadata?.full_name || t('dj') || 'DJ';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    return (
        <View className="flex-1 bg-white dark:bg-[#121212]">
            {/* Header Area */}
            <View className="flex-row justify-between items-start px-6 pt-16 pb-6" style={{ paddingTop: insets.top + 20 }}>
                <View>
                    <Text className="text-[32px] font-black text-gray-900 dark:text-white leading-[34px] tracking-tight">
                        {firstName}
                    </Text>
                    {lastName !== '' && (
                        <Text className="text-[32px] font-black text-gray-900 dark:text-white leading-[34px] tracking-tight">
                            {lastName}
                        </Text>
                    )}
                </View>
                <View className="rounded-2xl overflow-hidden shadow-sm">
                    <Avatar url={profile?.avatar_url} size="lg" name={fullName} />
                </View>
            </View>

            <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>

                {/* Main Card: Today's schedule -> This month's schedule */}
                <View className="bg-neutral-200 dark:bg-[#1E1E1E] rounded-[12px] p-6 mb-4 flex-row justify-between">
                    <View className="flex-1 justify-between">
                        <Text className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-6">
                            {t('schedule_this_month')}
                        </Text>
                        <View className="flex-row items-baseline">
                            <Text className="text-6xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">
                                {totalSessionsThisMonth}
                            </Text>
                            <Text className="text-gray-900 dark:text-white font-bold text-lg ml-2 mb-1">
                                {t('sessions')?.toLowerCase()}
                            </Text>
                        </View>
                    </View>
                    <View className="w-16 items-end justify-between">
                        <View className="items-end mb-2">
                            <Text className="text-[9px] text-gray-400 font-bold mb-1">{t('monthly_goal')}</Text>
                            <View className="bg-white dark:bg-white rounded-lg px-2 py-1 shadow-sm">
                                <Text className="text-gray-900 font-bold text-xs">{sessionPercentage}%</Text>
                            </View>
                        </View>
                        <View className="w-2.5 h-20 bg-gray-200 dark:bg-[#333333] rounded-full overflow-hidden self-end relative">
                            <View
                                className="w-full bg-blue-600 rounded-full absolute bottom-0"
                                style={{ height: `${sessionPercentage}%` }}
                            />
                        </View>
                    </View>
                </View>

                {/* 2-Column Split Cards */}
                <View className="flex-row gap-4 mb-4">
                    {/* Retention -> Earnings */}
                    <View className="flex-1 bg-gray-100 dark:bg-[#1E1E1E] rounded-[32px] p-6">
                        <Text className="text-gray-900 dark:text-white font-bold text-base mb-1">{t('earnings')}</Text>
                        <Text className="text-gray-500 dark:text-gray-400 text-xs mb-8">{t('past_30_days')}</Text>

                        <Text className="text-[28px] font-black text-gray-900 dark:text-white mb-4 tracking-tighter leading-none">
                            {thisMonthEarnings.toLocaleString()}€
                        </Text>

                        <View className="w-full h-1.5 bg-gray-200 dark:bg-[#333333] rounded-full overflow-hidden">
                            <View
                                className="h-full bg-blue-600 rounded-full"
                                style={{ width: `${earningsPercentage}%` }}
                            />
                        </View>
                    </View>

                    {/* Productivity -> Growth */}
                    <View className="flex-1 bg-gray-100 dark:bg-[#1E1E1E] rounded-[32px] p-6">
                        <Text className="text-gray-900 dark:text-white font-bold text-base mb-1">{t('growth')}</Text>
                        <Text className="text-gray-500 dark:text-gray-400 text-xs mb-8">{t('past_30_days')}</Text>

                        <Text className="text-[28px] font-black text-gray-900 dark:text-white mb-4 tracking-tighter leading-none">
                            {differencePercentage === null ? '—' : `${isPositiveGrowth ? '+' : ''}${differencePercentage}%`}
                        </Text>

                        <View className="w-full h-1.5 bg-gray-200 dark:bg-[#333333] rounded-full overflow-hidden">
                            <View
                                className="h-full bg-blue-600 rounded-full"
                                style={{ width: differencePercentage === null ? '0%' : `${Math.min(Math.abs(differencePercentage), 100)}%` }}
                            />
                        </View>
                    </View>
                </View>

                {/* KPI Metrics Row 1 */}
                <View className="flex-row gap-4 mb-4">
                    <View className="flex-1 bg-white dark:bg-[#121212] border border-gray-100 dark:border-gray-800 rounded-[24px] p-5">
                        <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('net_profit')}</Text>
                        <Text className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{netProfit.toLocaleString()}€</Text>
                    </View>
                    <View className="flex-1 bg-white dark:bg-[#121212] border border-gray-100 dark:border-gray-800 rounded-[24px] p-5">
                        <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('expenses')}</Text>
                        <Text className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{thisMonthExpenses.toLocaleString()}€</Text>
                    </View>
                </View>

                {/* KPI Metrics Row 2 */}
                <View className="flex-row gap-4 mb-4">
                    <View className="flex-1 bg-white dark:bg-[#121212] border border-gray-100 dark:border-gray-800 rounded-[24px] p-5">
                        <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('avg_per_session')}</Text>
                        <Text className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{Math.round(avgPerSession).toLocaleString()}€</Text>
                    </View>
                    <View className="flex-1 bg-white dark:bg-[#121212] border border-gray-100 dark:border-gray-800 rounded-[24px] p-5">
                        <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('prev_month_income')}</Text>
                        <Text className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{lastMonthEarnings.toLocaleString()}€</Text>
                    </View>
                </View>

                {/* Full Width Card: New clients -> Upcoming sessions */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => upcomingCount > 0 ? router.push(`/session/${upcomingSessions[0].id}`) : router.push('/add-session')}
                    className="bg-gray-100 dark:bg-[#1E1E1E] rounded-[32px] p-6 mb-4"
                >
                    <View className="mb-6">
                        <Text className="text-gray-900 dark:text-white font-bold text-base mb-1">{t('upcoming_sessions')}</Text>
                        <Text className="text-gray-500 dark:text-gray-400 text-xs">{t('next_30_days')}</Text>
                    </View>

                    <View className="flex-row items-end justify-between">
                        <View className="flex-1 mr-8">
                            <View className="w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-full overflow-hidden mb-4">
                                <View
                                    className="h-full bg-blue-600 rounded-full"
                                    style={{ width: `${Math.max(upcomingRatio, 10)}%` }}
                                />
                            </View>
                            <View className="flex-row items-center gap-4">
                                <View className="flex-row items-center">
                                    <View className="w-2.5 h-2.5 bg-blue-600 rounded mr-2" />
                                    <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('confirmed')} ({confirmedUpcoming})</Text>
                                </View>
                                {pendingUpcoming > 0 && (
                                    <View className="flex-row items-center">
                                        <View className="w-2.5 h-2.5 bg-orange-500 rounded mr-2" />
                                        <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('pending')} ({pendingUpcoming})</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <View className="flex-row items-start relative pb-1">
                            <Text className="text-[56px] font-black text-gray-900 dark:text-white tracking-tighter leading-none">
                                {upcomingCount}
                            </Text>
                            {/* Decorative green arrow for positive vibe if there are sessions */}
                            {upcomingCount > 0 && (
                                <View className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-green-500 ml-2 mt-4" />
                            )}
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Annual Comparison Chart */}
                <View className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-gray-800 rounded-[32px] p-6 mb-4">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('annual_comparison') || 'Annual Comparison'}</Text>
                        <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1F2937' : '#F3F4F6', borderRadius: 8, padding: 4 }}>
                            <TouchableOpacity
                                onPress={() => setChartView('sessions')}
                                style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    backgroundColor: chartView === 'sessions' ? (isDark ? '#374151' : '#FFFFFF') : 'transparent',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: chartView === 'sessions' ? 0.1 : 0,
                                    shadowRadius: 1,
                                    elevation: chartView === 'sessions' ? 1 : 0
                                }}
                            >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: chartView === 'sessions' ? (isDark ? '#60A5FA' : '#2563EB') : '#9CA3AF' }}>SESSIONS</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setChartView('finances')}
                                style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    backgroundColor: chartView === 'finances' ? (isDark ? '#374151' : '#FFFFFF') : 'transparent',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: chartView === 'finances' ? 0.1 : 0,
                                    shadowRadius: 1,
                                    elevation: chartView === 'finances' ? 1 : 0
                                }}
                            >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: chartView === 'finances' ? (isDark ? '#60A5FA' : '#2563EB') : '#9CA3AF' }}>FINANCES</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 24 }}>
                        <View className="flex-row items-end h-40 gap-4">
                            {monthlyChartData.map((data, index) => (
                                <View key={index} className="items-center justify-end" style={{ minWidth: 44 }}>

                                    {/* Bar area */}
                                    {chartView === 'sessions' ? (
                                        <View className="w-full h-24 items-center justify-end mb-3">
                                            <View
                                                style={{
                                                    width: '100%',
                                                    maxWidth: 32,
                                                    borderTopLeftRadius: 8,
                                                    borderTopRightRadius: 8,
                                                    backgroundColor: data.isCurrentMonth ? '#2563EB' : (isDark ? '#2A2A2A' : '#E5E7EB'),
                                                    height: `${Math.max(data.percentage, 2)}%`
                                                }}
                                            />
                                        </View>
                                    ) : (
                                        <View className="w-full h-24 flex-row items-end justify-center mb-3">
                                            <View
                                                className="w-3 rounded-t-sm bg-blue-600 mr-0.5"
                                                style={{ height: `${Math.max(data.percentage, 2)}%` }}
                                            />
                                            <View
                                                className="w-3 rounded-t-sm bg-red-400 opacity-40"
                                                style={{ height: `${Math.max(data.lostPercentage, 2)}%` }}
                                            />
                                        </View>
                                    )}

                                    {/* Indicators area (only for sessions) */}
                                    {chartView === 'sessions' ? (
                                        <View className="flex-row items-center gap-1 mb-2">
                                            {data.confirmed > 0 && (
                                                <View className="flex-row items-center">
                                                    <View className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-0.5" />
                                                    <Text className="text-[9px] text-gray-500 font-bold">{data.confirmed}</Text>
                                                </View>
                                            )}
                                            {data.pending > 0 && (
                                                <View className="flex-row items-center">
                                                    <View className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-0.5" />
                                                    <Text className="text-[9px] text-gray-500 font-bold">{data.pending}</Text>
                                                </View>
                                            )}
                                            {data.cancelled > 0 && (
                                                <View className="flex-row items-center">
                                                    <View className="w-1.5 h-1.5 rounded-full bg-red-500 mr-0.5" />
                                                    <Text className="text-[9px] text-gray-500 font-bold">{data.cancelled}</Text>
                                                </View>
                                            )}
                                        </View>
                                    ) : (
                                        <View className="h-4 mb-2 justify-center">
                                            <Text style={{ fontSize: 8, fontWeight: '700', color: isDark ? '#9CA3AF' : '#6B7280' }}>
                                                {data.earnings > 0 ? `${Math.round(data.earnings)}€` : ''}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Month Label */}
                                    <Text
                                        style={{
                                            fontSize: 10,
                                            textTransform: 'uppercase',
                                            letterSpacing: 1,
                                            fontWeight: data.isCurrentMonth ? '700' : '600',
                                            color: data.isCurrentMonth ? '#2563EB' : (isDark ? '#9CA3AF' : '#6B7280')
                                        }}
                                    >
                                        {data.month}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                </View>

                {/* Top Venue Card */}
                <View className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-gray-800 rounded-[32px] p-6 mb-4">
                    <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('top_venue_year')}</Text>
                    <Text className="text-xl font-bold text-gray-900 dark:text-white mb-1" numberOfLines={1}>{topVenue.name}</Text>
                    {topVenue.amount > 0 && (
                        <Text className="text-sm font-semibold text-blue-600 dark:text-blue-400">{topVenue.amount.toLocaleString()}€</Text>
                    )}
                </View>

                <View className="h-28" />
            </ScrollView>
        </View>
    );
}
