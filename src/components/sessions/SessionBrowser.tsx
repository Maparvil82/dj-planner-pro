import { useScreenMonitoring } from '../../hooks/useScreenMonitoring';
import { useDarkPalette } from '../../contexts/ThemeContext';
import { formatRegionalDate } from '../../i18n/regionalDates';
import {BlockDayButton} from '../../components/sessionTools/BlockDayButton';
import {useBlockedDays} from '../../hooks/useBlockedDays';
import { useScrollHeader } from '../../hooks/useScrollHeader';
import { PageHeader } from '../../components/ui/PageHeader';
import { SessionPreviewCard } from '../../components/sessions/SessionPreviewCard';
import React, { useMemo, useState, useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    SectionList,
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
import { Search, Filter, X, RotateCcw, ArrowLeft } from 'lucide-react-native';
import { useTranslation } from '../../i18n/useTranslation';
import {useSessionFeed,useSessionCalendarMarks,useSessionFilterOptions,useDebouncedValue,useSessionDayOccupied,useSessionRangeQuery} from '../../hooks/useSessionScreens';
import { ThemeContext } from '../../contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { es, enUS, de, fr, it, ptBR, ja } from 'date-fns/locale';

import { Calendar, LocaleConfig } from 'react-native-calendars';

import { setupCalendarLocales } from '../../i18n/calendarLocales';

setupCalendarLocales();

export function SessionBrowser() {
    const calendarView = true;
    const darkPalette = useDarkPalette();
    const { progress: headerProgress, onScroll: onTabScroll, onScrollBeginDrag: onTabScrollBeginDrag } = useScrollHeader('compact');
    const { t, i18n, currentLanguage, dateLocale, firstDay } = useTranslation();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';
    const router = useRouter();
    const calendarAccent = isDark ? darkPalette.primary : '#7666df';
    const calendarOnAccent = isDark ? darkPalette.onPrimary : '#ffffff';


    const blockedDays = useBlockedDays();
    // View State
    const viewMode: string = calendarView ? 'calendar' : 'list';
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
    const [calendarMonth,setCalendarMonth]=useState(format(new Date(),'yyyy-MM'));
    const labels={atVenue:t('sessionNaming.atVenue',{venue:'{venue}'}),untitled:t('sessionNaming.untitled')};
    const debouncedSearch=useDebouncedValue(searchQuery);
    const nextDay=(value:string)=>{const date=parseISO(value);date.setDate(date.getDate()+1);return format(date,'yyyy-MM-dd');};
    const bounds=(from:string|null,to:string|null)=>({from:startDate&&(!from||startDate>from)?startDate:from,to:endDate&&(!to||nextDay(endDate)<to)?nextDay(endDate):to});
    const commonFilters={search:debouncedSearch,venues:selectedVenues,titles:selectedTitles,earningTypes:selectedEarningTypes,min:Number.isNaN(parseFloat(minEarnings))?null:parseFloat(minEarnings),max:Number.isNaN(parseFloat(maxEarnings))?null:parseFloat(maxEarnings)};
    const feed=useSessionFeed({...commonFilters,...bounds(null,null)},labels,!calendarView);

    const monthFrom=parseISO(calendarMonth+'-01');monthFrom.setDate(monthFrom.getDate()-7);
    const monthTo=parseISO(calendarMonth+'-01');monthTo.setMonth(monthTo.getMonth()+1);monthTo.setDate(monthTo.getDate()+7);
    const marks=useSessionCalendarMarks({...commonFilters,...bounds(format(monthFrom,'yyyy-MM-dd'),format(monthTo,'yyyy-MM-dd'))},labels,viewMode==='calendar');
    const blockWindow=useSessionDayOccupied(selectedCalendarDate,viewMode==='calendar');
    const options=useSessionFilterOptions(labels,isAdvancedModalVisible);
    const nextMonth = parseISO(calendarMonth + '-01');
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthSessions = useSessionRangeQuery(calendarMonth + '-01', format(nextMonth, 'yyyy-MM-dd'), calendarView);
    const sessions = calendarView ? monthSessions.data : feed.data?.pages.flatMap(page => page.sessions);
    const isLoading = calendarView ? monthSessions.isLoading : feed.isLoading;
    const isRefetching = calendarView ? monthSessions.isRefetching : feed.isRefetching;
    const isError = calendarView ? monthSessions.isError || marks.isError : feed.isError;
    useScreenMonitoring(calendarView ? 'calendar' : 'history', isLoading, isError);
    const refetch = () => calendarView
        ? Promise.all([monthSessions.refetch(), marks.refetch(), blockWindow.refetch(), blockedDays.refetch()])
        : feed.refetch();

    LocaleConfig.defaultLocale = currentLanguage;

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

    const uniqueVenues=options.data?.venues || [];
    const uniqueTitles=options.data?.titles || [];
    const filteredSessions=sessions || [];
    // Calendar Marked Dates Logic
    const calendarMarkedDates = useMemo(() => {
        const marked: any = {};
        (monthSessions.data || []).filter(session => session.status !== 'cancelled').forEach(session => {
            const date = session.date.slice(0, 10);
            marked[date] = { marked: true, dotColor: session.color || calendarAccent };
        });
        (blockedDays.data || []).forEach(date => {
            marked[date] = {
                ...marked[date],
                customStyles: {
                    container: { backgroundColor: isDark ? darkPalette.raised : '#f0f1f5', borderRadius: 14 },
                    text: { color: isDark ? darkPalette.muted : '#7b8091', textDecorationLine: 'line-through' },
                },
            };
        });
        marked[selectedCalendarDate] = {
            ...marked[selectedCalendarDate],
            dotColor: calendarOnAccent,
            customStyles: {
                container: { backgroundColor: calendarAccent, borderRadius: 14 },
                text: { color: calendarOnAccent, fontWeight: '600' },
            },
        };

        return marked;
    }, [monthSessions.data, selectedCalendarDate, isDark, blockedDays.data, darkPalette, calendarAccent, calendarOnAccent]);

    const monthlySessions = useMemo(() => [...(monthSessions.data || [])].sort((a, b) =>
        a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time) || a.id.localeCompare(b.id)
    ), [monthSessions.data]);
    const goToToday = () => {
        const today = format(new Date(), 'yyyy-MM-dd');
        setSelectedCalendarDate(today);
        setCalendarMonth(today.slice(0, 7));
    };

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

    const header = <PageHeader leading={<TouchableOpacity accessibilityRole="button" accessibilityLabel={t('back')} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/home'); }} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: isDark ? darkPalette.raised : '#e9eaf3', alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={21} color={isDark ? darkPalette.text : '#202538'} /></TouchableOpacity>} progress={headerProgress} title={t(calendarView ? 'view_calendar' : 'history')} subtitle={t(calendarView ? 'sessionCalendar.intro' : 'workflow.historyIntro')} />;



    const renderSessionCard = (session: NonNullable<typeof sessions>[number]) => (
        <View key={session.id} style={{ marginBottom: 14 }}>
            <SessionPreviewCard session={session} onPress={() => router.push(`/session/${session.id}`)} showDjs />
        </View>
    );

    return (
        <SafeAreaView testID={calendarView ? "calendar-screen" : "history-screen"} style={{ flex: 1, backgroundColor: isDark ? darkPalette.background : '#f5f6fa' }} edges={['top', 'left', 'right']}>
            {header}

            {isError && <View style={{padding:16}}><Text accessibilityRole="alert" style={{color:isDark?darkPalette.text:'#202538'}}>{t('insights.loadingError')}</Text><TouchableOpacity accessibilityRole="button" onPress={()=>void refetch()}><Text style={{color:calendarAccent}}>{t('insights.retry')}</Text></TouchableOpacity></View>}
            {/* Search Bar */}
            {!calendarView && <View className="px-5 mt-4 flex-row items-center gap-3">
                <View className="flex-1 flex-row items-center bg-white dark:bg-djDark-surface rounded-2xl px-4 py-3.5 border border-[#e9ecf3] dark:border-djDark-border dark:border-0">
                    <Search size={20} color={isDark ? darkPalette.muted : '#9CA3AF'} />
                    <TextInput
                        className="flex-1 ml-3 text-gray-900 dark:text-djDark-text font-medium"
                        placeholder={t('search_placeholder')}
                        placeholderTextColor={isDark ? darkPalette.muted : '#9CA3AF'}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery !== '' && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={18} color={isDark ? darkPalette.muted : '#9CA3AF'} />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    accessibilityRole="button" accessibilityLabel={t('filters_title')} onPress={() => setIsAdvancedModalVisible(true)}
                    className={`w-11 h-11 rounded-2xl items-center justify-center ${activeFiltersCount > 0 ? 'bg-[#6554df]' : 'bg-gray-100 dark:bg-djDark-surface'}`}
                >
                    <Filter size={18} color={activeFiltersCount > 0 ? '#FFFFFF' : (isDark ? darkPalette.muted : '#4B5563')} />
                    {activeFiltersCount > 0 && (
                        <View className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white dark:border-djDark-border items-center justify-center">
                            <Text style={isDark && { color: darkPalette.onSurface }} className="text-[10px] font-bold text-white">{activeFiltersCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>}


            {viewMode === 'list' ? (
                <SectionList style={{flex:1,marginTop:8}} sections={groupedSessions} keyExtractor={item=>item.id}
                    renderItem={({item})=>renderSessionCard(item)}
                    renderSectionHeader={({section})=><Text className="text-xs font-bold text-gray-500 dark:text-djDark-muted uppercase tracking-wider my-4 ml-1">{section.title}</Text>}
                    stickySectionHeadersEnabled={false} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5}
                    onScroll={onTabScroll} onScrollBeginDrag={onTabScrollBeginDrag} scrollEventThrottle={16}
                    contentContainerStyle={{paddingHorizontal:20,paddingBottom:100}} showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={()=>{void refetch();}} />}
                    onEndReached={()=>{if(feed.hasNextPage&&!feed.isFetchingNextPage)void feed.fetchNextPage();}} onEndReachedThreshold={0.4}
                    ListEmptyComponent={<View className="py-20 items-center">{isLoading?<ActivityIndicator color={calendarAccent} />:<Text style={{color:isDark?darkPalette.text:'#202538'}}> {feed.isError?t('insights.loadingError'):searchQuery||activeFiltersCount?t('no_results_filtered'):t('no_sessions_yet')}</Text>}</View>}
                    ListFooterComponent={feed.isFetchingNextPage?<ActivityIndicator />:feed.hasNextPage?<TouchableOpacity accessibilityRole="button" onPress={()=>void feed.fetchNextPage()} style={{padding:16}}><Text style={{color:calendarAccent}}>{t('advancedAnalytics.showMore')}</Text></TouchableOpacity>:undefined}
                />
            ) : (
                <ScrollView testID="monthly-calendar-scroll" refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); }} />} onScrollBeginDrag={onTabScrollBeginDrag} onTouchStart={onTabScrollBeginDrag} onScroll={onTabScroll} scrollEventThrottle={16} className="flex-1 mt-4" showsVerticalScrollIndicator={false}>
                    <View className="px-6">
                        <View className="bg-white dark:bg-djDark-surface rounded-3xl overflow-hidden border border-[#e9ecf3] dark:border-djDark-border dark:border-0">
                            {marks.isFetching && <ActivityIndicator color={calendarAccent} style={{padding:8}} />}
                            <Calendar testID="monthly-calendar"
                                key={`${calendarMonth}-${currentLanguage}-${isDark}-${calendarAccent}-weekday-labels`}
                                renderHeader={() => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                                    <Text style={{ color: isDark ? darkPalette.text : '#202538', fontSize: 16, fontWeight: '600' }}>{(() => { const label = format(parseISO(calendarMonth + '-01'), 'MMMM yyyy', { locale }); return label.charAt(0).toLocaleUpperCase(currentLanguage) + label.slice(1); })()}</Text>
                                    <TouchableOpacity testID="calendar-today" accessibilityRole="button" accessibilityLabel={t('sessionCalendar.today')} onPress={goToToday} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 12, backgroundColor: isDark ? darkPalette.tint : '#f0edfc' }}>
                                        <Text style={{ color: calendarAccent, fontSize: 12, fontWeight: '600' }}>{t('sessionCalendar.todayShort')}</Text>
                                    </TouchableOpacity>
                                </View>}
                                firstDay={firstDay}
                                markingType={'custom'}
                                current={calendarMonth + '-01'}
                                markedDates={calendarMarkedDates}
                                onDayPress={(day: any) => setSelectedCalendarDate(day.dateString)}
                                onMonthChange={(day: { dateString: string }) => {
                                    const month = day.dateString.slice(0, 7);
                                    setCalendarMonth(month);
                                    setSelectedCalendarDate(selected => selected.startsWith(month) ? selected : month + '-01');
                                }}
                                theme={{
                                    calendarBackground: isDark ? darkPalette.surface : '#ffffff',
                                    textSectionTitleColor: isDark ? '#96988f' : '#687386',
                                    textDayHeaderFontSize: 11,
                                    selectedDayBackgroundColor: calendarAccent,
                                    selectedDayTextColor: calendarOnAccent,
                                    todayTextColor: calendarAccent,
                                    dayTextColor: isDark ? darkPalette.text : '#303547',
                                    textDisabledColor: isDark ? darkPalette.raised : '#d9e1e8',
                                    dotColor: calendarAccent,
                                    selectedDotColor: calendarOnAccent,
                                    arrowColor: calendarAccent,
                                    monthTextColor: isDark ? darkPalette.text : '#2d4150',
                                    indicatorColor: calendarAccent,
                                    textDayFontWeight: '400',
                                    textDayFontSize: 15,
                                    textMonthFontWeight: 'bold',
                                    textDayHeaderFontWeight: '500',
                                }}
                            />
                        </View>
                    </View>

                    <View className="px-6 mt-6">
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                            <View style={{ flex: 1, gap: 5 }}>
                                <Text style={{ color: isDark ? darkPalette.text : '#202538', fontSize: 15, lineHeight: 21, fontWeight: '600' }}>{(() => { const label = parseISO(selectedCalendarDate).toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' }); return label.charAt(0).toLocaleUpperCase(currentLanguage) + label.slice(1); })()}</Text>
                                <Text style={{ color: isDark ? darkPalette.muted : '#6d7588', fontSize: 12 }}>{t('sessionCalendar.daySessions', { count: monthlySessions.filter(s => s.date.slice(0, 10) === selectedCalendarDate).length })}</Text>
                            </View>
                            {blockWindow.isLoading ? <ActivityIndicator color={calendarAccent} /> : blockWindow.isError ? <TouchableOpacity accessibilityRole="button" onPress={() => void blockWindow.refetch()}><Text style={{ color: calendarAccent }}>{t('insights.retry')}</Text></TouchableOpacity> : blockWindow.isSuccess ? <BlockDayButton compact date={selectedCalendarDate} hasSessions={blockWindow.data === true} /> : null}
                        </View>
                        {blockedDays.data?.includes(selectedCalendarDate) && <Text style={{ color: isDark ? darkPalette.muted : '#6d7588', fontSize: 13, marginBottom: 12 }}>{t('tools.dayBlocked')}</Text>}
                        {isLoading ? <ActivityIndicator color={calendarAccent} /> : monthSessions.isError ? null : monthlySessions.some(s => s.date.slice(0, 10) === selectedCalendarDate) ? <View style={{ gap: 12, marginBottom: 24 }}>
                            {monthlySessions.filter(s => s.date.slice(0, 10) === selectedCalendarDate).map(session => <SessionPreviewCard calendarVariant hideDate key={session.id} session={session} onPress={() => router.push(`/session/${session.id}`)} showDjs />)}
                        </View> : <Text style={{ color: isDark ? darkPalette.muted : '#6d7588', fontSize: 14, marginBottom: 24 }}>{t('no_sessions_this_day')}</Text>}
                        <View style={{ marginTop: 8, marginBottom: 16, gap: 6 }}>
                            <Text testID="calendar-month-title" style={{ color: isDark ? darkPalette.text : '#202538', fontSize: 17, lineHeight: 23, fontWeight: '600' }}>{t('sessionCalendar.monthList')}</Text>
                            <Text style={{ color: isDark ? darkPalette.muted : '#6d7588', fontSize: 13 }}>{t('sessionCalendar.monthSessions', { count: monthlySessions.length })}</Text>
                        </View>
                        {isLoading ? <ActivityIndicator color={calendarAccent} /> : monthSessions.isError ? <TouchableOpacity accessibilityRole="button" onPress={() => void monthSessions.refetch()}><Text style={{ color: calendarAccent }}>{t('insights.loadingError')} · {t('insights.retry')}</Text></TouchableOpacity> : monthlySessions.length === 0 ? (
                            <View className="py-12 items-center justify-center bg-white dark:bg-djDark-surface rounded-3xl border border-[#e9ecf3] dark:border-djDark-border dark:border-0">
                                <Text style={{ color: isDark ? darkPalette.muted : '#6d7588', textAlign: 'center', paddingHorizontal: 20 }}>{t('sessionCalendar.emptyMonth')}</Text>
                            </View>
                        ) : <View testID="calendar-month-sessions" style={{ gap: 14 }}>
                            {monthlySessions.map(session => <SessionPreviewCard calendarVariant key={session.id} session={session} onPress={() => router.push(`/session/${session.id}`)} showDjs />)}
                        </View>}
                    </View>
                    <View style={{ height: 140 }} />
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
                        <View className="bg-white dark:bg-djDark-background rounded-t-[40px] px-6 pt-8 pb-10 max-h-[90%]">
                            <View className="flex-row items-center justify-between mb-8">
                                <Text className="text-2xl font-black text-gray-900 dark:text-djDark-text">
                                    {t('filters_title')}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setIsAdvancedModalVisible(false)}
                                    className="w-10 h-10 rounded-full bg-gray-100 dark:bg-djDark-surface items-center justify-center"
                                >
                                    <X size={24} color={isDark ? darkPalette.text : '#000000'} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                {options.isLoading && <ActivityIndicator color={calendarAccent} />}
                                {options.isError && <View style={{padding:12,gap:8}}><Text accessibilityRole="alert" style={{color:isDark?darkPalette.text:'#202538'}}>{t('insights.loadingError')}</Text><TouchableOpacity accessibilityRole="button" onPress={()=>void options.refetch()}><Text style={{color:calendarAccent}}>{t('insights.retry')}</Text></TouchableOpacity></View>}
                                {/* Date Range Section */}
                                <View className="mb-8">
                                    <Text className="text-sm font-bold text-gray-400 dark:text-djDark-muted uppercase tracking-widest mb-4">
                                        {t('filter_date_range')}
                                    </Text>
                                    <View className="flex-row gap-4">
                                        <TouchableOpacity
                                            onPress={() => setShowStartDateCalendar(true)}
                                            className="flex-1 px-4 py-4 rounded-2xl bg-gray-50 dark:bg-djDark-surface border border-gray-100 dark:border-djDark-border flex-row items-center justify-between dark:border-0"
                                        >
                                            <View>
                                                <Text style={isDark && { color: darkPalette.onSurface }} className="text-[10px] font-bold text-gray-400 dark:text-djDark-muted uppercase mb-1">{t('filter_start_date')}</Text>
                                                <Text style={isDark && { color: darkPalette.onSurface }} className={`font-bold ${startDate ? 'text-[#7666df]' : 'text-gray-400 dark:text-djDark-muted'}`}>
                                                    {startDate ? formatRegionalDate(startDate, dateLocale) : '--/--/----'}
                                                </Text>
                                            </View>

                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => setShowEndDateCalendar(true)}
                                            className="flex-1 px-4 py-4 rounded-2xl bg-gray-50 dark:bg-djDark-surface border border-gray-100 dark:border-djDark-border flex-row items-center justify-between dark:border-0"
                                        >
                                            <View>
                                                <Text style={isDark && { color: darkPalette.onSurface }} className="text-[10px] font-bold text-gray-400 dark:text-djDark-muted uppercase mb-1">{t('filter_end_date')}</Text>
                                                <Text style={isDark && { color: darkPalette.onSurface }} className={`font-bold ${endDate ? 'text-[#7666df]' : 'text-gray-400 dark:text-djDark-muted'}`}>
                                                    {endDate ? formatRegionalDate(endDate, dateLocale) : '--/--/----'}
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
                                    <Text className="text-sm font-bold text-gray-400 dark:text-djDark-muted uppercase tracking-widest mb-4">
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
                                                        : 'bg-white dark:bg-djDark-background border-gray-200 dark:border-djDark-border'
                                                        }`}
                                                >
                                                    <Text className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-600 dark:text-djDark-muted'
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
                                    <Text className="text-sm font-bold text-gray-400 dark:text-djDark-muted uppercase tracking-widest mb-4">
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
                                                        : 'bg-white dark:bg-djDark-background border-gray-200 dark:border-djDark-border'
                                                        }`}
                                                >
                                                    <Text className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-600 dark:text-djDark-muted'
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
                                    <Text className="text-sm font-bold text-gray-400 dark:text-djDark-muted uppercase tracking-widest mb-4">
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
                                                        : 'bg-white dark:bg-djDark-background border-gray-200 dark:border-djDark-border'
                                                        }`}
                                                >
                                                    <Text className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-600 dark:text-djDark-muted'
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
                                    <Text className="text-sm font-bold text-gray-400 dark:text-djDark-muted uppercase tracking-widest mb-4">
                                        {t('filter_earnings_range')}
                                    </Text>
                                    <View className="flex-row gap-4">
                                        <View className="flex-1 px-4 py-3 rounded-2xl bg-gray-50 dark:bg-djDark-surface border border-gray-100 dark:border-djDark-border flex-row items-center dark:border-0">
                                            <Text style={isDark && { color: darkPalette.onSurface }} className="text-[10px] font-bold text-gray-400 dark:text-djDark-muted uppercase mr-2">{t('filter_min_earnings')}</Text>
                                            <TextInput
                                                className="flex-1 font-bold text-gray-900 dark:text-djDark-text"
                                                placeholder="0"
                                                placeholderTextColor="#9CA3AF"
                                                keyboardType="numeric"
                                                value={minEarnings}
                                                onChangeText={setMinEarnings}
                                            />
                                            <Text style={isDark && { color: darkPalette.onSurface }} className="text-xs font-bold text-gray-400 dark:text-djDark-muted ml-1">€</Text>
                                        </View>
                                        <View className="flex-1 px-4 py-3 rounded-2xl bg-gray-50 dark:bg-djDark-surface border border-gray-100 dark:border-djDark-border flex-row items-center dark:border-0">
                                            <Text style={isDark && { color: darkPalette.onSurface }} className="text-[10px] font-bold text-gray-400 dark:text-djDark-muted uppercase mr-2">{t('filter_max_earnings')}</Text>
                                            <TextInput
                                                className="flex-1 font-bold text-gray-900 dark:text-djDark-text"
                                                placeholder="9999"
                                                placeholderTextColor="#9CA3AF"
                                                keyboardType="numeric"
                                                value={maxEarnings}
                                                onChangeText={setMaxEarnings}
                                            />
                                            <Text style={isDark && { color: darkPalette.onSurface }} className="text-xs font-bold text-gray-400 dark:text-djDark-muted ml-1">€</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* More filters can be added here like Date Range Picker */}

                            </ScrollView>

                            {/* Footer Buttons */}
                            <View className="flex-row gap-4 mt-8">
                                <TouchableOpacity
                                    onPress={resetFilters}
                                    className="flex-1 py-4 rounded-2xl bg-gray-100 dark:bg-djDark-surface items-center"
                                >
                                    <Text style={isDark && { color: darkPalette.onSurface }} className="text-gray-900 dark:text-djDark-text font-bold">{t('filter_reset')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setIsAdvancedModalVisible(false)}
                                    style={{ backgroundColor: isDark ? darkPalette.primary : '#6554df' }}
                                    className="flex-[2] py-4 rounded-2xl items-center"
                                >
                                    <Text style={{ color: isDark ? darkPalette.onPrimary : '#ffffff' }} className="font-black">{t('filter_apply')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
            {/* Start Date Picker Modal */}
            <Modal visible={showStartDateCalendar} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/60 px-6">
                    <View className="bg-white dark:bg-djDark-surface rounded-3xl overflow-hidden w-full max-w-sm">
                        <Calendar
                                key={`${currentLanguage}-${isDark}-${calendarAccent}-weekday-labels`}
                            firstDay={firstDay}
                            current={startDate || undefined}
                            markedDates={startDate ? {
                                [startDate]: { selected: true, selectedColor: calendarAccent, selectedTextColor: calendarOnAccent }
                            } : {}}
                            onDayPress={(day: any) => {
                                setStartDate(day.dateString);
                                setShowStartDateCalendar(false);
                            }}
                            theme={{
                                calendarBackground: isDark ? darkPalette.surface : '#ffffff',
                                textSectionTitleColor: isDark ? '#96988f' : '#687386',
                                    textDayHeaderFontSize: 11,
                                selectedDayBackgroundColor: calendarAccent,
                                selectedDayTextColor: calendarOnAccent,
                                todayTextColor: calendarAccent,
                                dayTextColor: isDark ? darkPalette.text : '#303547',
                                textDisabledColor: isDark ? darkPalette.raised : '#d9e1e8',
                                dotColor: calendarAccent,
                                selectedDotColor: calendarOnAccent,
                                arrowColor: calendarAccent,
                                monthTextColor: isDark ? darkPalette.text : '#2d4150',
                                indicatorColor: calendarAccent,
                            }}
                        />
                        <TouchableOpacity
                            onPress={() => setShowStartDateCalendar(false)}
                            className="p-4 items-center border-t border-gray-100 dark:border-djDark-border"
                        >
                            <Text style={isDark && { color: darkPalette.onSurface }} className="text-gray-500 font-bold">{t('cancel')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* End Date Picker Modal */}
            <Modal visible={showEndDateCalendar} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/60 px-6">
                    <View className="bg-white dark:bg-djDark-surface rounded-3xl overflow-hidden w-full max-w-sm">
                        <Calendar
                                key={`${currentLanguage}-${isDark}-${calendarAccent}-weekday-labels`}
                            firstDay={firstDay}
                            current={endDate || undefined}
                            markedDates={endDate ? {
                                [endDate]: { selected: true, selectedColor: calendarAccent, selectedTextColor: calendarOnAccent }
                            } : {}}
                            onDayPress={(day: any) => {
                                setEndDate(day.dateString);
                                setShowEndDateCalendar(false);
                            }}
                            theme={{
                                calendarBackground: isDark ? darkPalette.surface : '#ffffff',
                                textSectionTitleColor: isDark ? '#96988f' : '#687386',
                                    textDayHeaderFontSize: 11,
                                selectedDayBackgroundColor: calendarAccent,
                                selectedDayTextColor: calendarOnAccent,
                                todayTextColor: calendarAccent,
                                dayTextColor: isDark ? darkPalette.text : '#303547',
                                textDisabledColor: isDark ? darkPalette.raised : '#d9e1e8',
                                dotColor: calendarAccent,
                                selectedDotColor: calendarOnAccent,
                                arrowColor: calendarAccent,
                                monthTextColor: isDark ? darkPalette.text : '#2d4150',
                                indicatorColor: calendarAccent,
                            }}
                        />
                        <TouchableOpacity
                            onPress={() => setShowEndDateCalendar(false)}
                            className="p-4 items-center border-t border-gray-100 dark:border-djDark-border"
                        >
                            <Text style={isDark && { color: darkPalette.onSurface }} className="text-gray-500 font-bold">{t('cancel')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
