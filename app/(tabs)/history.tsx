import React, { useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Calendar as CalendarIcon,
    ChevronRight,
    MapPin,
    Clock,
    Users
} from 'lucide-react-native';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useAllSessionsQuery } from '../../src/hooks/useSessionsQuery';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { useContext } from 'react';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { es, enUS, de, fr, it, ptBR, ja } from 'date-fns/locale';

export default function HistoryScreen() {
    const { t, i18n } = useTranslation();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';
    const router = useRouter();

    const { data: sessions, isLoading, refetch, isRefetching } = useAllSessionsQuery();

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

    // Group sessions by month/year
    const groupedSessions = useMemo(() => {
        if (!sessions) return [];

        const groups: { title: string; data: any[] }[] = [];

        sessions.forEach(session => {
            const date = parseISO(session.date);
            const monthYear = format(date, 'MMMM yyyy', { locale });
            const capitalizedMonthYear = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);

            let group = groups.find(g => g.title === capitalizedMonthYear);
            if (!group) {
                group = { title: capitalizedMonthYear, data: [] };
                groups.push(group);
            }
            group.data.push(session);
        });

        return groups;
    }, [sessions, locale]);

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

    if (isLoading && !isRefetching) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-gray-950 items-center justify-center">
                <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#2563EB'} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-950" edges={['top']}>
            <View className="px-6 pt-4 pb-2">
                <Text className="text-3xl font-black text-gray-900 dark:text-white">
                    {t('history')}
                </Text>
            </View>

            <ScrollView
                className="flex-1 px-6"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor={isDark ? '#FFFFFF' : '#000000'}
                    />
                }
            >
                {groupedSessions.length === 0 ? (
                    <View className="py-20 items-center justify-center">
                        <View className="w-20 h-20 bg-gray-100 dark:bg-gray-900 rounded-full items-center justify-center mb-4">
                            <CalendarIcon size={32} color={isDark ? '#4B5563' : '#9CA3AF'} />
                        </View>
                        <Text className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                            {t('no_sessions_yet')}
                        </Text>
                    </View>
                ) : (
                    groupedSessions.map((group, groupIdx) => (
                        <View key={group.title} className={groupIdx === 0 ? "mt-4" : "mt-8"}>
                            <Text className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 ml-1">
                                {group.title}
                            </Text>

                            <View className="flex-col gap-4">
                                {group.data.map((session) => {
                                    const dateObj = parseISO(session.date);
                                    const d = format(dateObj, 'd');
                                    const monthName = format(dateObj, 'MMM', { locale });
                                    const weekdayName = format(dateObj, 'EEE', { locale });
                                    const earnings = calculateSessionEarnings(session);

                                    return (
                                        <TouchableOpacity
                                            key={session.id}
                                            activeOpacity={0.7}
                                            onPress={() => router.push(`/session/${session.id}`)}
                                            className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm shadow-black/5 rounded-xl overflow-hidden flex-row items-stretch"
                                        >
                                            <View className="w-24 h-24 items-center justify-center m-2 rounded-xl" style={{ backgroundColor: session.color || '#262626' }}>
                                                <Text className="text-[10px] font-bold uppercase mb-1" style={{ color: session.color && session.color !== '#262626' ? '#E5E5E5' : '#A3A3A3', opacity: session.color && session.color !== '#262626' ? 0.9 : 0.8 }}>
                                                    {weekdayName}
                                                </Text>
                                                <Text className="font-extrabold text-2xl leading-none mb-0.5" style={{ color: session.color && session.color !== '#262626' ? '#FFFFFF' : '#A3A3A3' }}>
                                                    {d}
                                                </Text>
                                                <Text className="text-[10px] font-bold uppercase" style={{ color: session.color && session.color !== '#262626' ? '#E5E5E5' : '#A3A3A3', opacity: session.color && session.color !== '#262626' ? 0.9 : 0.8 }}>
                                                    {monthName}
                                                </Text>
                                            </View>

                                            <View className="flex-1 flex-row items-center p-4">
                                                <View className="flex-1 mr-3">
                                                    <Text className="text-lg font-bold text-gray-900 dark:text-white mb-1" numberOfLines={1}>
                                                        {session.title}
                                                    </Text>
                                                    <Text className="text-gray-500 dark:text-gray-400 text-sm mb-3" numberOfLines={1}>
                                                        {session.venue}
                                                    </Text>
                                                    <View className="flex-row items-center flex-wrap gap-2">
                                                        <Text className="text-xs font-medium px-2 py-1 rounded-md overflow-hidden bg-gray-50 dark:bg-gray-800/50" style={{ color: session.color || '#3B82F6' }}>
                                                            {session.start_time} - {session.end_time}
                                                        </Text>

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
                                                    <View className="items-end justify-center mr-2">
                                                        <View className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800/30">
                                                            <Text className="text-xs font-bold text-green-700 dark:text-green-400">
                                                                {earnings.toFixed(0)} {session.currency || '€'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                )}

                                                <View className="justify-center items-center ml-1">
                                                    <ChevronRight size={20} color={isDark ? '#4B5563' : '#9CA3AF'} />
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    ))
                )}
                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
