import React, { useMemo, useState, useContext, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Modal,
    Pressable,
    Dimensions,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Calendar as CalendarIcon,
    ChevronRight,
    MapPin,
    Clock,
    Users,
    Search,
    Filter,
    X,
    Check,
    Plus
} from 'lucide-react-native';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useAllSessionsQuery } from '../../src/hooks/useSessionsQuery';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { Avatar } from '../../src/components/ui/Avatar';
import { useRouter } from 'expo-router';
import { format, parseISO, isSameMonth, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es, enUS, de, fr, it, ptBR, ja } from 'date-fns/locale';

import { Calendar, LocaleConfig } from 'react-native-calendars';

import { setupCalendarLocales } from '../../src/i18n/calendarLocales';

setupCalendarLocales();

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

export default function HistoryScreen() {
    const { t, i18n, currentLanguage } = useTranslation();
    const { session, profile } = useAuthStore();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';
    const router = useRouter();

    const { data: sessions, isLoading, refetch, isRefetching } = useAllSessionsQuery();

    // View State
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [isAdvancedModalVisible, setIsAdvancedModalVisible] = useState(false);

    // Advanced Filter States
    const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
    const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
    const [selectedEarningTypes, setSelectedEarningTypes] = useState<string[]>([]);
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);
    const [minEarnings, setMinEarnings] = useState<string>('');
    const [maxEarnings, setMaxEarnings] = useState<string>('');

    // Mini Modals for Calendar pickers
    const [showStartDateCalendar, setShowStartDateCalendar] = useState(false);
    const [showEndDateCalendar, setShowEndDateCalendar] = useState(false);

    // FIX: Move locale setup to useEffect to avoid infinite render loop
    useEffect(() => {
        if (currentLanguage) {
            LocaleConfig.defaultLocale = currentLanguage;
        }
    }, [currentLanguage]);

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

    // Unique Venues for filter
    const uniqueVenues = useMemo(() => {
        if (!sessions) return [];
        const venues = Array.from(new Set(sessions.map(s => s.venue).filter(Boolean)));
        return venues.sort();
    }, [sessions]);

    // Unique Titles for filter
    const uniqueTitles = useMemo(() => {
        if (!sessions) return [];
        const titles = Array.from(new Set(sessions.map(s => s.title).filter(Boolean)));
        return titles.sort();
    }, [sessions]);

    // Filtering Logic
    const filteredSessions = useMemo(() => {
        if (!sessions) return [];

        return sessions.filter(session => {
            // Search Query
            if (searchQuery) {
                const searchLower = searchQuery.toLowerCase();
                const matchesTitle = session.title?.toLowerCase().includes(searchLower);
                const matchesVenue = session.venue?.toLowerCase().includes(searchLower);
                if (!matchesTitle && !matchesVenue) return false;
            }

            // Advanced Filters
            if (selectedVenues.length > 0 && !selectedVenues.includes(session.venue)) return false;
            if (selectedTitles.length > 0 && !selectedTitles.includes(session.title)) return false;
            if (selectedEarningTypes.length > 0 && !selectedEarningTypes.includes(session.earning_type)) return false;

            // Date Range logic (inclusive)
            const sessionDateStr = session.date;
            const normalizedSessionDate = sessionDateStr.substring(0, 10);
            const sDate = parseISO(normalizedSessionDate);

            if (startDate || endDate) {
                const intervalStart = startDate ? parseISO(startDate) : new Date(0);
                const intervalEnd = endDate ? parseISO(endDate) : new Date(8640000000000000);

                if (sDate < intervalStart || sDate > intervalEnd) return false;
            }

            // Earnings Range Filter
            const earnings = calculateSessionEarnings(session);
            const min = parseFloat(minEarnings);
            const max = parseFloat(maxEarnings);

            if (!isNaN(min) && earnings < min) return false;
            if (!isNaN(max) && earnings > max) return false;

            return true;
        });
    }, [sessions, searchQuery, selectedVenues, selectedTitles, selectedEarningTypes, startDate, endDate, minEarnings, maxEarnings]);

    // Calendar Marked Dates Logic
    const calendarMarkedDates = useMemo(() => {
        const marked: any = {};
        filteredSessions.forEach(session => {
            const dateStr = session.date.substring(0, 10);
            const baseColor = session.color || (isDark ? '#3B82F6' : '#2563EB');

            marked[dateStr] = {
                customStyles: {
                    container: {
                        backgroundColor: baseColor,
                        borderRadius: 6,
                    },
                    text: {
                        color: '#FFFFFF',
                        fontWeight: 'bold'
                    }
                }
            };
        });

        // Add selection styling - if selected, we make it even more prominent
        if (selectedCalendarDate) {
            const isToday = selectedCalendarDate === format(new Date(), 'yyyy-MM-dd');
            const hasSessions = !!marked[selectedCalendarDate];

            marked[selectedCalendarDate] = {
                ...marked[selectedCalendarDate],
                customStyles: {
                    container: {
                        backgroundColor: hasSessions
                            ? (marked[selectedCalendarDate].customStyles.container.backgroundColor) // Keep session color
                            : (isDark ? '#1F2937' : '#EFF6FF'), // Or subtle bg if no session
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: '#2563EB', // Primary blue border for selection
                        justifyContent: 'center',
                        alignItems: 'center'
                    },
                    text: {
                        color: hasSessions ? '#FFFFFF' : (isDark ? '#F3F4F6' : '#1D4ED8'),
                        fontWeight: '900'
                    }
                }
            };
        }

        return marked;
    }, [filteredSessions, selectedCalendarDate, isDark]);

    // Sessions for the selected day in calendar view
    const selectedDaySessions = useMemo(() => {
        return filteredSessions.filter(s => s.date.substring(0, 10) === selectedCalendarDate);
    }, [filteredSessions, selectedCalendarDate]);

    // Group filtered sessions by month/year
    const groupedSessions = useMemo(() => {
        const groups: { title: string; data: any[] }[] = [];

        filteredSessions.forEach(session => {
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
    }, [filteredSessions, locale]);

    const resetFilters = () => {
        setSearchQuery('');
        setSelectedVenues([]);
        setSelectedTitles([]);
        setSelectedEarningTypes([]);
        setStartDate(null);
        setEndDate(null);
        setMinEarnings('');
        setMaxEarnings('');
    };

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (selectedVenues.length > 0) count++;
        if (selectedTitles.length > 0) count++;
        if (selectedEarningTypes.length > 0) count++;
        if (startDate || endDate) count++;
        if (minEarnings !== '' || maxEarnings !== '') count++;
        return count;
    }, [selectedVenues, selectedTitles, selectedEarningTypes, startDate, endDate, minEarnings, maxEarnings]);

    if (isLoading && !isRefetching) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-gray-950 items-center justify-center">
                <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#2563EB'} />
            </SafeAreaView>
        );
    }

    const renderSessionCard = (session: any) => {
        const dateObj = parseISO(session.date);
        const d = format(dateObj, 'd');
        const mName = format(dateObj, 'MMM', { locale });
        const wName = format(dateObj, 'EEE', { locale });
        const earnings = calculateSessionEarnings(session);

        return (
            <TouchableOpacity
                key={session.id}
                activeOpacity={0.7}
                onPress={() => router.push(`/session/${session.id}`)}
                className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden flex-row items-stretch mb-4"
            >
                <View className="w-24 h-24 items-center justify-center m-2 rounded-xl" style={{ backgroundColor: session.color || '#262626' }}>
                    <Text className="text-[10px] font-bold uppercase mb-1" style={{ color: session.color && session.color !== '#262626' ? '#E5E5E5' : '#A3A3A3', opacity: session.color && session.color !== '#262626' ? 0.9 : 0.8 }}>
                        {wName}
                    </Text>
                    <Text className="font-extrabold text-2xl leading-none mb-0.5" style={{ color: session.color && session.color !== '#262626' ? '#FFFFFF' : '#A3A3A3' }}>
                        {d}
                    </Text>
                    <Text className="text-[10px] font-bold uppercase" style={{ color: session.color && session.color !== '#262626' ? '#E5E5E5' : '#A3A3A3', opacity: session.color && session.color !== '#262626' ? 0.9 : 0.8 }}>
                        {mName}
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
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-950" edges={['top']}>
            {/* Header */}
            <View className="px-6 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 justify-center">
                <View className="flex-row items-center justify-center h-10">
                    {/* Centered Title */}
                    <View className="absolute left-0 right-0 items-center justify-center">
                        <Text className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
                            {t('history')}
                        </Text>
                    </View>

                    {/* Right Actions */}
                    <View className="flex-row items-center gap-3 ml-auto">
                        <TouchableOpacity
                            onPress={() => router.push('/add-session')}
                            className="w-8 h-8 rounded-full bg-blue-600 items-center justify-center shadow-lg shadow-blue-500/30"
                        >
                            <Plus size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Avatar
                            url={profile?.avatar_url}
                            name={session?.user?.email || '?'}
                            size="md"
                            onPress={() => router.push('/settings')}
                        />
                    </View>
                </View>
            </View>

            {/* Sub-Header: Controls */}
            <View className="px-6 pt-4 flex-row items-center justify-between">
                {/* View Switcher */}
                <View className="flex-row bg-gray-100 dark:bg-gray-900 rounded-full p-1">
                    <TouchableOpacity
                        onPress={() => setViewMode('list')}
                        className={`px-4 py-1.5 rounded-full ${viewMode === 'list' ? 'bg-white dark:bg-gray-800' : ''}`}
                    >
                        <Text className={`text-xs font-bold ${viewMode === 'list' ? 'text-blue-600' : 'text-gray-400'}`}>
                            {t('view_list')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setViewMode('calendar')}
                        className={`px-4 py-1.5 rounded-full ${viewMode === 'calendar' ? 'bg-white dark:bg-gray-800' : ''}`}
                    >
                        <Text className={`text-xs font-bold ${viewMode === 'calendar' ? 'text-blue-600' : 'text-gray-400'}`}>
                            {t('view_calendar')}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Advanced Filter Trigger */}
                <TouchableOpacity
                    onPress={() => setIsAdvancedModalVisible(true)}
                    className={`w-9 h-9 rounded-full items-center justify-center ${activeFiltersCount > 0 ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-900'}`}
                >
                    <Filter size={18} color={activeFiltersCount > 0 ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#4B5563')} />
                    {activeFiltersCount > 0 && (
                        <View className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white dark:border-gray-950 items-center justify-center">
                            <Text className="text-[10px] font-bold text-white">{activeFiltersCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View className="px-6 mt-4">
                <View className="flex-row items-center bg-gray-100 dark:bg-gray-900 rounded-2xl px-4 py-3 border border-gray-100 dark:border-gray-800">
                    <Search size={20} color={isDark ? '#4B5563' : '#9CA3AF'} />
                    <TextInput
                        className="flex-1 ml-3 text-gray-900 dark:text-white font-medium"
                        placeholder={t('search_placeholder')}
                        placeholderTextColor={isDark ? '#4B5563' : '#9CA3AF'}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery !== '' && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={18} color={isDark ? '#4B5563' : '#9CA3AF'} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>


            {viewMode === 'list' ? (
                <ScrollView
                    className="flex-1 px-6 mt-2"
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
                            <View className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full items-center justify-center mb-4 border border-gray-100 dark:border-gray-800">
                                <CalendarIcon size={32} color={isDark ? '#4B5563' : '#9CA3AF'} />
                            </View>
                            <Text className="text-gray-500 dark:text-gray-400 text-lg font-bold text-center px-10">
                                {searchQuery || activeFiltersCount > 0 ? t('no_results_filtered') : t('no_sessions_yet')}
                            </Text>
                            {(searchQuery !== '' || activeFiltersCount > 0) && (
                                <TouchableOpacity
                                    onPress={resetFilters}
                                    className="mt-6 px-6 py-3 bg-gray-100 dark:bg-gray-900 rounded-full"
                                >
                                    <Text className="text-blue-600 dark:text-blue-400 font-bold">{t('filter_reset')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        groupedSessions.map((group, groupIdx) => (
                            <View key={group.title} className={groupIdx === 0 ? "mt-4" : "mt-8"}>
                                <Text className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 ml-1">
                                    {group.title}
                                </Text>

                                <View className="flex-col">
                                    {group.data.map(session => renderSessionCard(session))}
                                </View>
                            </View>
                        ))
                    )}
                    <View className="h-20" />
                </ScrollView>
            ) : (
                <ScrollView className="flex-1 mt-4" showsVerticalScrollIndicator={false}>
                    <View className="px-6">
                        <View className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800">
                            <Calendar
                                key={JSON.stringify(calendarMarkedDates)}
                                markingType={'custom'}
                                current={selectedCalendarDate}
                                markedDates={calendarMarkedDates}
                                onDayPress={(day: any) => setSelectedCalendarDate(day.dateString)}
                                theme={{
                                    calendarBackground: isDark ? '#111827' : '#ffffff',
                                    textSectionTitleColor: isDark ? '#9CA3AF' : '#b6c1cd',
                                    selectedDayBackgroundColor: '#2563EB',
                                    selectedDayTextColor: '#ffffff',
                                    todayTextColor: '#2563EB',
                                    dayTextColor: isDark ? '#F3F4F6' : '#2d4150',
                                    textDisabledColor: isDark ? '#374151' : '#d9e1e8',
                                    dotColor: '#2563EB',
                                    selectedDotColor: '#ffffff',
                                    arrowColor: '#2563EB',
                                    monthTextColor: isDark ? '#F3F4F6' : '#2d4150',
                                    indicatorColor: '#2563EB',
                                    textDayFontWeight: '600',
                                    textMonthFontWeight: 'bold',
                                    textDayHeaderFontWeight: 'bold',
                                }}
                            />
                        </View>
                    </View>

                    <View className="px-6 mt-8">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                {format(parseISO(selectedCalendarDate), 'd MMMM yyyy', { locale: locale })}
                            </Text>
                            <Text className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
                                {selectedDaySessions.length} {t('sessions')}
                            </Text>
                        </View>

                        {selectedDaySessions.length === 0 ? (
                            <View className="py-12 items-center justify-center bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                                <Text className="text-gray-400 dark:text-gray-500 font-medium">
                                    {t('no_sessions_this_day')}
                                </Text>
                            </View>
                        ) : (
                            <View className="flex-col">
                                {selectedDaySessions.map(session => renderSessionCard(session))}
                            </View>
                        )}
                    </View>
                    <View className="h-24" />
                </ScrollView>
            )}

            {/* Advanced Filter Modal */}
            <Modal
                visible={isAdvancedModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsAdvancedModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1"
                >
                    <View className="flex-1 justify-end bg-black/50">
                        <Pressable className="flex-1" onPress={() => setIsAdvancedModalVisible(false)} />
                        <View className="bg-white dark:bg-gray-950 rounded-t-[40px] px-6 pt-8 pb-10 max-h-[90%]">
                            <View className="flex-row items-center justify-between mb-8">
                                <Text className="text-2xl font-black text-gray-900 dark:text-white">
                                    {t('filters_title')}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setIsAdvancedModalVisible(false)}
                                    className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-900 items-center justify-center"
                                >
                                    <X size={24} color={isDark ? '#FFFFFF' : '#000000'} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Date Range Section */}
                                <View className="mb-8">
                                    <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
                                        {t('filter_date_range')}
                                    </Text>
                                    <View className="flex-row gap-4">
                                        <TouchableOpacity
                                            onPress={() => setShowStartDateCalendar(true)}
                                            className="flex-1 px-4 py-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex-row items-center justify-between"
                                        >
                                            <View>
                                                <Text className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">{t('filter_start_date')}</Text>
                                                <Text className={`font-bold ${startDate ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`}>
                                                    {startDate ? format(parseISO(startDate), 'dd/MM/yyyy') : '--/--/----'}
                                                </Text>
                                            </View>
                                            <CalendarIcon size={16} color={startDate ? '#2563EB' : '#9CA3AF'} />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => setShowEndDateCalendar(true)}
                                            className="flex-1 px-4 py-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex-row items-center justify-between"
                                        >
                                            <View>
                                                <Text className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">{t('filter_end_date')}</Text>
                                                <Text className={`font-bold ${endDate ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`}>
                                                    {endDate ? format(parseISO(endDate), 'dd/MM/yyyy') : '--/--/----'}
                                                </Text>
                                            </View>
                                            <CalendarIcon size={16} color={endDate ? '#2563EB' : '#9CA3AF'} />
                                        </TouchableOpacity>
                                    </View>
                                    {(startDate || endDate) && (
                                        <TouchableOpacity
                                            onPress={() => { setStartDate(null); setEndDate(null); }}
                                            className="mt-2"
                                        >
                                            <Text className="text-xs font-bold text-red-500 ml-1">{t('filter_reset')}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Venues Section */}
                                <View className="mb-8">
                                    <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
                                        {t('filter_venues_title')}
                                    </Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {uniqueVenues.map(venue => {
                                            const isSelected = selectedVenues.includes(venue);
                                            return (
                                                <TouchableOpacity
                                                    key={venue}
                                                    onPress={() => {
                                                        if (isSelected) {
                                                            setSelectedVenues(selectedVenues.filter(v => v !== venue));
                                                        } else {
                                                            setSelectedVenues([...selectedVenues, venue]);
                                                        }
                                                    }}
                                                    className={`px-4 py-2 rounded-xl border ${isSelected
                                                        ? 'bg-blue-600 border-blue-600'
                                                        : 'bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800'
                                                        }`}
                                                >
                                                    <Text className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-600 dark:text-gray-400'
                                                        }`}>
                                                        {venue}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Titles (Fiestas) Section */}
                                <View className="mb-8">
                                    <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
                                        {t('filter_titles_title')}
                                    </Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {uniqueTitles.map(title => {
                                            const isSelected = selectedTitles.includes(title);
                                            return (
                                                <TouchableOpacity
                                                    key={title}
                                                    onPress={() => {
                                                        if (isSelected) {
                                                            setSelectedTitles(selectedTitles.filter(t => t !== title));
                                                        } else {
                                                            setSelectedTitles([...selectedTitles, title]);
                                                        }
                                                    }}
                                                    className={`px-4 py-2 rounded-xl border ${isSelected
                                                        ? 'bg-blue-600 border-blue-600'
                                                        : 'bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800'
                                                        }`}
                                                >
                                                    <Text className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-600 dark:text-gray-400'
                                                        }`}>
                                                        {title}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Earning Types Section */}
                                <View className="mb-8">
                                    <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
                                        {t('filter_earning_types_title')}
                                    </Text>
                                    <View className="flex-row gap-2">
                                        {[
                                            { id: 'fixed', label: t('earning_fixed') },
                                            { id: 'hourly', label: t('earning_hourly') },
                                            { id: 'free', label: t('earning_free') }
                                        ].map(type => {
                                            const isSelected = selectedEarningTypes.includes(type.id);
                                            return (
                                                <TouchableOpacity
                                                    key={type.id}
                                                    onPress={() => {
                                                        if (isSelected) {
                                                            setSelectedEarningTypes(selectedEarningTypes.filter(t => t !== type.id));
                                                        } else {
                                                            setSelectedEarningTypes([...selectedEarningTypes, type.id]);
                                                        }
                                                    }}
                                                    className={`flex-1 px-4 py-3 rounded-xl border items-center ${isSelected
                                                        ? 'bg-blue-600 border-blue-600'
                                                        : 'bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800'
                                                        }`}
                                                >
                                                    <Text className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-600 dark:text-gray-400'
                                                        }`}>
                                                        {type.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Earnings Range Section */}
                                <View className="mb-8">
                                    <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
                                        {t('filter_earnings_range')}
                                    </Text>
                                    <View className="flex-row gap-4">
                                        <View className="flex-1 px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex-row items-center">
                                            <Text className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mr-2">{t('filter_min_earnings')}</Text>
                                            <TextInput
                                                className="flex-1 font-bold text-gray-900 dark:text-white"
                                                placeholder="0"
                                                placeholderTextColor="#9CA3AF"
                                                keyboardType="numeric"
                                                value={minEarnings}
                                                onChangeText={setMinEarnings}
                                            />
                                            <Text className="text-xs font-bold text-gray-400 dark:text-gray-500 ml-1">€</Text>
                                        </View>
                                        <View className="flex-1 px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex-row items-center">
                                            <Text className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mr-2">{t('filter_max_earnings')}</Text>
                                            <TextInput
                                                className="flex-1 font-bold text-gray-900 dark:text-white"
                                                placeholder="9999"
                                                placeholderTextColor="#9CA3AF"
                                                keyboardType="numeric"
                                                value={maxEarnings}
                                                onChangeText={setMaxEarnings}
                                            />
                                            <Text className="text-xs font-bold text-gray-400 dark:text-gray-500 ml-1">€</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* More filters can be added here like Date Range Picker */}

                            </ScrollView>

                            {/* Footer Buttons */}
                            <View className="flex-row gap-4 mt-8">
                                <TouchableOpacity
                                    onPress={resetFilters}
                                    className="flex-1 py-4 rounded-2xl bg-gray-100 dark:bg-gray-900 items-center"
                                >
                                    <Text className="text-gray-900 dark:text-white font-bold">{t('filter_reset')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setIsAdvancedModalVisible(false)}
                                    className="flex-[2] py-4 rounded-2xl bg-blue-600 items-center"
                                >
                                    <Text className="text-white font-black">{t('filter_apply')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
            {/* Start Date Picker Modal */}
            <Modal visible={showStartDateCalendar} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/60 px-6">
                    <View className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden w-full max-w-sm">
                        <Calendar
                            current={startDate || undefined}
                            markedDates={startDate ? {
                                [startDate]: { selected: true, selectedColor: '#2563EB' }
                            } : {}}
                            onDayPress={(day: any) => {
                                setStartDate(day.dateString);
                                setShowStartDateCalendar(false);
                            }}
                            theme={{
                                calendarBackground: isDark ? '#111827' : '#ffffff',
                                textSectionTitleColor: isDark ? '#9CA3AF' : '#b6c1cd',
                                selectedDayBackgroundColor: '#2563EB',
                                selectedDayTextColor: '#ffffff',
                                todayTextColor: '#2563EB',
                                dayTextColor: isDark ? '#F3F4F6' : '#2d4150',
                                textDisabledColor: isDark ? '#374151' : '#d9e1e8',
                                dotColor: '#2563EB',
                                selectedDotColor: '#ffffff',
                                arrowColor: '#2563EB',
                                monthTextColor: isDark ? '#F3F4F6' : '#2d4150',
                                indicatorColor: '#2563EB',
                            }}
                        />
                        <TouchableOpacity
                            onPress={() => setShowStartDateCalendar(false)}
                            className="p-4 items-center border-t border-gray-100 dark:border-gray-800"
                        >
                            <Text className="text-gray-500 font-bold">{t('cancel')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* End Date Picker Modal */}
            <Modal visible={showEndDateCalendar} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/60 px-6">
                    <View className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden w-full max-w-sm">
                        <Calendar
                            current={endDate || undefined}
                            markedDates={endDate ? {
                                [endDate]: { selected: true, selectedColor: '#2563EB' }
                            } : {}}
                            onDayPress={(day: any) => {
                                setEndDate(day.dateString);
                                setShowEndDateCalendar(false);
                            }}
                            theme={{
                                calendarBackground: isDark ? '#111827' : '#ffffff',
                                textSectionTitleColor: isDark ? '#9CA3AF' : '#b6c1cd',
                                selectedDayBackgroundColor: '#2563EB',
                                selectedDayTextColor: '#ffffff',
                                todayTextColor: '#2563EB',
                                dayTextColor: isDark ? '#F3F4F6' : '#2d4150',
                                textDisabledColor: isDark ? '#374151' : '#d9e1e8',
                                dotColor: '#2563EB',
                                selectedDotColor: '#ffffff',
                                arrowColor: '#2563EB',
                                monthTextColor: isDark ? '#F3F4F6' : '#2d4150',
                                indicatorColor: '#2563EB',
                            }}
                        />
                        <TouchableOpacity
                            onPress={() => setShowEndDateCalendar(false)}
                            className="p-4 items-center border-t border-gray-100 dark:border-gray-800"
                        >
                            <Text className="text-gray-500 font-bold">{t('cancel')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
