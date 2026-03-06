import React, { useContext, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { useAllSessionsQuery, useUpcomingSessionsQuery } from '../../src/hooks/useSessionsQuery';
import { useAllExpensesQuery } from '../../src/hooks/useExpensesQuery';
import { useVenuesQuery } from '../../src/hooks/useVenuesQuery';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Avatar } from '../../src/components/ui/Avatar';
import { Calendar, Plus, ChevronRight } from 'lucide-react-native';
import { format, parseISO, isThisMonth, isWithinInterval, startOfMonth, subMonths, endOfMonth, addDays } from 'date-fns';
import { es, enUS, de, fr, it, ptBR, ja } from 'date-fns/locale';

const { width } = Dimensions.get('window');

const calculateSessionEarnings = (session: any): number => {
    const amount = Number(session.earning_amount) || 0;
    if (session.earning_type === 'fixed') return amount;
    if (session.earning_type === 'hourly') {
        const [startH, startM] = (session.start_time || '00:00').split(':').map(Number);
        const [endH, endM] = (session.end_time || '00:00').split(':').map(Number);
        let startMins = startH * 60 + startM;
        let endMins = endH * 60 + endM;
        if (endMins <= startMins) endMins += 24 * 60;
        return amount * ((endMins - startMins) / 60);
    }
    return 0;
};

export default function DashboardScreen() {
    const { t, i18n } = useTranslation();
    const [chartView, setChartView] = React.useState<'sessions' | 'finances'>('sessions');
    const [upcomingFilter, setUpcomingFilter] = React.useState<'month' | 'future' | 'past' | 'all'>('month');
    const router = useRouter();
    const themeCtx = useContext(ThemeContext) as { activeTheme?: string };
    const { profile, user } = useAuthStore();
    const insets = useSafeAreaInsets();
    const isDark = themeCtx?.activeTheme === 'dark';

    const { data: sessions = [], isLoading: isLoadingAll } = useAllSessionsQuery();
    const { data: upcomingSessions = [], isLoading: isLoadingUpcoming } = useUpcomingSessionsQuery();
    const { data: expenses = [], isLoading: isLoadingExpenses } = useAllExpensesQuery();
    const { data: venues = [] } = useVenuesQuery();

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
    const { thisMonthEarnings, lastMonthEarnings, totalSessionsThisMonth, lastMonthSessions, topVenue, topVisitedVenue } = useMemo(() => {
        let thisMonth = 0;
        let lastMonth = 0;
        let sessionsThisMonth = 0;
        let prevMonthSessions = 0;

        const now = new Date();
        const startOfCurrentMonth = startOfMonth(now);
        const startOfPreviousMonth = startOfMonth(subMonths(now, 1));
        const endOfPreviousMonth = endOfMonth(subMonths(now, 1));

        let currentYearVenues: Record<string, number> = {};
        let currentYearVenueCounts: Record<string, number> = {};
        const currentYear = now.getFullYear();

        sessions.forEach(session => {
            const earnings = session.status === 'cancelled' ? 0 : calculateSessionEarnings(session);

            if (session.date) {
                const sessionDate = parseISO(session.date);
                if (sessionDate.getFullYear() === currentYear && session.venue) {
                    currentYearVenues[session.venue] = (currentYearVenues[session.venue] || 0) + earnings;
                    currentYearVenueCounts[session.venue] = (currentYearVenueCounts[session.venue] || 0) + 1;
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

        // Find top earning venue
        let topVenueName = '—';
        let topVenueEarnings = 0;
        Object.entries(currentYearVenues).forEach(([venue, amount]) => {
            if (amount > topVenueEarnings) {
                topVenueEarnings = amount;
                topVenueName = venue;
            }
        });

        // Find most visited venue (by session count)
        let topVisitedName = '—';
        let topVisitedCount = 0;
        Object.entries(currentYearVenueCounts).forEach(([venue, count]) => {
            if (count > topVisitedCount) {
                topVisitedCount = count;
                topVisitedName = venue;
            }
        });

        return {
            thisMonthEarnings: thisMonth,
            lastMonthEarnings: lastMonth,
            totalSessionsThisMonth: sessionsThisMonth,
            lastMonthSessions: prevMonthSessions,
            topVenue: { name: topVenueName, amount: topVenueEarnings },
            topVisitedVenue: { name: topVisitedName, count: topVisitedCount }
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
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Build 12 buckets for Jan-Dec of the current year
        const buckets = Array.from({ length: 12 }, (_, i) => ({
            monthIndex: i,
            month: format(new Date(currentYear, i, 1), 'MMM', { locale }),
            earnings: 0,
            lostEarnings: 0,
            confirmed: 0,
            pending: 0,
            cancelled: 0,
            isCurrentMonth: i === currentMonth
        }));

        // Fill buckets from sessions
        sessions.forEach(session => {
            if (!session.date) return;
            // Parse YYYY-MM-DD safely
            const parts = session.date.split('T')[0].split('-');
            if (parts.length < 3) return;
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // 0-indexed
            if (year !== currentYear || month < 0 || month > 11) return;

            const earnings = calculateSessionEarnings(session);
            const bucket = buckets[month];

            if (session.status === 'cancelled') {
                bucket.lostEarnings += earnings;
                bucket.cancelled++;
            } else if (session.status === 'pending') {
                bucket.earnings += earnings;
                bucket.pending++;
            } else {
                // confirmed or undefined (legacy)
                bucket.earnings += earnings;
                bucket.confirmed++;
            }
        });

        // Calculate max values for scaling
        const maxEarnings = Math.max(...buckets.map(b => Math.max(b.earnings, b.lostEarnings)), 1);
        const maxSessions = Math.max(...buckets.map(b => b.confirmed + b.pending + b.cancelled), 1);
        const BAR_HEIGHT = 80; // px

        return buckets.map(b => ({
            ...b,
            sessionCount: b.confirmed + b.pending + b.cancelled,
            earningsPx: Math.max(Math.round((b.earnings / maxEarnings) * BAR_HEIGHT), b.earnings > 0 ? 4 : 0),
            lostPx: Math.max(Math.round((b.lostEarnings / maxEarnings) * BAR_HEIGHT), b.lostEarnings > 0 ? 4 : 0),
            activePx: Math.max(Math.round(((b.confirmed + b.pending) / maxSessions) * BAR_HEIGHT), b.confirmed + b.pending > 0 ? 4 : 0),
            cancelledPx: Math.max(Math.round((b.cancelled / maxSessions) * BAR_HEIGHT), b.cancelled > 0 ? 4 : 0),
            sessionsPx: Math.max(Math.round(((b.confirmed + b.pending + b.cancelled) / maxSessions) * BAR_HEIGHT), b.confirmed + b.pending + b.cancelled > 0 ? 4 : 0)
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

    const filteredUpcoming = useMemo(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth(); // 0-indexed
        const pad = (n: number) => String(n).padStart(2, '0');
        const today = `${y}-${pad(m + 1)}-${pad(now.getDate())}`;
        const startOfCurrentMonth = `${y}-${pad(m + 1)}-01`;
        const lastDay = new Date(y, m + 1, 0).getDate();
        const endOfCurrentMonth = `${y}-${pad(m + 1)}-${pad(lastDay)}`;

        // Helper: extract YYYY-MM-DD from a session date (handles ISO timestamp too)
        const getDateStr = (d: string) => d ? d.split('T')[0] : '';

        if (upcomingFilter === 'month') {
            return sessions.filter(s => {
                const d = getDateStr(s.date);
                return d >= startOfCurrentMonth && d <= endOfCurrentMonth;
            });
        }
        if (upcomingFilter === 'future') {
            return upcomingSessions;
        }
        if (upcomingFilter === 'past') {
            const startOfYear = `${y}-01-01`;
            return sessions.filter(s => {
                const d = getDateStr(s.date);
                return d >= startOfYear && d < today;
            });
        }
        // 'all'
        return sessions;
    }, [upcomingFilter, sessions, upcomingSessions]);

    const filteredConfirmed = filteredUpcoming.filter(s => s.status === 'confirmed' || !s.status).length;
    const filteredPending = filteredUpcoming.filter(s => s.status === 'pending').length;
    const filteredCancelled = filteredUpcoming.filter(s => s.status === 'cancelled').length;
    const filteredTotal = filteredUpcoming.length;
    const filteredRatio = filteredTotal > 0 ? Math.min(Math.round((filteredConfirmed / filteredTotal) * 100), 100) : 0;

    const dormantVenue = useMemo(() => {
        if (sessions.length === 0) return null;

        const venueLastVisit: Record<string, Date> = {};
        const venueSessionCount: Record<string, number> = {};

        sessions.forEach(s => {
            if (!s.venue || s.status === 'cancelled' || !s.date) return;
            // Use same date parsing as monthlyChartData for consistency
            const dateStr = s.date.split('T')[0];
            const d = parseISO(dateStr);
            if (!venueLastVisit[s.venue] || d > venueLastVisit[s.venue]) {
                venueLastVisit[s.venue] = d;
            }
            venueSessionCount[s.venue] = (venueSessionCount[s.venue] || 0) + 1;
        });

        // "Dormant" threshold: 30 days is enough to be pro-active
        const dormantThreshold = addDays(new Date(), -30);

        const candidates = Object.keys(venueLastVisit).filter(v => {
            const lastVisit = venueLastVisit[v];
            // Only count as "upcoming" if it's NOT cancelled
            const hasFutureActiveSession = upcomingSessions.some(us => us.venue === v && us.status !== 'cancelled');
            return lastVisit < dormantThreshold && !hasFutureActiveSession;
        });

        if (candidates.length === 0) {
            // Fallback: any venue where they've played that doesn't have an upcoming active session
            const allPastVenues = Object.keys(venueLastVisit).filter(v => {
                const hasFutureActiveSession = upcomingSessions.some(us => us.venue === v && us.status !== 'cancelled');
                return !hasFutureActiveSession;
            });
            return allPastVenues.length > 0 ? allPastVenues[0] : null;
        }

        candidates.sort((a, b) => venueSessionCount[b] - venueSessionCount[a]);
        return candidates[0];
    }, [sessions, upcomingSessions]);

    const hasCancelledThisMonth = useMemo(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const startOfMonthStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const endOfMonthDate = endOfMonth(now);
        const endOfMonthStr = format(endOfMonthDate, 'yyyy-MM-dd');

        return sessions.some(s => {
            if (s.status !== 'cancelled' || !s.date) return false;
            const d = s.date.split('T')[0];
            return d >= startOfMonthStr && d <= endOfMonthStr;
        });
    }, [sessions]);

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
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top']}>
            {/* HEADER */}
            <View className="px-6 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 justify-center">
                <View className="flex-row items-center justify-between h-10">
                    <View className="w-8" />
                    <View className="absolute left-0 right-0 items-center justify-center">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                            Dashboard
                        </Text>
                    </View>
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

            <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}>

                {/* WELCOME SECTION */}
                <View className="mb-8 mt-6 px-2">
                    <Text className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                        {(() => {
                            const email = user?.email || '';
                            const prefix = email.split('@')[0];
                            const displayName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
                            return `${t('hello')} ${displayName} 👋`;
                        })()}
                    </Text>
                    <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
                        {(() => {
                            let dateStr = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
                            dateStr = dateStr.replace(',', '');
                            return dateStr.split(' ').map(word =>
                                word.toLowerCase() === 'de' ? 'de' : word.charAt(0).toUpperCase() + word.slice(1)
                            ).join(' ');
                        })()}
                    </Text>
                </View>

                {/* Month-over-month earnings KPI — shown first */}
                {(() => {
                    const diff = thisMonthEarnings - lastMonthEarnings;
                    const pct = lastMonthEarnings > 0
                        ? Math.round((diff / lastMonthEarnings) * 100)
                        : thisMonthEarnings > 0 ? 100 : 0;
                    const isUp = pct > 0;
                    const isFlat = pct === 0 && lastMonthEarnings === 0 && thisMonthEarnings === 0;
                    const arrow = isFlat ? '→' : isUp ? '↑' : '↓';
                    const color = isFlat ? (isDark ? '#9CA3AF' : '#6B7280') : isUp ? '#22C55E' : '#EF4444';
                    const bgColor = isFlat
                        ? (isDark ? '#1F1F1F' : '#F3F4F6')
                        : isUp ? (isDark ? '#14532D' : '#F0FDF4')
                            : (isDark ? '#450A0A' : '#FEF2F2');
                    const label = isFlat
                        ? t('earnings_vs_last_flat')
                        : t(isUp ? 'earnings_vs_last_up' : 'earnings_vs_last_down', { pct });

                    const showSuggestion = pct < 0 || hasCancelledThisMonth;

                    let suggestionText = '';
                    if (showSuggestion) {
                        if (hasCancelledThisMonth) {
                            suggestionText = dormantVenue
                                ? t('recovery_suggestion', { name: dormantVenue })
                                : t('recovery_no_venue'); // Fallback if no venue found
                        } else if (pct < 0 && dormantVenue) {
                            suggestionText = t('venue_suggestion', { name: dormantVenue });
                        } else {
                            // If pct < 0 but no dormant venue, show nothing or a generic one
                            // For now let's just use dormantVenue check inside here too
                        }
                    }

                    if (showSuggestion && !suggestionText) return (
                        <View style={{ backgroundColor: bgColor, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={{ fontSize: 18, color, fontWeight: '900' }}>{arrow}</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color, flex: 1 }}>{label}</Text>
                        </View>
                    );

                    return (
                        <View style={{ backgroundColor: bgColor, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20, flexDirection: 'column', gap: showSuggestion ? 8 : 0 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Text style={{ fontSize: 18, color, fontWeight: '900' }}>{arrow}</Text>
                                <Text style={{ fontSize: 13, fontWeight: '700', color, flex: 1 }}>{label}</Text>
                            </View>
                            {showSuggestion && (
                                <TouchableOpacity
                                    onPress={() => router.push('/venues')}
                                    activeOpacity={0.7}
                                    style={{
                                        marginTop: 4,
                                        paddingTop: 6,
                                        borderTopWidth: 1,
                                        borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#D1D5DB' : '#4B5563', flex: 1 }}>
                                        {suggestionText}
                                    </Text>
                                    <ChevronRight size={14} color={isDark ? '#9CA3AF' : '#6B7280'} />
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                })()}

                {/* Annual Comparison Chart */}
                <View className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-gray-800 rounded-[32px] p-6 mb-4">
                    <View className="flex-row justify-between items-center mb-6">
                        <TouchableOpacity
                            onPress={() => router.push('/history')}
                            activeOpacity={0.7}
                            className="flex-row items-center space-x-1"
                        >
                            <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('annual_comparison')}</Text>
                            <ChevronRight size={12} color={isDark ? '#9CA3AF' : '#6B7280'} style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
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
                                <Text style={{ fontSize: 10, fontWeight: '700', color: chartView === 'sessions' ? (isDark ? '#60A5FA' : '#2563EB') : '#9CA3AF' }}>{t('chart_sessions')}</Text>
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
                                <Text style={{ fontSize: 10, fontWeight: '700', color: chartView === 'finances' ? (isDark ? '#60A5FA' : '#2563EB') : '#9CA3AF' }}>{t('chart_finances')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 8 }}>
                            {monthlyChartData.map((data, index) => (
                                <View key={index} style={{ alignItems: 'center', justifyContent: 'flex-end', minWidth: 44 }}>

                                    {/* BAR AREA — 96px tall container */}
                                    <View style={{ height: 96, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 4 }}>
                                        {chartView === 'sessions' ? (
                                            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                                                {/* Active (confirmed + pending) bar */}
                                                <View
                                                    style={{
                                                        width: 14,
                                                        borderTopLeftRadius: 4,
                                                        borderTopRightRadius: 4,
                                                        backgroundColor: data.isCurrentMonth ? '#2563EB' : '#3B82F6',
                                                        marginRight: 2,
                                                        height: data.activePx
                                                    }}
                                                />
                                                {/* Cancelled bar (only shows if there are cancelled sessions) */}
                                                {data.cancelled > 0 && (
                                                    <View
                                                        style={{
                                                            width: 14,
                                                            borderTopLeftRadius: 4,
                                                            borderTopRightRadius: 4,
                                                            backgroundColor: '#F87171',
                                                            height: data.cancelledPx
                                                        }}
                                                    />
                                                )}
                                            </View>
                                        ) : (
                                            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                                                <View
                                                    style={{
                                                        width: 14,
                                                        borderTopLeftRadius: 4,
                                                        borderTopRightRadius: 4,
                                                        backgroundColor: '#3B82F6',
                                                        marginRight: 2,
                                                        height: data.earningsPx
                                                    }}
                                                />
                                                <View
                                                    style={{
                                                        width: 14,
                                                        borderTopLeftRadius: 4,
                                                        borderTopRightRadius: 4,
                                                        backgroundColor: '#F87171',
                                                        height: data.lostPx
                                                    }}
                                                />
                                            </View>
                                        )}
                                    </View>

                                    {/* LABEL AREA */}
                                    {chartView === 'sessions' ? (
                                        <View style={{ height: 20, flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 4 }}>
                                            {data.confirmed > 0 && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#3B82F6', marginRight: 1 }} />
                                                    <Text style={{ fontSize: 8, color: isDark ? '#9CA3AF' : '#6B7280', fontWeight: '700' }}>{data.confirmed}</Text>
                                                </View>
                                            )}
                                            {data.pending > 0 && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#FB923C', marginRight: 1 }} />
                                                    <Text style={{ fontSize: 8, color: isDark ? '#9CA3AF' : '#6B7280', fontWeight: '700' }}>{data.pending}</Text>
                                                </View>
                                            )}
                                            {data.cancelled > 0 && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#F87171', marginRight: 1 }} />
                                                    <Text style={{ fontSize: 8, color: isDark ? '#9CA3AF' : '#6B7280', fontWeight: '700' }}>{data.cancelled}</Text>
                                                </View>
                                            )}
                                        </View>
                                    ) : (
                                        <View style={{ height: 28, marginBottom: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                                            {data.earnings > 0 && (
                                                <Text style={{ fontSize: 8, fontWeight: '800', color: isDark ? '#60A5FA' : '#2563EB' }}>
                                                    {data.earnings >= 1000 ? `${Math.round(data.earnings / 1000)}k` : `${Math.round(data.earnings)}`}€
                                                </Text>
                                            )}
                                            {data.lostEarnings > 0 && (
                                                <Text style={{ fontSize: 7, fontWeight: '700', color: '#F87171' }}>
                                                    -{data.lostEarnings >= 1000 ? `${Math.round(data.lostEarnings / 1000)}k` : `${Math.round(data.lostEarnings)}`}€
                                                </Text>
                                            )}
                                        </View>
                                    )}

                                    {/* MONTH LABEL */}
                                    <Text
                                        style={{
                                            fontSize: 10,
                                            textTransform: 'uppercase',
                                            letterSpacing: 0.5,
                                            fontWeight: data.isCurrentMonth ? '800' : '500',
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

                {/* Upcoming Sessions Card with filter toggle */}
                <View
                    style={{
                        backgroundColor: isDark ? '#1E1E1E' : '#F3F4F6',
                        borderRadius: 12,
                        padding: 20,
                        marginBottom: 16
                    }}
                >
                    {/* Header row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#111827' }}>
                            {t('upcoming_sessions')}
                        </Text>
                        {/* Filter toggle */}
                        <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#2A2A2A' : '#E5E7EB', borderRadius: 8, padding: 3 }}>
                            {(['month', 'future', 'past', 'all'] as const).map(filter => {
                                const labels: Record<string, string> = {
                                    month: t('filter_month'),
                                    future: t('filter_upcoming'),
                                    past: t('filter_past'),
                                    all: t('dash_filter_all')
                                };
                                const isActive = upcomingFilter === filter;
                                return (
                                    <TouchableOpacity
                                        key={filter}
                                        onPress={() => setUpcomingFilter(filter)}
                                        style={{
                                            paddingHorizontal: 10,
                                            paddingVertical: 8,
                                            borderRadius: 6,
                                            backgroundColor: isActive ? (isDark ? '#374151' : '#FFFFFF') : 'transparent',
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: isActive ? 0.1 : 0,
                                            shadowRadius: 1,
                                            elevation: isActive ? 1 : 0
                                        }}
                                    >
                                        <Text style={{ fontSize: 9, fontWeight: '700', color: isActive ? (isDark ? '#60A5FA' : '#2563EB') : '#9CA3AF' }}>
                                            {labels[filter]}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Progress bar */}
                    <View style={{ height: 6, backgroundColor: isDark ? '#333333' : '#D1D5DB', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
                        <View
                            style={{
                                height: '100%',
                                marginBottom: 2,
                                width: `${Math.max(filteredRatio, 4)}%`,
                                backgroundColor: '#2563EB',
                                borderRadius: 4
                            }}
                        />
                    </View>

                    {/* Stats: number + labels stacked */}
                    <View style={{ flexDirection: 'column' }}>
                        <Text style={{ fontSize: 52, fontWeight: '900', color: isDark ? '#FFFFFF' : '#111827', lineHeight: 52, marginBottom: 8 }}>
                            {filteredTotal}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {filteredConfirmed > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB', marginRight: 4 }} />
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#9CA3AF' : '#6B7280' }}>
                                        {t('confirmed')} ({filteredConfirmed})
                                    </Text>
                                </View>
                            )}
                            {filteredPending > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F97316', marginRight: 4 }} />
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#9CA3AF' : '#6B7280' }}>
                                        {t('pending')} ({filteredPending})
                                    </Text>
                                </View>
                            )}
                            {filteredCancelled > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 4 }} />
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#9CA3AF' : '#6B7280' }}>
                                        {t('cancelled_label')} ({filteredCancelled})
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* KPI row: avg price/session + avg sessions/month */}
                {(() => {
                    const now = new Date();
                    const currentYear = now.getFullYear();
                    const monthsElapsed = now.getMonth() + 1; // 1-12

                    // Use yearly sessions data (non-cancelled, current year)
                    const yearlySessions = sessions.filter(s => {
                        if (!s.date) return false;
                        return parseInt(s.date.split('T')[0].split('-')[0], 10) === currentYear
                            && s.status !== 'cancelled';
                    });
                    const yearlyEarnings = yearlySessions.reduce((sum, s) => sum + calculateSessionEarnings(s), 0);
                    const paidSessions = yearlySessions.filter(s => calculateSessionEarnings(s) > 0);

                    const avgPrice = paidSessions.length > 0 ? Math.round(yearlyEarnings / paidSessions.length) : 0;
                    const avgSessionsPerMonth = Math.round((yearlySessions.length / monthsElapsed) * 10) / 10;

                    return (
                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                            <View style={{ flex: 1, backgroundColor: isDark ? '#121212' : '#FFFFFF', borderWidth: 1, borderColor: isDark ? '#1F2937' : '#F3F4F6', borderRadius: 16, padding: 16 }}>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                                    {t('avg_price_session')}
                                </Text>
                                <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? '#FFFFFF' : '#111827' }}>
                                    {avgPrice > 0 ? `${avgPrice.toLocaleString()}€` : '—'}
                                </Text>
                            </View>
                            <View style={{ flex: 1, backgroundColor: isDark ? '#121212' : '#FFFFFF', borderWidth: 1, borderColor: isDark ? '#1F2937' : '#F3F4F6', borderRadius: 16, padding: 16 }}>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                                    {t('avg_sessions_month')}
                                </Text>
                                <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? '#FFFFFF' : '#111827' }}>
                                    {avgSessionsPerMonth > 0 ? avgSessionsPerMonth.toLocaleString() : '—'}
                                </Text>
                            </View>
                        </View>
                    );
                })()}

                {/* Top Venue Cards Row: earnings + visits */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                    {/* Most profitable */}
                    <View style={{ flex: 1, backgroundColor: isDark ? '#121212' : '#FFFFFF', borderWidth: 1, borderColor: isDark ? '#1F2937' : '#F3F4F6', borderRadius: 24, padding: 20 }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                            {t('top_venue_year')}
                        </Text>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#FFFFFF' : '#111827', marginBottom: 2 }} numberOfLines={1}>
                            {topVenue.name}
                        </Text>
                        {topVenue.amount > 0 && (
                            <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#60A5FA' : '#2563EB' }}>
                                {topVenue.amount.toLocaleString()}€
                            </Text>
                        )}
                    </View>
                    {/* Most visited */}
                    <View style={{ flex: 1, backgroundColor: isDark ? '#121212' : '#FFFFFF', borderWidth: 1, borderColor: isDark ? '#1F2937' : '#F3F4F6', borderRadius: 24, padding: 20 }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                            {t('top_venue_visits')}
                        </Text>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#FFFFFF' : '#111827', marginBottom: 2 }} numberOfLines={1}>
                            {topVisitedVenue.name}
                        </Text>
                        {topVisitedVenue.count > 0 && (
                            <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#F9A8D4' : '#DB2777' }}>
                                {topVisitedVenue.count} {topVisitedVenue.count === 1 ? t('session_singular') : t('sessions_plural')}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Venue Rating Cards Row: best sound + best experience */}
                {(() => {
                    const ratedVenues = venues.filter(v => v.sound_quality || v.experience_rating);
                    const bestSound = ratedVenues.reduce<typeof venues[0] | null>((best, v) =>
                        (v.sound_quality || 0) > (best?.sound_quality || 0) ? v : best, null);
                    const bestExp = ratedVenues.reduce<typeof venues[0] | null>((best, v) =>
                        (v.experience_rating || 0) > (best?.experience_rating || 0) ? v : best, null);
                    const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

                    return (
                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                            {/* Best sound quality */}
                            <View style={{ flex: 1, backgroundColor: isDark ? '#121212' : '#FFFFFF', borderWidth: 1, borderColor: isDark ? '#1F2937' : '#F3F4F6', borderRadius: 24, padding: 20 }}>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                                    {t('best_sound_venue')}
                                </Text>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#FFFFFF' : '#111827', marginBottom: 4 }} numberOfLines={1}>
                                    {bestSound?.name || '—'}
                                </Text>
                                {bestSound?.sound_quality ? (
                                    <Text style={{ fontSize: 14, color: '#FACC15', letterSpacing: 1 }}>
                                        {stars(bestSound.sound_quality)}
                                    </Text>
                                ) : null}
                            </View>
                            {/* Best experience */}
                            <View style={{ flex: 1, backgroundColor: isDark ? '#121212' : '#FFFFFF', borderWidth: 1, borderColor: isDark ? '#1F2937' : '#F3F4F6', borderRadius: 24, padding: 20 }}>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                                    {t('best_exp_venue')}
                                </Text>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#FFFFFF' : '#111827', marginBottom: 4 }} numberOfLines={1}>
                                    {bestExp?.name || '—'}
                                </Text>
                                {bestExp?.experience_rating ? (
                                    <Text style={{ fontSize: 14, color: '#3B82F6', letterSpacing: 1 }}>
                                        {stars(bestExp.experience_rating)}
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    );
                })()}

                <View className="h-28" />
            </ScrollView>
        </SafeAreaView>
    );
}
