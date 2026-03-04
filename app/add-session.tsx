import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Switch, Keyboard, KeyboardAvoidingView, Platform, Modal, Pressable } from 'react-native';
import React, { useState, useRef, useContext } from 'react';
import { Stack, useGlobalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from '../src/i18n/useTranslation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/useAuthStore';
import { Calendar as LucideCalendar, MapPin, Clock, Users, X, DollarSign, ChevronRight, Repeat, Palette, Check, Plus } from 'lucide-react-native';
import { ThemeContext } from '../src/contexts/ThemeContext';
import { useCreateSessionMutation } from '../src/hooks/useSessionsQuery';
import { useTagsQuery } from '../src/hooks/useTagsQuery';
import { useVenuesQuery, useCreateVenueMutation } from '../src/hooks/useVenuesQuery';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { setupCalendarLocales } from '../src/i18n/calendarLocales';
import { supabase } from '../src/lib/supabase';

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

export default function AddSessionScreen() {
    const { date } = useGlobalSearchParams<{ date: string }>();
    const router = useRouter();
    return (
        <ErrorBoundary>
            <AddSessionContent date={date} onBack={() => router.back()} />
        </ErrorBoundary>
    );
}

function AddSessionContent({ date, onBack }: { date: string, onBack: () => void }) {
    const { t, currentLanguage } = useTranslation();
    const { session } = useAuthStore();
    const router = useRouter();
    const createVenueMutation = useCreateVenueMutation();
    const themeCtx = useContext(ThemeContext) as { activeTheme?: string };
    const isDark = themeCtx?.activeTheme === 'dark';

    const createSessionMutation = useCreateSessionMutation();

    const [title, setTitle] = useState('');
    const [venue, setVenue] = useState('');
    const [startTime, setStartTime] = useState('22:00');
    const [endTime, setEndTime] = useState('04:00');
    const [venueId, setVenueId] = useState<string | null>(null);
    const [isVenueModalVisible, setIsVenueModalVisible] = useState(false);

    // Status State
    const [status, setStatus] = useState<'pending' | 'confirmed' | 'cancelled'>('confirmed');

    // Earnings State
    const [earningType, setEarningType] = useState<'free' | 'hourly' | 'fixed'>('free');
    const [earningAmount, setEarningAmount] = useState('');
    const [currency, setCurrency] = useState('€');

    const [sessionDate, setSessionDate] = useState(() => {
        const d = date ? new Date(date) : new Date();
        return d.toISOString().split('T')[0];
    });
    const [showCalendar, setShowCalendar] = useState(false);

    // Recurrence State
    const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'yearly'>('none');
    const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>(() => {
        const d = date ? new Date(date + 'T12:00:00Z') : new Date();
        d.setUTCMonth(d.getUTCMonth() + 1);
        return d.toISOString().split('T')[0];
    });
    const [showEndCalendar, setShowEndCalendar] = useState(false);
    const [isRepeatModalVisible, setIsRepeatModalVisible] = useState(false);

    // Color State
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [isColorModalVisible, setIsColorModalVisible] = useState(false);

    // Auto-adjust end date if session date goes past it
    React.useEffect(() => {
        const sd = new Date(sessionDate + 'T12:00:00Z');
        const ed = new Date(recurrenceEndDate + 'T12:00:00Z');
        if (sd > ed) {
            sd.setUTCMonth(sd.getUTCMonth() + 1);
            setRecurrenceEndDate(sd.toISOString().split('T')[0]);
        }
    }, [sessionDate]);

    // Collective Session State
    const [isCollective, setIsCollective] = useState(false);
    const [djInput, setDjInput] = useState('');
    const [selectedDjs, setSelectedDjs] = useState<string[]>([]);

    // Auto-search State
    const [showTitleAuto, setShowTitleAuto] = useState(false);
    const [showVenueAuto, setShowVenueAuto] = useState(false);
    const [showDjAuto, setShowDjAuto] = useState(false);

    // Timeout refs for blur
    const autoCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Focus state to know which input is active
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    const handleFocus = (type: string) => {
        if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);

        setFocusedInput(type);
        if (type === 'title') setShowTitleAuto(true);
        if (type === 'venue') setShowVenueAuto(true);
        if (type === 'dj') setShowDjAuto(true);
    };

    const handleBlur = () => {
        blurTimeoutRef.current = setTimeout(() => {
            setFocusedInput(null);
            setShowTitleAuto(false);
            setShowVenueAuto(false);
            setShowDjAuto(false);
        }, 150) as any;
    };

    // Tags and Autocomplete
    const { data: titleTags = [] } = useTagsQuery('title');
    const { data: venueTags = [] } = useTagsQuery('venue');
    const { data: venues = [] } = useVenuesQuery();
    const { data: djTags = [] } = useTagsQuery('dj');

    const filteredVenues = React.useMemo(() => {
        if (!venue) return venues;
        return venues.filter(v =>
            v.name.toLowerCase().includes(venue.toLowerCase()) ||
            v.address?.toLowerCase().includes(venue.toLowerCase())
        );
    }, [venue, venues]);

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

        const executeSave = async () => {
            try {
                await createSessionMutation.mutateAsync({
                    date: dateIsoStr,
                    title: title.trim(),
                    venue: venue.trim(),
                    venue_id: venueId || undefined,
                    start_time: startTime.trim(),
                    end_time: endTime.trim(),
                    is_collective: isCollective,
                    djs: finalDjs,
                    earning_type: earningType,
                    earning_amount: parseFloat(earningAmount) || 0,
                    currency: currency,
                    recurrence_type: recurrenceType,
                    recurrence_end_date: recurrenceType !== 'none' ? recurrenceEndDate : undefined,
                    color: selectedColor || undefined,
                    status: status
                });

                Alert.alert(t('success'), t('session_added_success'), [
                    { text: 'OK', onPress: onBack }
                ]);
            } catch (error) {
                Alert.alert(t('error'), t('error_saving_session'));
            }
        };

        try {
            // 1. Check duplicate session
            const { data: duplicateData } = await supabase
                .from('sessions')
                .select('id')
                .eq('user_id', session?.user?.id)
                .eq('date', dateIsoStr)
                .limit(1);

            const hasDuplicate = !!(duplicateData && duplicateData.length > 0);

            // 2. Check past date (simple string comparison works for YYYY-MM-DD vs today)
            const todayStr = new Date().toISOString().split('T')[0];
            const isPastDate = dateIsoStr < todayStr;

            const promptChecks = (checkDuplicate: boolean, checkPast: boolean) => {
                if (checkDuplicate) {
                    Alert.alert(
                        t('duplicate_session_title') || 'Sesión existente',
                        t('duplicate_session_message') || 'Ya tienes una o más sesiones registradas en este día. ¿Estás seguro de que quieres añadir otra más?',
                        [
                            { text: t('cancel') || 'Cancelar', style: 'cancel' },
                            {
                                text: t('continue') || 'Continuar',
                                onPress: () => promptChecks(false, checkPast)
                            }
                        ]
                    );
                    return;
                }

                if (checkPast) {
                    Alert.alert(
                        t('past_date_warning_title') || 'Fecha pasada',
                        t('past_date_warning_message') || 'Estás a punto de registrar una sesión en una fecha que ya ha pasado. ¿Deseas continuar?',
                        [
                            { text: t('cancel') || 'Cancelar', style: 'cancel' },
                            { text: t('continue') || 'Continuar', onPress: executeSave }
                        ]
                    );
                    return;
                }

                executeSave();
            };

            promptChecks(hasDuplicate, isPastDate);
        } catch (error) {
            console.error('Error during validation checks:', error);
            // Fallback to save if validation query fails
            executeSave();
        }
    };


    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-950" edges={['top', 'bottom', 'left', 'right']}>
            <View className="flex-row items-center justify-between px-5 pt-2 pb-4 border-b border-gray-100 dark:border-gray-900">
                <TouchableOpacity onPress={onBack} className="p-2 -ml-2">
                    <X size={24} color={isDark ? '#FFF' : '#000'} />
                </TouchableOpacity>
                <Text className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                    {t('add_session')}
                </Text>
                <View className="w-10" />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <ScrollView
                    className="flex-1 px-5 pt-4"
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >

                    {/* Date Input Toggle */}
                    <View className="mb-6 z-40">
                        <View className="flex-row justify-between items-end mb-2">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1 uppercase tracking-wide">
                                {t('date') || 'Date'} *
                            </Text>
                        </View>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                                Keyboard.dismiss();
                                setShowCalendar(!showCalendar);
                            }}
                            className="flex-row items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3.5 shadow-sm shadow-black/5"
                        >
                            <LucideCalendar size={20} color={isDark ? '#9CA3AF' : '#6B7280'} className="mr-3" />
                            <Text className="flex-1 text-base text-gray-900 dark:text-white font-medium">
                                {`${weekday}, ${dateObj.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'long', year: 'numeric' })}`}
                            </Text>
                        </TouchableOpacity>

                        {/* Expandable Calendar Picker */}
                        <View
                            className="mt-4 bg-white dark:bg-gray-900 rounded-3xl p-3 shadow-md shadow-black/5 border border-gray-100 dark:border-gray-800 overflow-hidden"
                            style={{ display: showCalendar ? 'flex' : 'none' }}
                        >
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

                        {/* Recurrence Input Toggle */}
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                                Keyboard.dismiss();
                                setIsRepeatModalVisible(true);
                            }}
                            className="flex-row items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3.5 shadow-sm shadow-black/5 mt-4"
                        >
                            <Repeat size={20} color={isDark ? '#9CA3AF' : '#6B7280'} className="mr-3" />
                            <Text className="flex-1 text-base text-gray-900 dark:text-white font-medium">
                                {recurrenceType === 'none' && t('does_not_repeat')}
                                {recurrenceType === 'daily' && t('daily')}
                                {recurrenceType === 'weekly' && t('weekly')}
                                {recurrenceType === 'monthly' && t('monthly')}
                                {recurrenceType === 'quarterly' && t('quarterly')}
                                {recurrenceType === 'biannually' && t('biannually')}
                                {recurrenceType === 'yearly' && t('yearly')}
                            </Text>
                        </TouchableOpacity>

                        {/* Recurrence End Date Toggle (Only if repeating) */}
                        {recurrenceType !== 'none' && (
                            <>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        Keyboard.dismiss();
                                        setShowEndCalendar(!showEndCalendar);
                                    }}
                                    className="flex-row items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3.5 shadow-sm shadow-black/5 mt-3 ml-8"
                                >
                                    <Text className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                                        {t('repeat_until')}
                                    </Text>
                                    <Text className="flex-1 text-base text-gray-900 dark:text-white font-medium">
                                        {(() => {
                                            const [ey, em, ed] = recurrenceEndDate.split('-');
                                            const edateObj = new Date(Number(ey), Number(em) - 1, Number(ed));
                                            return edateObj.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'long', year: 'numeric' });
                                        })()}
                                    </Text>
                                </TouchableOpacity>

                                {/* Expandable End Calendar Picker */}
                                <View
                                    className="mt-3 ml-8 bg-white dark:bg-gray-900 rounded-3xl p-3 shadow-md shadow-black/5 border border-gray-100 dark:border-gray-800 overflow-hidden"
                                    style={{ display: showEndCalendar ? 'flex' : 'none' }}
                                >
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
                                            setRecurrenceEndDate(day.dateString);
                                            setShowEndCalendar(false);
                                        }}
                                        minDate={sessionDate}
                                        markedDates={{
                                            [recurrenceEndDate]: {
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
                            </>
                        )}

                        {/* Custom Color Toggle */}
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                                Keyboard.dismiss();
                                setIsColorModalVisible(true);
                            }}
                            className="flex-row items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3.5 shadow-sm shadow-black/5 mt-4"
                        >
                            {!selectedColor ? (
                                <View className="w-5 h-5 rounded-full mr-3" style={{ backgroundColor: '#262626' }} />
                            ) : (
                                <View className="w-5 h-5 rounded-full mr-3" style={{ backgroundColor: selectedColor }} />
                            )}
                            <Text className="flex-1 text-base text-gray-900 dark:text-white font-medium">
                                {!selectedColor && (t('color_default') || 'Color predeterminado')}
                                {selectedColor === '#EF4444' && t('color_tomato')}
                                {selectedColor === '#F97316' && t('color_tangerine')}
                                {selectedColor === '#FBBF24' && t('color_banana')}
                                {selectedColor === '#10B981' && t('color_basil')}
                                {selectedColor === '#34D399' && t('color_sage')}
                                {selectedColor === '#0EA5E9' && t('color_peacock')}
                                {selectedColor === '#3B82F6' && t('color_blueberry')}
                                {selectedColor === '#8B5CF6' && t('color_lavender')}
                                {selectedColor === '#9333EA' && t('color_grape')}
                                {selectedColor === '#F43F5E' && t('color_flamingo')}
                                {selectedColor === '#6B7280' && t('color_graphite')}
                            </Text>
                            <ChevronRight size={20} color={isDark ? '#4B5563' : '#D1D5DB'} />
                        </TouchableOpacity>
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
                                            className="mr-2 mb-2 px-3 py-1.5 rounded-full border flex-row items-center"
                                            style={{ backgroundColor: '#262626', borderColor: '#404040' }}
                                            onPress={() => {
                                                setTitle(tag.name);
                                            }}
                                            onPressOut={() => setFocusedInput(null)}
                                        >
                                            <Text className="font-medium" style={{ color: '#A3A3A3' }}>{tag.name}</Text>
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

                        <View className="z-40">
                            <View className="flex-row justify-between items-end mb-2">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1 uppercase tracking-wide">
                                    {t('venue')} *
                                </Text>
                            </View>

                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setIsVenueModalVisible(true);
                                }}
                                className={`flex-row items-center rounded-2xl border-2 py-4 px-5 ${venueId ? 'border-blue-500 bg-blue-50/10' : 'border-transparent bg-white dark:bg-gray-900 shadow-sm shadow-black/5'}`}
                            >
                                <MapPin size={22} color={venueId ? (isDark ? '#60A5FA' : '#3B82F6') : (isDark ? '#6B7280' : '#9CA3AF')} />
                                <Text className={`flex-1 ml-3 text-base font-medium ${venue ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                                    {venue || t('venue_placeholder')}
                                </Text>
                                <ChevronRight size={20} color={isDark ? '#4B5563' : '#D1D5DB'} />
                            </TouchableOpacity>

                            {/* Venue Selection Modal */}
                            <Modal visible={isVenueModalVisible} animationType="slide" transparent>
                                <View className="flex-1 justify-end bg-black/60">
                                    <Pressable className="flex-1" onPress={() => setIsVenueModalVisible(false)} />
                                    <KeyboardAvoidingView
                                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                                        className="bg-white dark:bg-gray-950 rounded-t-[40px] px-6 pt-8 pb-10 h-[80%]"
                                    >
                                        <View className="flex-row items-center justify-between mb-6">
                                            <Text className="text-2xl font-black text-gray-900 dark:text-white">{t('venues_title')}</Text>
                                            <TouchableOpacity onPress={() => setIsVenueModalVisible(false)} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-900 items-center justify-center">
                                                <X size={24} color={isDark ? '#FFF' : '#000'} />
                                            </TouchableOpacity>
                                        </View>

                                        <ScrollView showsVerticalScrollIndicator={false}>
                                            {/* Option to just use text if they want */}
                                            <View className="mb-6">
                                                <View className="flex-row items-center bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 pr-3">
                                                    <TextInput
                                                        className="flex-1 px-4 py-3 text-gray-900 dark:text-white font-bold"
                                                        placeholder={t('venue_placeholder')}
                                                        value={venue}
                                                        onChangeText={setVenue}
                                                        onFocus={() => setVenueId(null)}
                                                    />
                                                    {venue.length > 0 && (
                                                        <TouchableOpacity onPress={() => { setVenue(''); setVenueId(null); }}>
                                                            <X size={18} color={isDark ? '#4B5563' : '#9CA3AF'} />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                                {venue.trim().length > 0 && !venues.some(v => v.name.toLowerCase() === venue.toLowerCase()) && (
                                                    <TouchableOpacity
                                                        onPress={async () => {
                                                            try {
                                                                const newVenue = await createVenueMutation.mutateAsync({ name: venue.trim() });
                                                                setVenue(newVenue.name);
                                                                setVenueId(newVenue.id);
                                                                setIsVenueModalVisible(false);
                                                            } catch (error) {
                                                                Alert.alert(t('error'), t('error_saving_session'));
                                                            }
                                                        }}
                                                        className="mt-3 flex-row items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800"
                                                    >
                                                        <View className="w-8 h-8 rounded-full bg-blue-600 items-center justify-center mr-3">
                                                            <Plus size={16} color="#FFF" />
                                                        </View>
                                                        <Text className="text-blue-600 dark:text-blue-400 font-bold flex-1">
                                                            {t('add_as_new_venue', { name: venue.trim() })}
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t('venues_title')}</Text>
                                            {filteredVenues.length === 0 ? (
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setIsVenueModalVisible(false);
                                                        router.push('/(tabs)/venues');
                                                    }}
                                                    className="items-center py-10 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700"
                                                >
                                                    <Plus size={24} color="#3B82F6" />
                                                    <Text className="text-blue-600 font-bold mt-2">{t('add_venue')}</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                filteredVenues.map((v) => (
                                                    <TouchableOpacity
                                                        key={v.id}
                                                        onPress={() => {
                                                            setVenue(v.name);
                                                            setVenueId(v.id);
                                                            setIsVenueModalVisible(false);
                                                        }}
                                                        className={`flex-row items-center p-4 mb-3 rounded-2xl border ${venueId === v.id ? 'border-blue-500 bg-blue-50/10' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900'}`}
                                                    >
                                                        <MapPin size={20} color={venueId === v.id ? '#3B82F6' : '#9CA3AF'} />
                                                        <View className="ml-3 flex-1">
                                                            <Text className={`font-bold ${venueId === v.id ? 'text-blue-600' : 'text-gray-900 dark:text-white'}`}>{v.name}</Text>
                                                            {v.address && <Text className="text-xs text-gray-400" numberOfLines={1}>{v.address}</Text>}
                                                        </View>
                                                        {venueId === v.id && <Check size={20} color="#3B82F6" />}
                                                    </TouchableOpacity>
                                                ))
                                            )}
                                        </ScrollView>

                                        <TouchableOpacity
                                            onPress={() => setIsVenueModalVisible(false)}
                                            className="mt-6 bg-blue-600 py-4 rounded-2xl items-center"
                                        >
                                            <Text className="text-white font-black text-lg">{t('filter_apply')}</Text>
                                        </TouchableOpacity>
                                    </KeyboardAvoidingView>
                                </View>
                            </Modal>
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
                                            className="mr-2 mb-2 px-3 py-1.5 rounded-full border flex-row items-center"
                                            style={{ backgroundColor: '#262626', borderColor: '#404040' }}
                                            onPress={() => {
                                                if (!selectedDjs.includes(tag.name)) {
                                                    setSelectedDjs([...selectedDjs, tag.name]);
                                                    setDjInput(''); // Clear input after selection
                                                }
                                            }}
                                            onPressOut={() => setFocusedInput(null)}
                                        >
                                            <Users size={14} color="#A3A3A3" className="mr-1.5" />
                                            <Text className="font-medium" style={{ color: '#A3A3A3' }}>{tag.name}</Text>
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
                                        const hashTagColor = '#A3A3A3';
                                        return (
                                            <View key={index} className="flex-row items-center bg-gray-800 rounded-full px-3 py-1.5 mr-2 mb-2 border border-gray-700">
                                                <Text className="font-semibold mr-2" style={{ color: hashTagColor }}>{dj}</Text>
                                                <TouchableOpacity onPress={() => setSelectedDjs(selectedDjs.filter(d => d !== dj))} className="bg-gray-700/50 rounded-full p-1">
                                                    <X size={12} color="#D1D5DB" />
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

                        {/* Status Section */}
                        <View className="z-10 mt-6">
                            <View className="flex-row justify-between items-end mb-2">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1 uppercase tracking-wide">
                                    {t('session_status', { status: '' }).replace(':', '').trim() || 'Status'}
                                </Text>
                            </View>

                            <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1F2937' : '#F3F4F6', borderRadius: 12, padding: 4, marginBottom: 16 }}>
                                {[
                                    { id: 'confirmed', label: t('status_confirmed') || 'Confirmada', color: isDark ? '#60A5FA' : '#2563EB', activeBg: isDark ? '#374151' : '#FFFFFF' },
                                    { id: 'pending', label: t('status_pending') || 'Pendiente', color: isDark ? '#F97316' : '#EA580C', activeBg: isDark ? '#374151' : '#FFFFFF' },
                                    { id: 'cancelled', label: t('status_cancelled') || 'Caída', color: isDark ? '#EF4444' : '#DC2626', activeBg: isDark ? '#374151' : '#FFFFFF' }
                                ].map((type) => (
                                    <TouchableOpacity
                                        key={type.id}
                                        onPress={() => setStatus(type.id as any)}
                                        style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: status === type.id ? type.activeBg : 'transparent' }}
                                    >
                                        <Text style={{ fontSize: 13, fontWeight: '600', color: status === type.id ? type.color : (isDark ? '#9CA3AF' : '#6B7280') }}>
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
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

                            <View className={`${earningType === 'free' ? 'hidden' : 'flex-row items-center gap-2'} mt-1`}>
                                <View className={`flex-1 relative justify-center rounded-2xl border-2 overflow-hidden ${focusedInput === 'earning' ? 'border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-900 shadow-sm shadow-blue-500/10' : 'border-transparent bg-white dark:bg-gray-900 shadow-sm shadow-black/5'}`}>
                                    <View className="absolute left-4 z-10 w-6 items-center">
                                        <Text className="text-xl font-medium text-gray-400 dark:text-gray-500">{currency}</Text>
                                    </View>
                                    <TextInput
                                        className="pl-12 pr-5 py-4 text-gray-900 dark:text-white text-base font-medium"
                                        placeholder={t('earning_amount') || 'Importe'}
                                        placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                        keyboardType="numeric"
                                        value={earningAmount}
                                        onChangeText={setEarningAmount}
                                        onFocus={() => handleFocus('earning')}
                                        onBlur={handleBlur}
                                    />
                                </View>

                                {/* Currency Dropdown Selector */}
                                <View className="h-14 w-20">
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            Keyboard.dismiss();
                                            setFocusedInput('currencyMenu');
                                        }}
                                        className="h-full bg-white dark:bg-gray-900 border-2 border-transparent shadow-sm shadow-black/5 rounded-2xl flex-row items-center justify-center"
                                        style={focusedInput === 'currencyMenu' ? { borderColor: isDark ? '#60A5FA' : '#3B82F6' } : {}}
                                    >
                                        <Text className="text-xl font-bold text-gray-900 dark:text-white mr-1">{currency}</Text>
                                        <ChevronRight size={14} color={isDark ? '#9CA3AF' : '#6B7280'} style={{ transform: [{ rotate: focusedInput === 'currencyMenu' ? '-90deg' : '90deg' }] }} />
                                    </TouchableOpacity>

                                    {/* Modal Dropdown Menu */}
                                    <Modal
                                        visible={focusedInput === 'currencyMenu'}
                                        transparent={true}
                                        animationType="fade"
                                        onRequestClose={() => setFocusedInput(null)}
                                    >
                                        <TouchableOpacity
                                            activeOpacity={1}
                                            onPress={() => setFocusedInput(null)}
                                            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                                        >
                                            <View className="w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden py-2" style={{ elevation: 10 }}>
                                                {['€', '$', '£', '¥'].map((curr) => (
                                                    <TouchableOpacity
                                                        key={curr}
                                                        onPress={() => {
                                                            setCurrency(curr);
                                                            setFocusedInput(null);
                                                        }}
                                                        className="px-6 py-4 items-center flex-row justify-between border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                                                    >
                                                        <Text className={`text-xl font-bold ${currency === curr ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                                            {curr === '€' ? 'Euro' : curr === '$' ? 'Dólar' : curr === '£' ? 'Libra' : 'Yen'}
                                                        </Text>
                                                        <Text className={`text-xl font-bold ${currency === curr ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                                            {curr}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </TouchableOpacity>
                                    </Modal>
                                </View>
                            </View>
                            {/*<View className={earningType === 'hourly' && earningAmount.length > 0 ? 'flex' : 'hidden'}>
                                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-2 ml-2">
                                    {t('total_earnings') || 'Total:'} <Text className="text-green-600 dark:text-green-500 font-bold">{getEstimatedTotal() || 0} €</Text> ({calculateTotalHours()}h)
                                </Text>
                            </View>*/}
                        </View>
                    </View>

                </ScrollView>

                {/* Fixed Save Button */}
                <View className="absolute bottom-0 left-0 right-0 bg-gray-50/95 dark:bg-gray-950/95 border-t border-gray-200/50 dark:border-gray-800/50 px-5 py-4 pb-8" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10 }}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        className={`flex-row justify-center items-center py-4 rounded-2xl shadow-lg ${createSessionMutation.isPending || !title.trim() || !venue.trim()
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
                </View>
            </KeyboardAvoidingView>

            {/* Repeat Type Modal */}
            <Modal
                visible={isRepeatModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsRepeatModalVisible(false)}
            >
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                    activeOpacity={1}
                    onPress={() => setIsRepeatModalVisible(false)}
                >
                    <View className="bg-white dark:bg-gray-900 w-4/5 rounded-3xl p-2 shadow-xl shadow-black">
                        {[
                            { value: 'none', label: t('does_not_repeat') },
                            { value: 'daily', label: t('daily') },
                            { value: 'weekly', label: t('weekly') },
                            { value: 'monthly', label: t('monthly') },
                            { value: 'quarterly', label: t('quarterly') },
                            { value: 'biannually', label: t('biannually') },
                            { value: 'yearly', label: t('yearly') }
                        ].map((item, index, array) => (
                            <TouchableOpacity
                                key={item.value}
                                className={`flex-row items-center py-4 px-5 ${index !== array.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
                                onPress={() => {
                                    setRecurrenceType(item.value as any);
                                    setIsRepeatModalVisible(false);
                                }}
                            >
                                <View className="w-8 items-center justify-center">
                                    {recurrenceType === item.value && (
                                        <Text className="text-blue-500 font-bold text-lg">✓</Text>
                                    )}
                                </View>
                                <Text className={`flex-1 text-base ${recurrenceType === item.value ? 'font-bold text-blue-500' : 'text-gray-800 dark:text-gray-200'}`}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Color Picker Modal */}
            <Modal
                visible={isColorModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsColorModalVisible(false)}
            >
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
                    activeOpacity={1}
                    onPress={() => setIsColorModalVisible(false)}
                >
                    <View className="bg-white dark:bg-gray-900 rounded-t-3xl pt-2 pb-8 shadow-xl">
                        <View className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto my-3" />
                        <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
                            {[
                                { value: '#EF4444', label: t('color_tomato') || 'Tomate' },
                                { value: '#F97316', label: t('color_tangerine') || 'Mandarina' },
                                { value: '#FBBF24', label: t('color_banana') || 'Plátano' },
                                { value: '#10B981', label: t('color_basil') || 'Albahaca' },
                                { value: '#34D399', label: t('color_sage') || 'Salvia' },
                                { value: '#0EA5E9', label: t('color_peacock') || 'Pavo real' },
                                { value: '#3B82F6', label: t('color_blueberry') || 'Arándano' },
                                { value: '#8B5CF6', label: t('color_lavender') || 'Lavanda' },
                                { value: '#9333EA', label: t('color_grape') || 'Uva morada' },
                                { value: '#F43F5E', label: t('color_flamingo') || 'Flamenco' },
                                { value: '#6B7280', label: t('color_graphite') || 'Grafito' },
                                { value: null, label: t('color_default') || 'Color predeterminado', isDefault: true }
                            ].map((item, index) => (
                                <TouchableOpacity
                                    key={item.label}
                                    className="flex-row items-center py-4 px-6 border-b border-gray-50 dark:border-gray-800/50"
                                    onPress={() => {
                                        setSelectedColor(item.value);
                                        setIsColorModalVisible(false);
                                    }}
                                >
                                    <View className="w-8 items-center justify-center">
                                        {selectedColor === item.value && (
                                            <Text className="text-gray-900 dark:text-white font-bold text-lg">✓</Text>
                                        )}
                                    </View>
                                    <Text className={`flex-1 text-base ml-2 ${selectedColor === item.value ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                        {item.label}
                                    </Text>
                                    {item.isDefault ? (
                                        <View className="w-5 h-5 rounded-full" style={{ backgroundColor: '#262626' }} />
                                    ) : (
                                        <View className="w-5 h-5 rounded-full" style={{ backgroundColor: item.value as string }} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

        </SafeAreaView >
    );
}
