import { PageHeader } from '../../src/components/ui/PageHeader';
import { SessionPreviewCard } from '../../src/components/sessions/SessionPreviewCard';
import { sessionEarnings } from '../../src/utils/sessionPlanning';
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
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Filter, X, ArrowLeft } from 'lucide-react-native';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useAllSessionsQuery } from '../../src/hooks/useSessionsQuery';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { es, enUS, de, fr, it, ptBR, ja } from 'date-fns/locale';

import { Calendar, LocaleConfig } from 'react-native-calendars';

import { setupCalendarLocales } from '../../src/i18n/calendarLocales';

setupCalendarLocales();

export default function HistoryScreen() {
    const { t, i18n, currentLanguage } = useTranslation();
    const { session, profile } = useAuthStore();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';
    const router = useRouter();

    const { data: sessions, isLoading, refetch, isRefetching } = useAllSessionsQuery();

    // View State
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
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
            const earnings = session.status === 'cancelled' ? 0 : sessionEarnings(session);
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
            const baseColor = session.color || (isDark ? '#7666df' : '#7666df');

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
                        borderColor: '#7666df', // Primary blue border for selection
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

    const header = <PageHeader title={t('history')} subtitle={t('workflow.historyIntro')}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('back')} onPress={() => router.back()} style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: isDark ? '#20273b' : '#e9eaf3', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={20} color={isDark ? '#f3f4f8' : '#202538'} />
        </TouchableOpacity>
    </PageHeader>;

    if (isLoading && !isRefetching) return <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0d1220' : '#f5f6fa' }} edges={['top', 'left', 'right']}>{header}<View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator size="large" color="#7666df" /></View></SafeAreaView>;

    const renderSessionCard = (session: NonNullable<typeof sessions>[number]) => (
        <View key={session.id} style={{ marginBottom: 14 }}>
            <SessionPreviewCard session={session} onPress={() => router.push(`/session/${session.id}`)} showDjs />
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0d1220' : '#f5f6fa' }} edges={['top', 'left', 'right']}>
            {header}

            {/* Sub-Header: Controls */}
            <View className="px-5 flex-row items-center justify-between">
                {/* View Switcher */}
                <View className="flex-row bg-white dark:bg-[#171d2c] rounded-2xl p-1 border border-[#e9ecf3] dark:border-[#252d40]">
                    <TouchableOpacity
                        accessibilityRole="button" accessibilityState={{selected:viewMode==='calendar'}} onPress={() => setViewMode('calendar')}
                        className={`px-4 py-2 rounded-xl ${viewMode === 'calendar' ? 'bg-[#f0edfc] dark:bg-[#292743]' : ''}`}
                    >
                        <Text className={`text-xs font-bold ${viewMode === 'calendar' ? 'text-[#7666df] dark:text-[#bdb0f5]' : 'text-gray-500 dark:text-[#a8b2c6]'}`}>
                            {t('view_calendar')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        accessibilityRole="button" accessibilityState={{selected:viewMode==='list'}} onPress={() => setViewMode('list')}
                        className={`px-4 py-2 rounded-xl ${viewMode === 'list' ? 'bg-[#f0edfc] dark:bg-[#292743]' : ''}`}
                    >
                        <Text className={`text-xs font-bold ${viewMode === 'list' ? 'text-[#7666df] dark:text-[#bdb0f5]' : 'text-gray-500 dark:text-[#a8b2c6]'}`}>
                            {t('view_list')}
                        </Text>
                    </TouchableOpacity>

                </View>

                {/* Advanced Filter Trigger */}
                <TouchableOpacity
                    accessibilityRole="button" accessibilityLabel={t('filters_title')} onPress={() => setIsAdvancedModalVisible(true)}
                    className={`w-11 h-11 rounded-2xl items-center justify-center ${activeFiltersCount > 0 ? 'bg-[#6554df]' : 'bg-gray-100 dark:bg-gray-900'}`}
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
            <View className="px-5 mt-4">
                <View className="flex-row items-center bg-white dark:bg-[#171d2c] rounded-2xl px-4 py-3.5 border border-[#e9ecf3] dark:border-[#252d40]">
                    <Search size={20} color={isDark ? '#a8b2c6' : '#9CA3AF'} />
                    <TextInput
                        className="flex-1 ml-3 text-gray-900 dark:text-white font-medium"
                        placeholder={t('search_placeholder')}
                        placeholderTextColor={isDark ? '#a8b2c6' : '#9CA3AF'}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery !== '' && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={18} color={isDark ? '#a8b2c6' : '#9CA3AF'} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>


            {viewMode === 'list' ? (
                <ScrollView
                    className="flex-1 px-5 mt-2"
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

                            <Text className="text-gray-500 dark:text-gray-400 text-lg font-bold text-center px-10">
                                {searchQuery || activeFiltersCount > 0 ? t('no_results_filtered') : t('no_sessions_yet')}
                            </Text>
                            {(searchQuery !== '' || activeFiltersCount > 0) && (
                                <TouchableOpacity
                                    onPress={resetFilters}
                                    className="mt-6 px-6 py-3 bg-gray-100 dark:bg-gray-900 rounded-full"
                                >
                                    <Text className="text-[#7666df] dark:text-[#bdb0f5] font-bold">{t('filter_reset')}</Text>
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
                    <View className="px-5">
                        <View className="bg-white dark:bg-[#171d2c] rounded-3xl overflow-hidden border border-[#e9ecf3] dark:border-[#252d40]">
                            <Calendar
                                key={JSON.stringify(calendarMarkedDates)}
                                markingType={'custom'}
                                current={selectedCalendarDate}
                                markedDates={calendarMarkedDates}
                                onDayPress={(day: any) => setSelectedCalendarDate(day.dateString)}
                                theme={{
                                    calendarBackground: isDark ? '#171d2c' : '#ffffff',
                                    textSectionTitleColor: isDark ? '#9CA3AF' : '#b6c1cd',
                                    selectedDayBackgroundColor: '#7666df',
                                    selectedDayTextColor: '#ffffff',
                                    todayTextColor: '#7666df',
                                    dayTextColor: isDark ? '#F3F4F6' : '#2d4150',
                                    textDisabledColor: isDark ? '#374151' : '#d9e1e8',
                                    dotColor: '#7666df',
                                    selectedDotColor: '#ffffff',
                                    arrowColor: '#7666df',
                                    monthTextColor: isDark ? '#F3F4F6' : '#2d4150',
                                    indicatorColor: '#7666df',
                                    textDayFontWeight: '600',
                                    textMonthFontWeight: 'bold',
                                    textDayHeaderFontWeight: 'bold',
                                }}
                            />
                        </View>
                    </View>

                    <View className="px-5 mt-6">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                {format(parseISO(selectedCalendarDate), 'd MMMM yyyy', { locale: locale })}
                            </Text>
                            <Text className="text-xs font-bold text-[#7666df] bg-[#f0edfc] dark:bg-[#292743] px-2 py-1 rounded-md">
                                {selectedDaySessions.length} {t('sessions')}
                            </Text>
                        </View>

                        {selectedDaySessions.length === 0 ? (
                            <View className="py-12 items-center justify-center bg-white dark:bg-[#171d2c] rounded-3xl border border-[#e9ecf3] dark:border-[#252d40]">
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
                                                <Text className={`font-bold ${startDate ? 'text-[#7666df]' : 'text-gray-400 dark:text-gray-500'}`}>
                                                    {startDate ? format(parseISO(startDate), 'dd/MM/yyyy') : '--/--/----'}
                                                </Text>
                                            </View>

                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => setShowEndDateCalendar(true)}
                                            className="flex-1 px-4 py-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex-row items-center justify-between"
                                        >
                                            <View>
                                                <Text className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">{t('filter_end_date')}</Text>
                                                <Text className={`font-bold ${endDate ? 'text-[#7666df]' : 'text-gray-400 dark:text-gray-500'}`}>
                                                    {endDate ? format(parseISO(endDate), 'dd/MM/yyyy') : '--/--/----'}
                                                </Text>
                                            </View>

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
                                                        ? 'bg-[#6554df] border-blue-600'
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
                                                        ? 'bg-[#6554df] border-blue-600'
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
                                                        ? 'bg-[#6554df] border-blue-600'
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
                                    className="flex-[2] py-4 rounded-2xl bg-[#6554df] items-center"
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
                                [startDate]: { selected: true, selectedColor: '#7666df' }
                            } : {}}
                            onDayPress={(day: any) => {
                                setStartDate(day.dateString);
                                setShowStartDateCalendar(false);
                            }}
                            theme={{
                                calendarBackground: isDark ? '#171d2c' : '#ffffff',
                                textSectionTitleColor: isDark ? '#9CA3AF' : '#b6c1cd',
                                selectedDayBackgroundColor: '#7666df',
                                selectedDayTextColor: '#ffffff',
                                todayTextColor: '#7666df',
                                dayTextColor: isDark ? '#F3F4F6' : '#2d4150',
                                textDisabledColor: isDark ? '#374151' : '#d9e1e8',
                                dotColor: '#7666df',
                                selectedDotColor: '#ffffff',
                                arrowColor: '#7666df',
                                monthTextColor: isDark ? '#F3F4F6' : '#2d4150',
                                indicatorColor: '#7666df',
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
                                [endDate]: { selected: true, selectedColor: '#7666df' }
                            } : {}}
                            onDayPress={(day: any) => {
                                setEndDate(day.dateString);
                                setShowEndDateCalendar(false);
                            }}
                            theme={{
                                calendarBackground: isDark ? '#171d2c' : '#ffffff',
                                textSectionTitleColor: isDark ? '#9CA3AF' : '#b6c1cd',
                                selectedDayBackgroundColor: '#7666df',
                                selectedDayTextColor: '#ffffff',
                                todayTextColor: '#7666df',
                                dayTextColor: isDark ? '#F3F4F6' : '#2d4150',
                                textDisabledColor: isDark ? '#374151' : '#d9e1e8',
                                dotColor: '#7666df',
                                selectedDotColor: '#ffffff',
                                arrowColor: '#7666df',
                                monthTextColor: isDark ? '#F3F4F6' : '#2d4150',
                                indicatorColor: '#7666df',
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
