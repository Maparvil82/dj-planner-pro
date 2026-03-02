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
                            <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 ml-1">
                                {group.title}
                            </Text>

                            <View className="space-y-4">
                                {group.data.map((session) => (
                                    <TouchableOpacity
                                        key={session.id}
                                        onPress={() => router.push(`/session/${session.id}`)}
                                        activeOpacity={0.7}
                                        className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm shadow-black/5"
                                    >
                                        <View className="flex-row items-center justify-between mb-3">
                                            <View className="flex-row items-center flex-1">
                                                <View
                                                    className="w-3 h-3 rounded-full mr-3"
                                                    style={{ backgroundColor: session.color || '#2563EB' }}
                                                />
                                                <Text className="text-lg font-bold text-gray-900 dark:text-white flex-1" numberOfLines={1}>
                                                    {session.title}
                                                </Text>
                                            </View>
                                            <View className="bg-white dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-100 dark:border-gray-700">
                                                <Text className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                                    {format(parseISO(session.date), 'dd MMM', { locale })}
                                                </Text>
                                            </View>
                                        </View>

                                        <View className="flex-row items-center justify-between">
                                            <View className="flex-row items-center space-x-4">
                                                <View className="flex-row items-center">
                                                    <MapPin size={14} color="#9CA3AF" />
                                                    <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1 font-medium" numberOfLines={1}>
                                                        {session.venue}
                                                    </Text>
                                                </View>
                                                <View className="flex-row items-center ml-4">
                                                    <Clock size={14} color="#9CA3AF" />
                                                    <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1 font-medium">
                                                        {session.start_time}
                                                    </Text>
                                                </View>
                                            </View>

                                            <TouchableOpacity
                                                onPress={() => router.push(`/session/${session.id}`)}
                                                className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 items-center justify-center shadow-sm border border-gray-50 dark:border-gray-700"
                                            >
                                                <ChevronRight size={18} color={isDark ? '#F9FAFB' : '#111827'} />
                                            </TouchableOpacity>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ))
                )}
                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
