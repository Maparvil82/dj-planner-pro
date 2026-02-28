import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useRouter } from 'expo-router';
import { Avatar } from '../../src/components/ui/Avatar';
import { useSessionsQuery, useUpcomingSessionsQuery } from '../../src/hooks/useSessionsQuery';
import { CalendarPlus, Inbox, Users, TrendingUp, Wallet, ChevronRight, X } from 'lucide-react-native';
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
    const [isEarningsModalVisible, setIsEarningsModalVisible] = useState(false);
    const [isProjectedModalVisible, setIsProjectedModalVisible] = useState(false);
    // Calendar localization is now handled where the calendar is used

    const { data: upcomingSessions, isLoading: isLoadingUpcoming } = useUpcomingSessionsQuery();

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentMonthName = new Intl.DateTimeFormat(currentLanguage, { month: 'long' }).format(now);
    const capitalizedMonthName = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

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

    const { earnedSoFar, projectedTotal, earnedCount, projectedCount, earnedData, projectedData, earnedSessionsList, pendingSessionsList } = useMemo(() => {
        if (!monthSessions) return { earnedSoFar: 0, projectedTotal: 0, earnedCount: 0, projectedCount: 0, earnedData: [], projectedData: [], earnedSessionsList: [], pendingSessionsList: [] };

        let earned = 0;
        let projected = 0;
        let eCount = 0;
        let pCount = 0;

        const earnedMap: Record<string, number> = {};
        const projectedMap: Record<string, number> = {};
        const earnedSessionsList: any[] = [];
        const pendingSessionsList: any[] = [];

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTotalMinutes = currentHour * 60 + currentMinute;

        monthSessions.forEach((session: any) => {
            const amount = calculateSessionEarnings(session);
            const color = session.color || '#3B82F6';

            projected += amount;
            projectedMap[color] = (projectedMap[color] || 0) + amount;
            pCount++;

            let isEarned = false;
            if (session.date < todayStr) {
                isEarned = true;
            } else if (session.date === todayStr) {
                const [endH, endM] = (session.end_time || '23:59').split(':').map(Number);
                let endTotalMinutes = endH * 60 + endM;

                // Si la sesión termina al día siguiente (ej. 03:00 am pero empieza el 'mismo' día)
                // consideramos la lógica real del DJ: si la hora de fin es muy temprana (ej. 00-06h), 
                // realmente pertenece a la madrugada siguiente.
                // Como es una aproximación simple, si los minutos de fin son menores o iguales a la hora actual, ha terminado.
                // Para ser estrictos: si la sesión pasa de las 12 (endT < startT), entonces hoy no ha terminado a no ser que estemos en esa madrugada.
                // Simplificando usando la hora calculada:
                const [startH, startM] = (session.start_time || '00:00').split(':').map(Number);
                const startTotalMinutes = startH * 60 + startM;

                if (endTotalMinutes <= startTotalMinutes) endTotalMinutes += 24 * 60; // cruza la medianoche

                // También ajustamos la hora actual si "sigue" a la sesión en la madrugada
                let adjustedCurrentMinutes = currentTotalMinutes;
                if (currentTotalMinutes < 12 * 60 && startTotalMinutes > 12 * 60) {
                    adjustedCurrentMinutes += 24 * 60;
                }

                if (adjustedCurrentMinutes >= endTotalMinutes) {
                    isEarned = true;
                }
            }

            if (isEarned) {
                earned += amount;
                earnedMap[color] = (earnedMap[color] || 0) + amount;
                eCount++;
                if (amount > 0) {
                    earnedSessionsList.push({ ...session, calculatedEarned: amount });
                }
            } else {
                if (amount > 0) {
                    pendingSessionsList.push({ ...session, calculatedEarned: amount });
                }
            }
        });

        const earnedData = Object.keys(earnedMap).map(color => ({ color, value: earnedMap[color] }));
        const projectedData = Object.keys(projectedMap).map(color => ({ color, value: projectedMap[color] }));

        earnedSessionsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        pendingSessionsList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return { earnedSoFar: earned, projectedTotal: projected, earnedCount: eCount, projectedCount: pCount, earnedData, projectedData, earnedSessionsList, pendingSessionsList };
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
                    <View className="flex-row gap-4 px-2">
                        {/* Earned So Far Card */}
                        <TouchableOpacity
                            className="flex-1 bg-white dark:bg-gray-900 rounded-xl p-5 shadow-sm shadow-black/5 border border-indigo-100 dark:border-indigo-900/40"
                            activeOpacity={0.7}
                            onPress={() => setIsEarningsModalVisible(true)}
                        >

                            <View className="flex-row items-center justify-between mb-1">
                                <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('earned_so_far') || 'Llevas ganado'}
                                </Text>
                                <ChevronRight size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                            </View>

                            <View className="flex-row items-baseline mt-5">
                                <Text className="text-5xl text-gray-900 dark:text-white">
                                    {earnedSoFar.toFixed(0)}
                                </Text>
                                <Text className="text-lg font-bold text-gray-500 dark:text-gray-400 ml-1 mb-1">€</Text>
                            </View>
                            <Text className="text-sm font-medium text-gray-400 dark:text-gray-500 mt-2 flex-wrap">
                                {capitalizedMonthName} • {earnedCount} {earnedCount === 1 ? (t('session')?.toLowerCase() || 'sesión') : (t('sessions')?.toLowerCase() || 'sesiones')}
                            </Text>
                        </TouchableOpacity>

                        {/* Projected Total Card */}
                        <TouchableOpacity
                            className="flex-1 bg-neutral-800 dark:bg-emerald-900/20 rounded-xl  p-5 shadow-sm shadow-black/5 border border-neutral-200 dark:border-emerald-800/40"
                            activeOpacity={0.7}
                            onPress={() => setIsProjectedModalVisible(true)}
                        >

                            <View className="flex-row items-center justify-between mb-1">
                                <Text className="text-xs font-semibold text-neutral-400 dark:text-green-400 uppercase tracking-wider">
                                    {t('projected_total') || 'Prevees ganar'}
                                </Text>
                                <ChevronRight size={16} color={isDark ? '#oklch(70.8% 0 0) / 50' : '#6B7280'} />
                            </View>

                            <View className="flex-row items-baseline mt-5">
                                <Text className="text-5xl text-neutral-400 dark:text-emerald-400">
                                    {projectedTotal.toFixed(0)}
                                </Text>
                                <Text className="text-lg font-bold text-neutral-400 dark:text-emerald-500/80 ml-1 mb-1">€</Text>
                            </View>
                            <Text className="text-sm font-medium text-neutral-400 dark:text-emerald-500/60 mt-2 flex-wrap">
                                {capitalizedMonthName} • {projectedCount} {projectedCount === 1 ? (t('session')?.toLowerCase() || 'sesión') : (t('sessions')?.toLowerCase() || 'sesiones')}
                            </Text>
                        </TouchableOpacity>
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
                                className="px-3 py-1.5 rounded-full"
                                style={{
                                    backgroundColor: sessionFilter === 'all' ? (isDark ? '#4B5563' : '#FFFFFF') : 'transparent',
                                }}
                            >
                                <Text className="text-xs font-bold"
                                    style={{
                                        color: sessionFilter === 'all' ? (isDark ? '#FFFFFF' : '#111827') : (isDark ? '#9CA3AF' : '#6B7280')
                                    }}>
                                    {t('filter_all') || 'Todas'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setSessionFilter('month')}
                                className="px-3 py-1.5 rounded-full"
                                style={{
                                    backgroundColor: sessionFilter === 'month' ? (isDark ? '#4B5563' : '#FFFFFF') : 'transparent',
                                }}
                            >
                                <Text className="text-xs font-bold"
                                    style={{
                                        color: sessionFilter === 'month' ? (isDark ? '#FFFFFF' : '#111827') : (isDark ? '#9CA3AF' : '#6B7280')
                                    }}>
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
                            {filteredUpcomingSessions.map((session: any, index: number, array: any[]) => {
                                const [y, m, d] = session.date.split('-');
                                const sessionDateObj = new Date(Number(y), Number(m) - 1, Number(d));
                                const monthName = sessionDateObj.toLocaleDateString(currentLanguage, { month: 'short' });
                                const weekdayName = sessionDateObj.toLocaleDateString(currentLanguage, { weekday: 'short' });

                                const fullMonthName = sessionDateObj.toLocaleDateString(currentLanguage, { month: 'long', year: 'numeric' });
                                const capitalizedFullMonth = fullMonthName.charAt(0).toUpperCase() + fullMonthName.slice(1);

                                let showMonthHeader = false;
                                if (index === 0) {
                                    showMonthHeader = true;
                                } else {
                                    const prevSession = array[index - 1];
                                    const [prevY, prevM] = prevSession.date.split('-');
                                    if (prevY !== y || prevM !== m) {
                                        showMonthHeader = true;
                                    }
                                }

                                return (
                                    <View key={session.id}>
                                        {showMonthHeader && (
                                            <Text className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-4 mb-4 uppercase tracking-wider ml-1">
                                                {capitalizedFullMonth}
                                            </Text>
                                        )}
                                        <View className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm shadow-black/5 rounded-xl overflow-hidden flex-row items-stretch mb-3">
                                            <View className="w-32 items-center justify-center" style={{ backgroundColor: (session.color || '#3B82F6') + '26' }}>
                                                <Text className="text-xs font-bold uppercase mb-2" style={{ color: session.color || '#3B82F6', opacity: 0.8 }}>
                                                    {weekdayName}
                                                </Text>
                                                <Text className="font-extrabold text-2xl leading-none mb-0.5" style={{ color: session.color || '#3B82F6' }}>
                                                    {d}
                                                </Text>
                                                <Text className="text-xs font-bold uppercase" style={{ color: session.color || '#3B82F6', opacity: 0.8 }}>
                                                    {monthName}
                                                </Text>
                                            </View>
                                            <View className="flex-1 flex-row items-center p-4">
                                                <View className="flex-1 mr-3">
                                                    <Text className="text-lg font-bold text-gray-900 dark:text-white mb-1" numberOfLines={1}>{session.title}</Text>
                                                    <Text className="text-gray-500 dark:text-gray-400 text-sm mb-3" numberOfLines={1}>{session.venue}</Text>
                                                    <View className="flex-row items-center flex-wrap gap-2">
                                                        <Text className="text-xs font-medium px-2 py-1 rounded-md overflow-hidden bg-gray-50 dark:bg-gray-800/50" style={{ color: session.color || '#3B82F6' }}>{session.start_time} - {session.end_time}</Text>

                                                        {session.is_collective && session.djs && session.djs.length > 0 && (
                                                            <View className="flex-row items-center px-1.5 py-1 bg-gray-50 dark:bg-gray-800/50 rounded-md max-w-[50%]">
                                                                <Users size={12} color={isDark ? '#9CA3AF' : '#6B7280'} className="mr-1" />
                                                                <Text className="text-xs font-medium text-gray-600 dark:text-gray-400" numberOfLines={1}>
                                                                    {session.djs.join(', ')}
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>

                                                {session.earning_type && session.earning_type !== 'free' && (
                                                    <View className="items-end justify-center">
                                                        <View className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800/30">
                                                            <Text className="text-xs font-bold text-green-700 dark:text-green-400">
                                                                {calculateSessionEarnings(session)} €
                                                            </Text>
                                                        </View>
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

            {/* EARNINGS HISTORY MODAL */}
            <Modal
                visible={isEarningsModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsEarningsModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white dark:bg-gray-900 rounded-t-3xl max-h-[85%]">
                        <View className="flex-row items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
                            <Text className="text-xl font-bold text-gray-900 dark:text-white">
                                {t('earned_history') || 'Historial de ingresos'} - {capitalizedMonthName}
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
                                        <View key={session.id || index} className="flex-row items-center justify-between mb-4 border-b border-gray-50 dark:border-gray-800/50 pb-4">
                                            <View className="flex-1 pr-4">
                                                <Text className="text-base font-bold text-gray-900 dark:text-white mb-1">
                                                    {session.title}
                                                </Text>
                                                <Text className="text-sm text-gray-500 dark:text-gray-400">
                                                    {d}/{m}/{y} • {session.venue}
                                                </Text>
                                            </View>
                                            <Text className="text-lg font-bold text-green-600 dark:text-green-500 opacity-90">
                                                +{session.calculatedEarned.toFixed(0)} {session.currency || '€'}
                                            </Text>
                                        </View>
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
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white dark:bg-gray-900 rounded-t-3xl max-h-[85%]">
                        <View className="flex-row items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
                            <Text className="text-xl font-bold text-gray-900 dark:text-white">
                                {t('projected_total') || 'Previsión de ingresos'} - {capitalizedMonthName}
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
                                    Pendientes ({pendingSessionsList.length})
                                </Text>
                                {pendingSessionsList.length > 0 ? (
                                    pendingSessionsList.map((session, index) => {
                                        const [y, m, d] = session.date.split('-');
                                        return (
                                            <View key={session.id || index} className="flex-row items-center justify-between mb-4 border-b border-gray-50 dark:border-gray-800/50 pb-4">
                                                <View className="flex-1 pr-4">
                                                    <Text className="text-base font-bold text-gray-900 dark:text-white mb-1">
                                                        {session.title}
                                                    </Text>
                                                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                                                        {d}/{m}/{y} • {session.venue}
                                                    </Text>
                                                </View>
                                                <Text className="text-lg font-bold text-gray-400 dark:text-gray-500">
                                                    +{session.calculatedEarned.toFixed(0)} {session.currency || '€'}
                                                </Text>
                                            </View>
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
                                    Ya completadas ({earnedSessionsList.length})
                                </Text>
                                {earnedSessionsList.length > 0 ? (
                                    earnedSessionsList.map((session, index) => {
                                        const [y, m, d] = session.date.split('-');
                                        return (
                                            <View key={session.id || index} className="flex-row items-center justify-between mb-4 border-b border-gray-50 dark:border-gray-800/50 pb-4">
                                                <View className="flex-1 pr-4">
                                                    <Text className="text-base font-bold text-gray-900 dark:text-white mb-1 opacity-70">
                                                        {session.title}
                                                    </Text>
                                                    <Text className="text-sm text-gray-500 dark:text-gray-400 opacity-70">
                                                        {d}/{m}/{y} • {session.venue}
                                                    </Text>
                                                </View>
                                                <Text className="text-lg font-bold text-green-600 dark:text-green-500 opacity-90">
                                                    +{session.calculatedEarned.toFixed(0)} {session.currency || '€'}
                                                </Text>
                                            </View>
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
        </SafeAreaView >
    );
}
