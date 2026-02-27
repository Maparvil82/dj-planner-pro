import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Switch, Keyboard } from 'react-native';
import React, { useState, useRef, useContext } from 'react';
import { Stack, useGlobalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from '../src/i18n/useTranslation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/useAuthStore';
import { Calendar as LucideCalendar, MapPin, Clock, Users, X, DollarSign } from 'lucide-react-native';
import { ThemeContext } from '../src/contexts/ThemeContext';
import { useCreateSessionMutation } from '../src/hooks/useSessionsQuery';
import { useTagsQuery } from '../src/hooks/useTagsQuery';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { setupCalendarLocales } from '../src/i18n/calendarLocales';

setupCalendarLocales();

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    render() {
        if (this.state.hasError) {
            return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'red' }}>
                    <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>REAL CRASH:</Text>
                    <Text style={{ color: 'white', marginTop: 10 }}>{this.state.error?.message}</Text>
                    <Text style={{ color: 'white', marginTop: 10, fontSize: 10 }}>{this.state.error?.stack}</Text>
                </View>
            );
        }
        return this.props.children;
    }
}

export default function AddSessionModal() {
    const { date } = useGlobalSearchParams<{ date: string }>();
    const router = useRouter();
    return (
        <ErrorBoundary>
            <AddSessionModalContent date={date} onBack={() => router.back()} />
        </ErrorBoundary>
    );
}

function AddSessionModalContent({ date, onBack }: { date: string, onBack: () => void }) {
    const { t, currentLanguage } = useTranslation();
    const { session } = useAuthStore();
    const themeCtx = useContext(ThemeContext) as { activeTheme?: string };
    const isDark = themeCtx?.activeTheme === 'dark';

    const createSessionMutation = useCreateSessionMutation();

    const [title, setTitle] = useState('');
    const [venue, setVenue] = useState('');
    const [startTime, setStartTime] = useState('22:00');
    const [endTime, setEndTime] = useState('04:00');

    // Earnings State
    const [earningType, setEarningType] = useState<'free' | 'hourly' | 'fixed'>('free');
    const [earningAmount, setEarningAmount] = useState('');

    // Session Date State
    const [sessionDate, setSessionDate] = useState(() => {
        const d = date ? new Date(date) : new Date();
        return d.toISOString().split('T')[0];
    });
    const [showCalendar, setShowCalendar] = useState(false);

    // Collective Session State
    const [isCollective, setIsCollective] = useState(false);
    const [djInput, setDjInput] = useState('');
    const [selectedDjs, setSelectedDjs] = useState<string[]>([]);

    // UI Focus States
    const [focusedInput, setFocusedInput] = useState<string | null>(null);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleFocus = (field: string) => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        setFocusedInput(field);
    };

    const handleBlur = () => {
        blurTimeoutRef.current = setTimeout(() => {
            setFocusedInput(null);
        }, 150);
    };

    // Tags and Autocomplete
    const { data: titleTags = [] } = useTagsQuery('title');
    const { data: venueTags = [] } = useTagsQuery('venue');
    const { data: djTags = [] } = useTagsQuery('dj');

    const filteredTitleTags = title.trim().length > 0
        ? titleTags
            .filter(t => t.name.toLowerCase().includes(title.toLowerCase()) && t.name.toLowerCase() !== title.toLowerCase())
            .slice(0, 10)
        : [];

    const filteredVenueTags = venue.trim().length > 0
        ? venueTags
            .filter(v => v.name.toLowerCase().includes(venue.toLowerCase()) && v.name.toLowerCase() !== venue.toLowerCase())
            .slice(0, 10)
        : [];

    const filteredDjTags = djInput.trim().length > 0
        ? djTags
            .filter(d => d.name.toLowerCase().includes(djInput.toLowerCase()) && !selectedDjs.includes(d.name))
            .slice(0, 10)
        : [];


    // Parse the date purely locally to avoid timezone shifts
    const [y, m, d] = sessionDate.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const dateIsoStr = sessionDate; // Format as YYYY-MM-DD for supabase
    const weekday = dateObj.toLocaleDateString(currentLanguage, { weekday: 'long' });
    const dayAndMonth = dateObj.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'long', year: 'numeric' });
    LocaleConfig.defaultLocale = currentLanguage;

    // Calculate total hours
    const calculateTotalHours = () => {
        if (!startTime || !endTime) return 0;
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);

        if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 0;

        let startMinutes = startH * 60 + startM;
        let endMinutes = endH * 60 + endM;

        if (endMinutes <= startMinutes) {
            endMinutes += 24 * 60; // Next day
        }

        return (endMinutes - startMinutes) / 60;
    };

    const getEstimatedTotal = () => {
        const amount = parseFloat(earningAmount) || 0;
        if (earningType === 'fixed') return amount;
        if (earningType === 'hourly') return amount * calculateTotalHours();
        return 0;
    };

    const handleSave = async () => {
        if (!title.trim() || !venue.trim()) {
            Alert.alert(t('error'), t('missing_fields'));
            return;
        }

        // Auto-add any text left in the DJ input field before saving
        let finalDjs = [...selectedDjs];
        if (isCollective && djInput.trim().length > 0 && !finalDjs.includes(djInput.trim())) {
            finalDjs.push(djInput.trim());
            setSelectedDjs(finalDjs);
            setDjInput('');
        }

        try {
            await createSessionMutation.mutateAsync({
                date: dateIsoStr,
                title: title.trim(),
                venue: venue.trim(),
                start_time: startTime.trim(),
                end_time: endTime.trim(),
                is_collective: isCollective,
                djs: finalDjs,
                earning_type: earningType,
                earning_amount: parseFloat(earningAmount) || 0
            });

            Alert.alert(t('success'), t('session_added_success'), [
                { text: 'OK', onPress: onBack }
            ]);
        } catch (error) {
            Alert.alert(t('error'), t('error_saving_session'));
        }
    };


    return (
        <SafeAreaView className="flex-1 bg-gray-50/50 dark:bg-gray-950" edges={['bottom', 'left', 'right']}>
            <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
                <TouchableOpacity onPress={onBack} className="p-2 -ml-2">
                    <Text className="text-blue-600 dark:text-blue-500 font-medium text-lg">{t('cancel')}</Text>
                </TouchableOpacity>
                <Text className="text-lg font-bold text-gray-900 dark:text-white">{t('add_session')}</Text>
                <View className="w-16" />
            </View>

            <ScrollView
                className="flex-1 px-5 pt-4 pb-12"
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
            >

                {/* Hero Header / Date Selector */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setShowCalendar(!showCalendar)}
                    className="items-center mb-6 bg-white dark:bg-gray-900 py-3 px-6 rounded-3xl mx-auto shadow-sm shadow-black/5 border border-gray-100 dark:border-gray-800 flex-row"
                >
                    <View className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl items-center justify-center mr-4">
                        <LucideCalendar size={24} color={isDark ? '#60A5FA' : '#3B82F6'} />
                    </View>
                    <View>
                        <Text className="text-xl font-extrabold text-gray-900 dark:text-white capitalize">
                            {weekday}
                        </Text>
                        <Text className="text-sm text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mt-0.5">
                            {dayAndMonth}
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Calendar Picker (hidden by default) */}
                <View className={showCalendar ? 'mb-8 bg-white dark:bg-gray-900 rounded-3xl p-3 shadow-md shadow-black/5 border border-gray-100 dark:border-gray-800 overflow-hidden' : 'hidden'}>
                    <Calendar
                        markingType={'custom'}
                        theme={{
                            backgroundColor: 'transparent',
                            calendarBackground: 'transparent',
                            textSectionTitleColor: isDark ? '#9CA3AF' : '#6B7280',
                            selectedDayBackgroundColor: '#3B82F6',
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: '#3B82F6',
                            dayTextColor: isDark ? '#D1D5DB' : '#111827',
                            textDisabledColor: isDark ? '#4B5563' : '#374151',
                            arrowColor: isDark ? '#60A5FA' : '#3B82F6',
                            monthTextColor: isDark ? '#F9FAFB' : '#111827',
                            textDayFontWeight: '500',
                            textMonthFontWeight: 'bold',
                            textDayHeaderFontWeight: '600',
                        }}
                        onDayPress={(day: any) => {
                            setSessionDate(day.dateString);
                            setShowCalendar(false);
                        }}
                        markedDates={{
                            [sessionDate]: {
                                selected: true,
                                disableTouchEvent: true,
                                customStyles: {
                                    container: { backgroundColor: '#3B82F6', borderRadius: 10 },
                                    text: { color: 'white', fontWeight: 'bold' }
                                }
                            }
                        }}
                    />
                </View>

                {/* Form Elements */}
                <View className="flex-col gap-6">

                    {/* Title Input */}
                    <View className="z-50">
                        <View className="flex-row justify-between items-end mb-2">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1 uppercase tracking-wide">
                                {t('session_title')} *
                            </Text>
                        </View>

                        {/* Autocomplete Tags */}
                        {focusedInput === 'title' && filteredTitleTags.length > 0 && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                className="mb-3"
                            >
                                {filteredTitleTags.map((tag) => (
                                    <TouchableOpacity
                                        key={tag.name}
                                        activeOpacity={0.7}
                                        className="px-4 py-2 rounded-full mr-2 border"
                                        style={{ backgroundColor: tag.color + '26', borderColor: tag.color + '4D' }}
                                        onPress={() => {
                                            setTitle(tag.name);
                                        }}
                                        onPressOut={() => setFocusedInput(null)}
                                    >
                                        <Text className="font-medium" style={{ color: tag.color }}>{tag.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}

                        <View className={`rounded-2xl border-2 overflow-hidden ${focusedInput === 'title' ? 'border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-900 shadow-sm shadow-blue-500/10' : 'border-transparent bg-white dark:bg-gray-900 shadow-sm shadow-black/5'}`}>
                            <TextInput
                                className="px-5 py-4 text-gray-900 dark:text-white text-base font-medium"
                                placeholder={t('session_title_placeholder')}
                                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                value={title}
                                onChangeText={setTitle}
                                onFocus={() => handleFocus('title')}
                                onBlur={handleBlur}
                            />
                        </View>
                    </View>

                    {/* Venue Input */}
                    <View className="z-40">
                        <View className="flex-row justify-between items-end mb-2">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1 uppercase tracking-wide">
                                {t('venue')} *
                            </Text>
                        </View>

                        {/* Autocomplete Tags */}
                        {focusedInput === 'venue' && filteredVenueTags.length > 0 && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                className="mb-3"
                            >
                                {filteredVenueTags.map((tag) => (
                                    <TouchableOpacity
                                        key={tag.name}
                                        activeOpacity={0.7}
                                        className="px-4 py-2 rounded-full mr-2 border flex-row items-center"
                                        style={{ backgroundColor: tag.color + '26', borderColor: tag.color + '4D' }}
                                        onPress={() => {
                                            setVenue(tag.name);
                                        }}
                                        onPressOut={() => setFocusedInput(null)}
                                    >
                                        <MapPin size={14} color={tag.color} className="mr-1.5" />
                                        <Text className="font-medium" style={{ color: tag.color }}>{tag.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}

                        <View className={`relative justify-center rounded-2xl border-2 overflow-hidden ${focusedInput === 'venue' ? 'border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-900 shadow-sm shadow-blue-500/10' : 'border-transparent bg-white dark:bg-gray-900 shadow-sm shadow-black/5'}`}>
                            <View className="absolute left-5 z-10 w-6 items-center">
                                <MapPin size={22} color={focusedInput === 'venue' ? (isDark ? '#60A5FA' : '#3B82F6') : (isDark ? '#6B7280' : '#9CA3AF')} />
                            </View>
                            <TextInput
                                className="pl-14 pr-5 py-4 text-gray-900 dark:text-white text-base font-medium"
                                placeholder={t('venue_placeholder')}
                                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                value={venue}
                                onChangeText={setVenue}
                                onFocus={() => handleFocus('venue')}
                                onBlur={handleBlur}
                            />
                        </View>
                    </View>

                    {/* Collective Session Toggle */}
                    <View className="flex-row items-center justify-between mb-4 mt-2 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm shadow-black/5">
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full items-center justify-center mr-3">
                                <Users size={20} color={isDark ? '#60A5FA' : '#3B82F6'} />
                            </View>
                            <Text className="text-base font-semibold text-gray-900 dark:text-white">
                                {t('collective_session')}
                            </Text>
                        </View>
                        <Switch
                            value={isCollective}
                            onValueChange={setIsCollective}
                            trackColor={{ false: isDark ? '#374151' : '#E5E7EB', true: isDark ? '#60A5FA' : '#3B82F6' }}
                            thumbColor={isDark ? '#D1D5DB' : '#FFFFFF'}
                        />
                    </View>

                    {/* DJs Input */}
                    <View className={isCollective ? 'z-30 mb-4' : 'hidden'}>
                        <View className="flex-row justify-between items-end mb-2">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1 uppercase tracking-wide">
                                {t('add_djs')}
                            </Text>
                        </View>

                        {/* Autocomplete Tags */}
                        {focusedInput === 'dj' && filteredDjTags.length > 0 && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                className="mb-3"
                            >
                                {filteredDjTags.map((tag) => (
                                    <TouchableOpacity
                                        key={tag.name}
                                        activeOpacity={0.7}
                                        className="px-4 py-2 rounded-full mr-2 border flex-row items-center"
                                        style={{ backgroundColor: tag.color + '26', borderColor: tag.color + '4D' }}
                                        onPress={() => {
                                            if (!selectedDjs.includes(tag.name)) {
                                                setSelectedDjs([...selectedDjs, tag.name]);
                                                setDjInput(''); // Clear input after selection
                                            }
                                        }}
                                        onPressOut={() => setFocusedInput(null)}
                                    >
                                        <Users size={14} color={tag.color} className="mr-1.5" />
                                        <Text className="font-medium" style={{ color: tag.color }}>{tag.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}

                        <View className={`relative justify-center rounded-2xl border-2 overflow-hidden ${focusedInput === 'dj' ? 'border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-900 shadow-sm shadow-blue-500/10' : 'border-transparent bg-white dark:bg-gray-900 shadow-sm shadow-black/5'}`}>
                            <View className="absolute left-5 z-10 w-6 items-center">
                                <Users size={22} color={focusedInput === 'dj' ? (isDark ? '#60A5FA' : '#3B82F6') : (isDark ? '#6B7280' : '#9CA3AF')} />
                            </View>
                            <TextInput
                                className="pl-14 pr-5 py-4 text-gray-900 dark:text-white text-base font-medium"
                                placeholder={t('add_djs_placeholder')}
                                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                value={djInput}
                                onChangeText={setDjInput}
                                onFocus={() => handleFocus('dj')}
                                onBlur={handleBlur}
                                onSubmitEditing={() => {
                                    if (djInput.trim() && !selectedDjs.includes(djInput.trim())) {
                                        setSelectedDjs([...selectedDjs, djInput.trim()]);
                                        setDjInput('');
                                    }
                                }}
                                returnKeyType="done"
                            />
                        </View>

                        {/* Selected DJs Pills */}
                        {selectedDjs.length > 0 && (
                            <View className="flex-row flex-wrap mt-3 gap-2">
                                {selectedDjs.map((dj, index) => {
                                    const hashTagColor = djTags.find(t => t.name === dj)?.color || '#3B82F6';
                                    return (
                                        <View key={index} className="flex-row items-center px-3 py-2 rounded-xl border bg-white dark:bg-gray-800" style={{ borderColor: hashTagColor + '4D' }}>
                                            <Text className="font-semibold mr-2" style={{ color: hashTagColor }}>{dj}</Text>
                                            <TouchableOpacity onPress={() => setSelectedDjs(selectedDjs.filter(d => d !== dj))} className="bg-gray-100 dark:bg-gray-700 rounded-full p-1">
                                                <X size={12} color={isDark ? '#D1D5DB' : '#6B7280'} />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>

                    {/* Time Inputs Row */}
                    <View className="flex-row space-x-4">
                        <View className="flex-1 mr-2">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">
                                {t('start_time')}
                            </Text>
                            <View className={`relative justify-center rounded-2xl border-2 overflow-hidden ${focusedInput === 'start' ? 'border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-900 shadow-sm shadow-blue-500/10' : 'border-transparent bg-white dark:bg-gray-900 shadow-sm shadow-black/5'}`}>
                                <View className="absolute left-4 z-10 w-5 items-center">
                                    <Clock size={20} color={focusedInput === 'start' ? (isDark ? '#60A5FA' : '#3B82F6') : (isDark ? '#6B7280' : '#9CA3AF')} />
                                </View>
                                <TextInput
                                    className="pl-11 pr-4 py-4 text-gray-900 dark:text-white text-base font-medium"
                                    placeholder="22:00"
                                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                    value={startTime}
                                    onChangeText={setStartTime}
                                    onFocus={() => setFocusedInput('start')}
                                    onBlur={() => setFocusedInput(null)}
                                />
                            </View>
                        </View>

                        <View className="flex-1 ml-2">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">
                                {t('end_time')}
                            </Text>
                            <View className={`relative justify-center rounded-2xl border-2 overflow-hidden ${focusedInput === 'end' ? 'border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-900 shadow-sm shadow-blue-500/10' : 'border-transparent bg-white dark:bg-gray-900 shadow-sm shadow-black/5'}`}>
                                <View className="absolute left-4 z-10 w-5 items-center">
                                    <Clock size={20} color={focusedInput === 'end' ? (isDark ? '#60A5FA' : '#3B82F6') : (isDark ? '#6B7280' : '#9CA3AF')} />
                                </View>
                                <TextInput
                                    className="pl-11 pr-4 py-4 text-gray-900 dark:text-white text-base font-medium"
                                    placeholder="04:00"
                                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                    value={endTime}
                                    onChangeText={setEndTime}
                                    onFocus={() => setFocusedInput('end')}
                                    onBlur={() => setFocusedInput(null)}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Earnings Section */}
                    <View className="z-10 mt-2">
                        <View className="flex-row justify-between items-end mb-2">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1 uppercase tracking-wide">
                                {t('earning_type') || 'Cobro'}
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1F2937' : '#F3F4F6', borderRadius: 12, padding: 4, marginBottom: 16 }}>
                            {['free', 'hourly', 'fixed'].map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    onPress={() => setEarningType(type as any)}
                                    style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: earningType === type ? (isDark ? '#374151' : '#FFFFFF') : 'transparent' }}
                                >
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: earningType === type ? (isDark ? '#60A5FA' : '#2563EB') : (isDark ? '#9CA3AF' : '#6B7280') }}>
                                        {t(`earning_${type}`) || type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View className={earningType === 'free' ? 'hidden' : 'flex'}>
                            <View className={`relative justify-center rounded-2xl border-2 overflow-hidden ${focusedInput === 'earning' ? 'border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-900 shadow-sm shadow-blue-500/10' : 'border-transparent bg-white dark:bg-gray-900 shadow-sm shadow-black/5'}`}>
                                <View className="absolute left-5 z-10 w-6 items-center">
                                    <DollarSign size={20} color={focusedInput === 'earning' ? (isDark ? '#60A5FA' : '#3B82F6') : (isDark ? '#6B7280' : '#9CA3AF')} />
                                </View>
                                <TextInput
                                    className="pl-14 pr-5 py-4 text-gray-900 dark:text-white text-base font-medium"
                                    placeholder={t('earning_amount') || 'Importe'}
                                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                    keyboardType="numeric"
                                    value={earningAmount}
                                    onChangeText={setEarningAmount}
                                    onFocus={() => handleFocus('earning')}
                                    onBlur={handleBlur}
                                />
                            </View>
                            {/*<View className={earningType === 'hourly' && earningAmount.length > 0 ? 'flex' : 'hidden'}>
                                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-2 ml-2">
                                    {t('total_earnings') || 'Total:'} <Text className="text-green-600 dark:text-green-500 font-bold">{getEstimatedTotal() || 0} €</Text> ({calculateTotalHours()}h)
                                </Text>
                            </View>*/}
                        </View>
                    </View>

                </View>

                {/* Save Button */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    className={`mt-10 mb-12 flex-row justify-center items-center py-4 rounded-2xl shadow-lg ${createSessionMutation.isPending || !title.trim() || !venue.trim()
                        ? 'bg-blue-300 dark:bg-blue-900/50 shadow-none'
                        : 'bg-blue-600 dark:bg-blue-500 shadow-blue-500/40'
                        }`}
                    onPress={handleSave}
                    disabled={createSessionMutation.isPending || !title.trim() || !venue.trim()}
                >
                    {createSessionMutation.isPending ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold text-[17px] tracking-wide">
                            {t('save_session')}
                        </Text>
                    )}
                </TouchableOpacity>

                {/* Bottom Spacer to ensure scrollability over safe area */}
                <View className="h-10" />

            </ScrollView>
        </SafeAreaView>
    );
}
