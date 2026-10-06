import { sessionDisplayTitle, sessionDisplaySubtitle } from '../../src/utils/sessionNaming';
import type { Session } from '../../src/types/session';
import { useSessionDeletion } from '../../src/hooks/useSessionDeletion';
import { useTabBarScroll } from '../../src/contexts/TabBarVisibilityContext';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { HomeSummaryCard } from '../../src/components/home/HomeSummaryCard';
import { SessionPreviewCard } from '../../src/components/sessions/SessionPreviewCard';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useRouter } from 'expo-router';
import { sessionRange, sessionEarnings, earningsByCurrency } from '../../src/utils/sessionPlanning';
import { Avatar } from '../../src/components/ui/Avatar';
import { useSessionsQuery, useUpcomingSessionsQuery, useAllSessionsQuery } from '../../src/hooks/useSessionsQuery';
import { ChevronRight, X, Calendar } from 'lucide-react-native';
import { useContext, useState, useMemo, useRef, useEffect } from 'react';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { setupCalendarLocales } from '../../src/i18n/calendarLocales';
import { startOfWeek, addDays, format, isSameDay, addWeeks, subWeeks, startOfToday } from 'date-fns';
import { es, enUS, de, fr, it, ptBR, ja } from 'date-fns/locale';
import { FlatList, Dimensions, useWindowDimensions } from 'react-native';

export default function HomeScreen() {
    const onTabScroll = useTabBarScroll();
    const { width: windowWidth } = useWindowDimensions();
    const CALENDAR_WIDTH = windowWidth > 1024 ? 1024 - 32 : windowWidth - 32;
    const { t, currentLanguage } = useTranslation();
    const { session, profile } = useAuthStore();
    const router = useRouter();
    const themeCtx = useContext(ThemeContext);

    const isDark = themeCtx?.activeTheme === 'dark';
    const [sessionFilter, setSessionFilter] = useState<'all' | 'month'>('all');
    const [isEarningsModalVisible, setIsEarningsModalVisible] = useState(false);
    const [isProjectedModalVisible, setIsProjectedModalVisible] = useState(false);
    const [visibleDate, setVisibleDate] = useState(startOfToday());
    // Calendar localization is now handled where the calendar is used

    const { data: upcomingSessions, isLoading: isUpcomingLoading } = useUpcomingSessionsQuery();
    const { data: allSessions } = useAllSessionsQuery();
    const deletion = useSessionDeletion();
    const queuedDeletion = useRef<Session | null>(null);
    const showQueuedDeletion = () => {
        const target = queuedDeletion.current;
        queuedDeletion.current = null;
        if (target) deletion.requestDelete(target);
    };
    const requestListDelete = (target: Session, source: 'earnings' | 'projected') => {
        if (Platform.OS === 'ios') queuedDeletion.current = target;
        if (source === 'earnings') setIsEarningsModalVisible(false);
        else setIsProjectedModalVisible(false);
        if (Platform.OS !== 'ios') deletion.requestDelete(target);
    };

    const [now, setNow] = useState(() => new Date());
    useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentMonthName = new Intl.DateTimeFormat(currentLanguage, { month: 'long' }).format(now);
    const capitalizedMonthName = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

    const { data: monthSessions, isLoading: isMonthLoading } = useSessionsQuery(currentYear, currentMonth);

    const { initialized } = useAuthStore();
    const isLoadingUpcoming = isUpcomingLoading || !initialized;
    const isLoadingMonth = isMonthLoading || !initialized;

    const calculateSessionEarnings = sessionEarnings;

    const { earnedTotals, projectedTotals, earnedCount, projectedCount, earnedData, projectedData, earnedSessionsList, pendingSessionsList } = useMemo(() => {
        if (!monthSessions) return { earnedTotals: {} as Record<string, number>, projectedTotals: {} as Record<string, number>, earnedCount: 0, projectedCount: 0, earnedData: [], projectedData: [], earnedSessionsList: [], pendingSessionsList: [] };

        let earned = 0;
        let projected = 0;
        let eCount = 0;
        let pCount = 0;

        const earnedMap: Record<string, number> = {};
        const projectedMap: Record<string, number> = {};
        const earnedSessionsList: any[] = [];
        const pendingSessionsList: any[] = [];


        monthSessions.forEach((session: any) => {
            if (session.status === 'cancelled' || session.is_guest) return;
            const amount = calculateSessionEarnings(session);
            const color = session.color || '#3B82F6';

            if (session.status !== 'pending') {
                projected += amount;
                projectedMap[color] = (projectedMap[color] || 0) + amount;
                pCount++;
            }

            const isEarned = session.status !== 'pending' && sessionRange(session).end <= now;

            if (isEarned) {
                earned += amount;
                earnedMap[color] = (earnedMap[color] || 0) + amount;
                eCount++;
                if (amount > 0) {
                    earnedSessionsList.push({ ...session, calculatedEarned: amount });
                }
            } else {
                if (amount > 0 && session.status !== 'pending') {
                    pendingSessionsList.push({ ...session, calculatedEarned: amount });
                }
            }
        });

        const earnedData = Object.keys(earnedMap).map(color => ({ color, value: earnedMap[color] }));
        const projectedData = Object.keys(projectedMap).map(color => ({ color, value: projectedMap[color] }));

        earnedSessionsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        pendingSessionsList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return { earnedTotals: earningsByCurrency(earnedSessionsList), projectedTotals: earningsByCurrency(monthSessions.filter(s => !s.is_guest && s.status !== 'pending' && s.status !== 'cancelled')), earnedCount: eCount, projectedCount: pCount, earnedData, projectedData, earnedSessionsList, pendingSessionsList };
    }, [monthSessions, now]);

    const filteredUpcomingSessions = useMemo(() => {
        if (!upcomingSessions) return [];
        if (sessionFilter === 'all') return upcomingSessions;

        return upcomingSessions.filter((session: any) => {
            const [y, m] = session.date.split('-');
            return Number(y) === currentYear && Number(m) === currentMonth;
        });
    }, [upcomingSessions, sessionFilter, currentYear, currentMonth]);

    const flatListRef = useRef<FlatList>(null);

    const locale = useMemo(() => {
        switch (currentLanguage) {
            case 'es': return es;
            case 'de': return de;
            case 'fr': return fr;
            case 'it': return it;
            case 'pt': return ptBR;
            case 'ja': return ja;
            default: return enUS;
        }
    }, [currentLanguage]);

    const weeks = useMemo(() => {
        // Generate 52 weeks around the current date (26 before, 26 after)
        const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
        return Array.from({ length: 53 }).map((_, i) => {
            const weekStart = addWeeks(currentWeekStart, i - 26);
            return Array.from({ length: 7 }).map((_, dayIndex) => {
                const date = addDays(weekStart, dayIndex);
                const dateStr = format(date, 'yyyy-MM-dd');
                const daySessions = allSessions?.filter((s: any) => s.date === dateStr) || [];

                return {
                    date,
                    dateStr,
                    dayName: format(date, 'EEEEEE', { locale }).toUpperCase(),
                    dayNumber: format(date, 'd'),
                    isToday: isSameDay(date, now),
                    sessions: daySessions
                };
            });
        });
    }, [currentLanguage, allSessions]);

    const renderWeek = ({ item: weekDays }: { item: any[] }) => (
        <View style={{ width: CALENDAR_WIDTH }} className="flex-row justify-between mb-2 mt-4">
            {weekDays.map((day, index) => (
                <View key={index} className="items-center" style={{ width: CALENDAR_WIDTH / 7 }}>
                    <TouchableOpacity
                        activeOpacity={day.sessions.length > 0 ? 0.6 : 1}
                        onPress={() => {
                            if (day.sessions.length > 0) {
                                router.push(`/session/${day.sessions[0].id}` as any);
                            }
                        }}
                        className={`w-11 h-16 items-center justify-center rounded-3xl relative ${day.isToday ? 'bg-white dark:bg-[#292743] border border-[#dcd6f8] dark:border-[#4a4178]' : 'bg-transparent'}`}
                    >
                        <Text className={`text-[10px] font-normal mb-1 ${day.isToday ? 'text-[#7666df] dark:text-[#bdb0f5]' : 'text-gray-400 dark:text-[#a8b2c6]'}`}>
                            {day.dayName}
                        </Text>
                        <Text className={`text-md font-normal ${day.isToday ? 'text-[#7666df] dark:text-[#bdb0f5]' : 'text-gray-400 dark:text-[#a8b2c6]'}`}>
                            {day.dayNumber}
                        </Text>
                        {day.sessions.length > 0 && (
                            <View className="absolute bottom-1.5 flex-row gap-0.5">
                                {day.sessions.slice(0, 3).map((s: any, i: number) => (
                                    <View
                                        key={i}
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: s.color || '#3B82F6' }}
                                    />
                                ))}
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            ))}
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0d1220' : '#f5f6fa' }} edges={['top']}>
            <PageHeader title={t('community.sessions')} subtitle={t('workflow.homeIntro')}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('history')} onPress={() => router.push('/history')} style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: isDark ? '#20273b' : '#e9eaf3', alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar size={20} color={isDark ? '#f3f4f8' : '#202538'} />
                </TouchableOpacity>
            </PageHeader>

            <ScrollView onScroll={onTabScroll} scrollEventThrottle={16} style={{ flex: 1, backgroundColor: isDark ? '#0d1220' : '#f5f6fa' }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                <View className="max-w-5xl w-full mx-auto px-4">


                    {/* WEEKLY CALENDAR */}
                    <View className="mb-8">
                        <FlatList
                            ref={flatListRef}
                            data={weeks}
                            renderItem={renderWeek}
                            keyExtractor={(_, index) => `week-${index}`}
                            horizontal
                            pagingEnabled={false}
                            snapToInterval={CALENDAR_WIDTH}
                            snapToAlignment="start"
                            decelerationRate="fast"
                            showsHorizontalScrollIndicator={false}
                            initialScrollIndex={26}
                            getItemLayout={(_, index) => ({
                                length: CALENDAR_WIDTH,
                                offset: CALENDAR_WIDTH * index,
                                index,
                            })}
                            onMomentumScrollEnd={(e) => {
                                const index = Math.round(e.nativeEvent.contentOffset.x / CALENDAR_WIDTH);
                                if (weeks[index] && weeks[index][0]) {
                                    setVisibleDate(weeks[index][0].date);
                                }
                            }}
                        />
                    </View>


                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 28, paddingHorizontal: 4 }}>
                        <HomeSummaryCard title={t('workflow.completedFees')} totals={earnedTotals} caption={`${capitalizedMonthName} · ${earnedCount} ${t(earnedCount === 1 ? 'session' : 'sessions').toLowerCase()}`} onPress={() => setIsEarningsModalVisible(true)} />
                        <HomeSummaryCard title={t('insights.revenue')} totals={projectedTotals} caption={`${capitalizedMonthName} · ${projectedCount} ${t(projectedCount === 1 ? 'session' : 'sessions').toLowerCase()}`} highlighted onPress={() => setIsProjectedModalVisible(true)} />
                    </View>

                    {/* UPCOMING SESSIONS */}
                    <View style={{ paddingHorizontal: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 16 }}>
                            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flex: 1, minWidth: 0, fontSize: windowWidth < 360 ? 14 : 17, fontWeight: '700', color: isDark ? '#fff' : '#202538', letterSpacing: -0.3 }}>
                                {t('upcoming_sessions')}
                            </Text>

                            <View style={{ flexShrink: 0 }} className="flex-row bg-white dark:bg-[#171d2c] rounded-2xl p-1 border border-[#e9ecf3] dark:border-[#252d40]">
                                <TouchableOpacity
                                    onPress={() => setSessionFilter('all')}
                                    className="px-3 py-1.5 rounded-xl"
                                    style={{
                                        backgroundColor: sessionFilter === 'all' ? (isDark ? '#292743' : '#f0edfc') : 'transparent',
                                    }}
                                >
                                    <Text className="text-xs font-bold"
                                        style={{
                                            color: sessionFilter === 'all' ? (isDark ? '#bdb0f5' : '#7666df') : (isDark ? '#a8b2c6' : '#6d7588')
                                        }}>
                                        {t('filter_all') || 'Todas'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setSessionFilter('month')}
                                    className="px-3 py-1.5 rounded-xl"
                                    style={{
                                        backgroundColor: sessionFilter === 'month' ? (isDark ? '#292743' : '#f0edfc') : 'transparent',
                                    }}
                                >
                                    <Text className="text-xs font-bold"
                                        style={{
                                            color: sessionFilter === 'month' ? (isDark ? '#bdb0f5' : '#7666df') : (isDark ? '#a8b2c6' : '#6d7588')
                                        }}>
                                        {t('filter_this_month') || 'Este Mes'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {isLoadingUpcoming ? (
                            <View className="items-center justify-center p-8">
                                <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
                            </View>
                        ) : filteredUpcomingSessions && filteredUpcomingSessions.length > 0 ? (
                            <View>
                                {(() => {
                                    const groups: { [key: string]: any[] } = {};
                                    filteredUpcomingSessions.forEach(session => {
                                        const [y, m] = session.date.split('-');
                                        const dateObj = new Date(Number(y), Number(m) - 1, 1);
                                        const monthLabel = dateObj.toLocaleDateString(currentLanguage, { month: 'long', year: 'numeric' }).toUpperCase();
                                        if (!groups[monthLabel]) groups[monthLabel] = [];
                                        groups[monthLabel].push(session);
                                    });

                                    return Object.keys(groups).map((monthLabel) => (
                                        <View key={monthLabel} className="mb-6">
                                            <Text className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-4 mb-4 uppercase tracking-wider ml-1">
                                                {monthLabel}
                                            </Text>
                                            <View className="flex-row flex-wrap gap-4">
                                                {groups[monthLabel].map((session: any) => {
                                                    return (
                                                        <View key={session.id} className="w-full md:w-[48.5%] lg:w-[32%]">
                                                            <SessionPreviewCard
                                                                showPoster
                                                                session={session}
                                                                onPress={() => router.push(`/session/${session.id}` as any)}
                                                                onLongPress={session.is_guest ? undefined : () => deletion.requestDelete(session)}
                                                            />
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    ));
                                })()}
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
                </View>
            </ScrollView>


            {/* EARNINGS HISTORY MODAL */}
            <Modal
                visible={isEarningsModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsEarningsModalVisible(false)}
                onDismiss={showQueuedDeletion}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white dark:bg-gray-900 rounded-t-3xl max-h-[85%]">
                        <View className="flex-row items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
                            <Text className="text-xl font-bold text-gray-900 dark:text-white">
                                {t('workflow.completedFees')} - {capitalizedMonthName}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setIsEarningsModalVisible(false)}
                                className="w-8 h-8 items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full"
                            >
                                <X size={20} color={isDark ? '#D1D5DB' : '#4B5563'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="p-6" contentContainerStyle={{ paddingBottom: 40 }}>
                            {earnedSessionsList.length > 0 ? (
                                earnedSessionsList.map((session, index) => {
                                    const [y, m, d] = session.date.split('-');
                                    return (
                                        <TouchableOpacity
                                            key={session.id || index}
                                            activeOpacity={0.7}
                                            onPress={() => {
                                                setIsEarningsModalVisible(false);
                                                router.push(`/session/${session.id}` as any);
                                            }}
                                            onLongPress={session.is_guest ? undefined : () => requestListDelete(session, 'earnings')}
                                            className="flex-row items-center justify-between mb-4 border-b border-gray-50 dark:border-gray-800/50 pb-4"
                                        >
                                            <View className="flex-1 pr-4">
                                                <Text className="text-base font-bold text-gray-900 dark:text-white mb-1">
                                                    {sessionDisplayTitle(session, t)}
                                                </Text>
                                                <Text className="text-sm text-gray-500 dark:text-gray-400">
                                                    {d}/{m}/{y} • {sessionDisplaySubtitle(session)}
                                                </Text>
                                            </View>
                                            <View className="flex-row items-center">
                                                <Text className="text-lg font-bold text-green-600 dark:text-green-500 opacity-90 mr-2">
                                                    +{session.calculatedEarned.toFixed(0)} {session.currency || '€'}
                                                </Text>
                                                <ChevronRight size={16} color={isDark ? '#4B5563' : '#9CA3AF'} />
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            ) : (
                                <Text className="text-center text-gray-500 dark:text-gray-400 mt-10">
                                    No hay ingresos registrados este mes todavía.
                                </Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
            {/* PROJECTED EARNINGS MODAL */}
            <Modal
                visible={isProjectedModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsProjectedModalVisible(false)}
                onDismiss={showQueuedDeletion}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white dark:bg-gray-900 rounded-t-3xl max-h-[85%]">
                        <View className="flex-row items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
                            <Text className="text-xl font-bold text-gray-900 dark:text-white">
                                {t('insights.revenue')} - {capitalizedMonthName}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setIsProjectedModalVisible(false)}
                                className="w-8 h-8 items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full"
                            >
                                <X size={20} color={isDark ? '#D1D5DB' : '#4B5563'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="p-6" contentContainerStyle={{ paddingBottom: 40 }}>

                            {/* PENDING SESSIONS */}
                            <View className="mb-6">
                                <Text className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                    {t('workflow.confirmedUpcoming')} ({pendingSessionsList.length})
                                </Text>
                                {pendingSessionsList.length > 0 ? (
                                    pendingSessionsList.map((session, index) => {
                                        const [y, m, d] = session.date.split('-');
                                        return (
                                            <TouchableOpacity
                                                key={session.id || index}
                                                activeOpacity={0.7}
                                                onPress={() => {
                                                    setIsProjectedModalVisible(false);
                                                    router.push(`/session/${session.id}` as any);
                                                }}
                                                onLongPress={session.is_guest ? undefined : () => requestListDelete(session, 'projected')}
                                                className="flex-row items-center justify-between mb-4 border-b border-gray-50 dark:border-gray-800/50 pb-4"
                                            >
                                                <View className="flex-1 pr-4">
                                                    <Text className="text-base font-bold text-gray-900 dark:text-white mb-1">
                                                        {sessionDisplayTitle(session, t)}
                                                    </Text>
                                                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                                                        {d}/{m}/{y} • {sessionDisplaySubtitle(session)}
                                                    </Text>
                                                </View>
                                                <View className="flex-row items-center">
                                                    <Text className="text-lg font-bold text-gray-400 dark:text-gray-500 mr-2">
                                                        +{session.calculatedEarned.toFixed(0)} {session.currency || '€'}
                                                    </Text>
                                                    <ChevronRight size={16} color={isDark ? '#4B5563' : '#9CA3AF'} />
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })
                                ) : (
                                    <Text className="text-sm text-gray-500 dark:text-gray-400 italic mb-4">
                                        No hay sesiones pendientes.
                                    </Text>
                                )}
                            </View>

                            {/* EARNED SESSIONS */}
                            <View>
                                <Text className="text-xs font-bold text-green-600 dark:text-green-500 uppercase tracking-wider mb-4">
                                    {t('workflow.finished')} ({earnedSessionsList.length})
                                </Text>
                                {earnedSessionsList.length > 0 ? (
                                    earnedSessionsList.map((session, index) => {
                                        const [y, m, d] = session.date.split('-');
                                        return (
                                            <TouchableOpacity
                                                key={session.id || index}
                                                activeOpacity={0.7}
                                                onPress={() => {
                                                    setIsProjectedModalVisible(false);
                                                    router.push(`/session/${session.id}` as any);
                                                }}
                                                onLongPress={session.is_guest ? undefined : () => requestListDelete(session, 'projected')}
                                                className="flex-row items-center justify-between mb-4 border-b border-gray-50 dark:border-gray-800/50 pb-4"
                                            >
                                                <View className="flex-1 pr-4">
                                                    <Text className="text-base font-bold text-gray-900 dark:text-white mb-1">
                                                        {sessionDisplayTitle(session, t)}
                                                    </Text>
                                                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                                                        {d}/{m}/{y} • {sessionDisplaySubtitle(session)}
                                                    </Text>
                                                </View>
                                                <View className="flex-row items-center">
                                                    <Text className="text-lg font-bold text-green-600 dark:text-green-500 opacity-90 mr-2">
                                                        +{session.calculatedEarned.toFixed(0)} {session.currency || '€'}
                                                    </Text>
                                                    <ChevronRight size={16} color={isDark ? '#4B5563' : '#9CA3AF'} />
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })
                                ) : (
                                    <Text className="text-sm text-gray-500 dark:text-gray-400 italic">
                                        No hay sesiones completadas aún.
                                    </Text>
                                )}
                            </View>

                        </ScrollView>
                    </View>
                </View>
            </Modal>
            {deletion.dialog}
        </SafeAreaView >
    );
}
