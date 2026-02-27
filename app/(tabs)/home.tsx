import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useRouter } from 'expo-router';
import { Avatar } from '../../src/components/ui/Avatar';
import { useSessionsQuery } from '../../src/hooks/useSessionsQuery';
import { Calendar as CalendarIcon, Inbox } from 'lucide-react-native';
import { useContext, useState } from 'react';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars';

const esConfig: any = {
    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    monthNamesShort: ['Ene.', 'Feb.', 'Mar', 'Abr', 'May', 'Jun', 'Jul.', 'Ago', 'Sept.', 'Oct.', 'Nov.', 'Dic.'],
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['Dom.', 'Lun.', 'Mar.', 'Mié.', 'Jue.', 'Vie.', 'Sáb.'],
    today: 'Hoy'
};
LocaleConfig.locales['es'] = esConfig;
LocaleConfig.defaultLocale = 'es';

export default function HomeScreen() {
    const { t } = useTranslation();
    const { session, profile } = useAuthStore();
    const router = useRouter();
    const themeCtx = useContext(ThemeContext);
    const { data: sessions, isLoading } = useSessionsQuery();

    const isDark = themeCtx?.activeTheme === 'dark';

    const [currentMonth, setCurrentMonth] = useState(() => {
        const d = new Date();
        const monthNames = LocaleConfig.locales['es']?.monthNames;
        const month = monthNames ? monthNames[d.getMonth()] : '';
        return `${month} ${d.getFullYear()}`;
    });

    const handleDayPress = (day: DateData) => {
        router.push({
            pathname: '/(modals)/add-session',
            params: { date: day.dateString }
        });
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
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

            <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>

                {/* MONTH CALENDAR */}
                <View className="bg-white dark:bg-gray-900 rounded-3xl p-6 mb-6 shadow-sm shadow-black/5 border border-gray-100 dark:border-gray-800">
                    <View className="flex-row items-center mb-4">
                        <View className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full items-center justify-center mr-3">
                            {/* @ts-ignore */}
                            <CalendarIcon size={20} color={isDark ? '#60A5FA' : '#2563EB'} />
                        </View>
                        <Text className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                            {currentMonth}
                        </Text>
                    </View>

                    <Calendar
                        theme={{
                            backgroundColor: 'transparent',
                            calendarBackground: 'transparent',
                            textSectionTitleColor: isDark ? '#9CA3AF' : '#6B7280',
                            selectedDayBackgroundColor: '#3B82F6',
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: '#3B82F6',
                            dayTextColor: isDark ? '#D1D5DB' : '#111827',
                            textDisabledColor: isDark ? '#4B5563' : '#D1D5DB',
                            dotColor: '#3B82F6',
                            selectedDotColor: '#ffffff',
                            arrowColor: isDark ? '#60A5FA' : '#3B82F6',
                            monthTextColor: 'transparent', // We hide the default title to use our custom one
                            indicatorColor: '#3B82F6',
                            textDayFontWeight: '500',
                            textMonthFontWeight: 'bold',
                            textDayHeaderFontWeight: '600',
                            textDayFontSize: 16,
                        }}
                        onDayPress={handleDayPress}
                        onMonthChange={(month: DateData) => {
                            const monthNames = LocaleConfig.locales['es']?.monthNames;
                            const mName = monthNames ? monthNames[month.month - 1] : '';
                            setCurrentMonth(`${mName} ${month.year}`);
                        }}
                        hideExtraDays={true}
                    />
                </View>

                {/* UPCOMING SESSIONS */}
                <View>
                    <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4 px-2 tracking-tight">
                        Upcoming Sessions
                    </Text>

                    {isLoading ? (
                        <ActivityIndicator className="mt-8" />
                    ) : sessions && sessions.length > 0 ? (
                        <View>
                            {/* Iteration placeholder */}
                        </View>
                    ) : (
                        <View className="bg-white dark:bg-gray-900 items-center justify-center rounded-3xl p-10 border border-gray-100 dark:border-gray-800 shadow-sm shadow-black/5">
                            <View className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full items-center justify-center mb-4">
                                {/* @ts-ignore */}
                                <Inbox size={28} color={isDark ? '#9CA3AF' : '#6B7280'} />
                            </View>
                            <Text className="text-gray-900 dark:text-white font-bold text-lg mb-1">
                                {t('no_sessions_yet')}
                            </Text>
                            <Text className="text-gray-500 dark:text-gray-400 text-center">
                                Sync with your external calendars to view upcoming sets.
                            </Text>
                        </View>
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}
