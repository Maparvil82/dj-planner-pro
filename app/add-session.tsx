import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Switch, Keyboard, KeyboardAvoidingView, Platform, Modal, Pressable, Image } from 'react-native';
import React, { useState, useRef, useContext, useEffect } from 'react';
import { Stack, useGlobalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from '../src/i18n/useTranslation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/useAuthStore';
import { Calendar as LucideCalendar, MapPin, Clock, Users, X, DollarSign, ChevronRight, Repeat, Palette, Check, Plus, Camera } from 'lucide-react-native';
import { ThemeContext } from '../src/contexts/ThemeContext';
import { useCreateSessionMutation } from '../src/hooks/useSessionsQuery';
import { useTagsQuery } from '../src/hooks/useTagsQuery';
import { useVenuesQuery, useCreateVenueMutation } from '../src/hooks/useVenuesQuery';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { setupCalendarLocales } from '../src/i18n/calendarLocales';
import { supabase } from '../src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { sessionService } from '../src/services/sessions';

setupCalendarLocales();

export default function AddSessionScreen() {
    const { date } = useGlobalSearchParams<{ date: string }>();
    const router = useRouter();
    const { t, currentLanguage } = useTranslation();
    const { session } = useAuthStore();
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
    const [status, setStatus] = useState<'pending' | 'confirmed' | 'cancelled'>('confirmed');
    const [earningType, setEarningType] = useState<'free' | 'hourly' | 'fixed'>('free');
    const [earningAmount, setEarningAmount] = useState('');
    const [currency, setCurrency] = useState('€');

    const [sessionDate, setSessionDate] = useState(() => {
        const d = date ? new Date(date) : new Date();
        return d.toISOString().split('T')[0];
    });
    const [showCalendar, setShowCalendar] = useState(false);

    const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'yearly'>('none');
    const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>(() => {
        const d = date ? new Date(date + 'T12:00:00Z') : new Date();
        d.setUTCMonth(d.getUTCMonth() + 1);
        return d.toISOString().split('T')[0];
    });
    const [showEndCalendar, setShowEndCalendar] = useState(false);
    const [isRepeatModalVisible, setIsRepeatModalVisible] = useState(false);
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [isColorModalVisible, setIsColorModalVisible] = useState(false);
    const [isCollective, setIsCollective] = useState(false);
    const [djInput, setDjInput] = useState('');
    const [selectedDjs, setSelectedDjs] = useState<string[]>([]);
    const [focusedInput, setFocusedInput] = useState<string | null>(null);
    const [posterUrl, setPosterUrl] = useState<string | null>(null);
    const [isUploadingPoster, setIsUploadingPoster] = useState(false);

    useEffect(() => {
        const sd = new Date(sessionDate + 'T12:00:00Z');
        const ed = new Date(recurrenceEndDate + 'T12:00:00Z');
        if (sd > ed) {
            sd.setUTCMonth(sd.getUTCMonth() + 1);
            setRecurrenceEndDate(sd.toISOString().split('T')[0]);
        }
    }, [sessionDate]);

    const handleFocus = (type: string) => setFocusedInput(type);
    const handleBlur = () => setTimeout(() => setFocusedInput(null), 150);

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
        ? titleTags.filter(t => t.name.toLowerCase().includes(title.toLowerCase()) && t.name.toLowerCase() !== title.toLowerCase()).slice(0, 10)
        : [];

    const filteredVenueTags = venue.trim().length > 0
        ? venueTags.filter(v => v.name.toLowerCase().includes(venue.toLowerCase()) && v.name.toLowerCase() !== venue.toLowerCase()).slice(0, 10)
        : [];

    const filteredDjTags = djInput.trim().length > 0
        ? djTags.filter(d => d.name.toLowerCase().includes(djInput.toLowerCase()) && !selectedDjs.includes(d.name)).slice(0, 10)
        : [];

    const dateParts = sessionDate.split('-');
    const dateObj = dateParts.length === 3 ? new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2])) : new Date();
    const weekday = dateObj.toLocaleDateString(currentLanguage, { weekday: 'long' });
    LocaleConfig.defaultLocale = currentLanguage;

    const handlePickPoster = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('error'), 'Permission to access media library is required');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets[0].uri) {
            setIsUploadingPoster(true);
            try {
                const url = await sessionService.uploadSessionPoster(session?.user?.id || '', result.assets[0].uri);
                if (url) {
                    setPosterUrl(url);
                } else {
                    Alert.alert(t('error'), t('error_uploading'));
                }
            } catch (error) {
                console.error('Error picking poster:', error);
                Alert.alert(t('error'), t('error_uploading'));
            } finally {
                setIsUploadingPoster(false);
            }
        }
    };

    const handleSave = async () => {
        if (!title.trim() || !venue.trim()) {
            Alert.alert(t('error'), t('missing_fields'));
            return;
        }

        let finalDjs = [...selectedDjs];
        if (isCollective && djInput.trim().length > 0 && !finalDjs.includes(djInput.trim())) {
            finalDjs.push(djInput.trim());
        }

        const executeSave = async () => {
            try {
                await createSessionMutation.mutateAsync({
                    date: sessionDate,
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
                    status: status,
                    poster_url: posterUrl
                });
                Alert.alert(t('success'), t('session_added_success'), [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            } catch (error) {
                Alert.alert(t('error'), t('error_saving_session'));
            }
        };

        try {
            const { data: duplicateData } = await supabase
                .from('sessions')
                .select('id')
                .eq('user_id', session?.user?.id)
                .eq('date', sessionDate)
                .limit(1);

            const hasDuplicate = !!(duplicateData && duplicateData.length > 0);
            const todayStr = new Date().toISOString().split('T')[0];
            const isPastDate = sessionDate < todayStr;

            const promptChecks = (checkDuplicate: boolean, checkPast: boolean) => {
                if (checkDuplicate) {
                    Alert.alert(
                        t('duplicate_session_title') || 'Sesión existente',
                        t('duplicate_session_message') || 'Ya tienes una o más sesiones registradas en este día. ¿Estás seguro de que quieres añadir otra más?',
                        [
                            { text: t('cancel') || 'Cancelar', style: 'cancel' },
                            { text: t('continue') || 'Continuar', onPress: () => promptChecks(false, checkPast) }
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
            executeSave();
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-950" edges={['top', 'bottom', 'left', 'right']}>
            <View className="flex-row items-center justify-between px-5 pt-2 pb-4 border-b border-gray-100 dark:border-gray-900">
                <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
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
                    {/* UI components same as before but inside Main */}
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
                            className="flex-row items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3.5"
                        >
                            <LucideCalendar size={20} color={isDark ? '#9CA3AF' : '#6B7280'} className="mr-3" />
                            <Text className="flex-1 text-base text-gray-900 dark:text-white font-medium">
                                {`${weekday}, ${dateObj.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'long', year: 'numeric' })}`}
                            </Text>
                        </TouchableOpacity>

                        <View className="mt-4 bg-white dark:bg-gray-900 rounded-3xl p-3 border border-gray-100 dark:border-gray-800 overflow-hidden" style={{ display: showCalendar ? 'flex' : 'none' }}>
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

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => { Keyboard.dismiss(); setIsRepeatModalVisible(true); }}
                            className="flex-row items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3.5 mt-4"
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

                        {recurrenceType !== 'none' && (
                            <>
                                <TouchableOpacity activeOpacity={0.8} onPress={() => { Keyboard.dismiss(); setShowEndCalendar(!showEndCalendar); }} className="flex-row items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3.5 mt-3 ml-8">
                                    <Text className="text-sm text-gray-500 dark:text-gray-400 mr-2">{t('repeat_until')}</Text>
                                    <Text className="flex-1 text-base text-gray-900 dark:text-white font-medium">
                                        {(() => {
                                            const parts = recurrenceEndDate.split('-');
                                            const ed = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                                            return ed.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'long', year: 'numeric' });
                                        })()}
                                    </Text>
                                </TouchableOpacity>
                                <View className="mt-3 ml-8 bg-white dark:bg-gray-900 rounded-3xl p-3 border border-gray-100 dark:border-gray-800 overflow-hidden" style={{ display: showEndCalendar ? 'flex' : 'none' }}>
                                    <Calendar
                                        markingType={'custom'}
                                        onDayPress={(day: any) => { setRecurrenceEndDate(day.dateString); setShowEndCalendar(false); }}
                                        minDate={sessionDate}
                                        markedDates={{ [recurrenceEndDate]: { selected: true, customStyles: { container: { backgroundColor: '#3B82F6', borderRadius: 10 }, text: { color: 'white', fontWeight: 'bold' } } } }}
                                    />
                                </View>
                            </>
                        )}

                        <TouchableOpacity activeOpacity={0.8} onPress={() => { Keyboard.dismiss(); setIsColorModalVisible(true); }} className="flex-row items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3.5 mt-4">
                            {!selectedColor ? <View className="w-5 h-5 rounded-full mr-3" style={{ backgroundColor: '#262626' }} /> : <View className="w-5 h-5 rounded-full mr-3" style={{ backgroundColor: selectedColor }} />}
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

                    <View className="flex-col gap-6">
                        <View className="z-50">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">{t('session_title')} *</Text>
                            <View className={`rounded-2xl border-2 ${focusedInput === 'title' ? 'border-blue-500 bg-white dark:bg-gray-900' : 'border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-900'}`}>
                                <TextInput className="px-5 py-4 text-gray-900 dark:text-white text-base font-medium" placeholder={t('session_title_placeholder')} value={title} onChangeText={setTitle} onFocus={() => handleFocus('title')} onBlur={handleBlur} />
                            </View>
                        </View>

                        <View className="z-40">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">{t('venue')} *</Text>
                            <TouchableOpacity activeOpacity={0.8} onPress={() => { Keyboard.dismiss(); setIsVenueModalVisible(true); }} className={`flex-row items-center rounded-2xl border-2 py-4 px-5 ${venueId ? 'border-blue-500 bg-blue-50/10' : 'border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-900'}`}>
                                <MapPin size={22} color={venueId ? '#3B82F6' : '#9CA3AF'} /><Text className={`flex-1 ml-3 text-base font-medium ${venue ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{venue || t('venue_placeholder')}</Text><ChevronRight size={20} color="#D1D5DB" />
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row items-center justify-between mb-4 mt-2 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                            <View className="flex-row items-center"><Users size={20} color={isDark ? '#60A5FA' : '#3B82F6'} className="mr-3" /><Text className="text-base font-semibold text-gray-900 dark:text-white">{t('collective_session')}</Text></View>
                            <Switch value={isCollective} onValueChange={setIsCollective} />
                        </View>

                        {isCollective && (
                            <View className="z-30">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">{t('add_djs')}</Text>
                                <View className={`rounded-2xl border-2 flex-row items-center pl-5 ${focusedInput === 'dj' ? 'border-blue-500 bg-white dark:bg-gray-900' : 'border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-900'}`}>
                                    <Users size={22} color={focusedInput === 'dj' ? '#3B82F6' : '#9CA3AF'} />
                                    <TextInput className="flex-1 px-4 py-4 text-gray-900 dark:text-white text-base font-medium" placeholder={t('add_djs_placeholder')} value={djInput} onChangeText={setDjInput} onFocus={() => handleFocus('dj')} onBlur={handleBlur} onSubmitEditing={() => { if (djInput.trim()) { setSelectedDjs([...selectedDjs, djInput.trim()]); setDjInput(''); } }} />
                                </View>
                            </View>
                        )}

                        <View className="flex-row space-x-4">
                            <View className="flex-1 mr-2"><Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">{t('start_time')}</Text><View className="bg-white dark:bg-gray-900 rounded-2xl flex-row items-center pl-4 border border-gray-100 dark:border-gray-900"><Clock size={20} color="#9CA3AF" /><TextInput className="flex-1 px-3 py-4 text-gray-900 dark:text-white font-medium" value={startTime} onChangeText={setStartTime} /></View></View>
                            <View className="flex-1 ml-2"><Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">{t('end_time')}</Text><View className="bg-white dark:bg-gray-900 rounded-2xl flex-row items-center pl-4 border border-gray-100 dark:border-gray-900"><Clock size={20} color="#9CA3AF" /><TextInput className="flex-1 px-3 py-4 text-gray-900 dark:text-white font-medium" value={endTime} onChangeText={setEndTime} /></View></View>
                        </View>

                        <View style={{ marginTop: 24, zIndex: 10 }}>
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">{t('session_status', { status: '' }).replace(':', '').trim()}</Text>
                            <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1F2937' : '#F3F4F6', borderRadius: 12, padding: 4, marginBottom: 16 }}>
                                <TouchableOpacity
                                    style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: status === 'confirmed' ? (isDark ? '#374151' : '#FFFFFF') : 'transparent' }}
                                    onPress={() => setStatus('confirmed')}
                                >
                                    <Text style={{ fontWeight: '600', color: status === 'confirmed' ? (isDark ? '#60A5FA' : '#2563EB') : (isDark ? '#9CA3AF' : '#6B7280') }}>{t('status_confirmed')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: status === 'pending' ? (isDark ? '#374151' : '#FFFFFF') : 'transparent' }}
                                    onPress={() => setStatus('pending')}
                                >
                                    <Text style={{ fontWeight: '600', color: status === 'pending' ? (isDark ? '#F97316' : '#EA580C') : (isDark ? '#9CA3AF' : '#6B7280') }}>{t('status_pending')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: status === 'cancelled' ? (isDark ? '#374151' : '#FFFFFF') : 'transparent' }}
                                    onPress={() => setStatus('cancelled')}
                                >
                                    <Text style={{ fontWeight: '600', color: status === 'cancelled' ? (isDark ? '#EF4444' : '#DC2626') : (isDark ? '#9CA3AF' : '#6B7280') }}>{t('status_cancelled')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={{ zIndex: 10, marginTop: 8 }}>
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">{t('earning_type')}</Text>
                            <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1F2937' : '#F3F4F6', borderRadius: 12, padding: 4, marginBottom: 16 }}>
                                <TouchableOpacity
                                    style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: earningType === 'free' ? (isDark ? '#374151' : '#FFFFFF') : 'transparent' }}
                                    onPress={() => setEarningType('free')}
                                >
                                    <Text style={{ fontWeight: '600', color: earningType === 'free' ? (isDark ? '#60A5FA' : '#2563EB') : (isDark ? '#9CA3AF' : '#6B7280') }}>{t('earning_free')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: earningType === 'hourly' ? (isDark ? '#374151' : '#FFFFFF') : 'transparent' }}
                                    onPress={() => setEarningType('hourly')}
                                >
                                    <Text style={{ fontWeight: '600', color: earningType === 'hourly' ? (isDark ? '#60A5FA' : '#2563EB') : (isDark ? '#9CA3AF' : '#6B7280') }}>{t('earning_hourly')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: earningType === 'fixed' ? (isDark ? '#374151' : '#FFFFFF') : 'transparent' }}
                                    onPress={() => setEarningType('fixed')}
                                >
                                    <Text style={{ fontWeight: '600', color: earningType === 'fixed' ? (isDark ? '#60A5FA' : '#2563EB') : (isDark ? '#9CA3AF' : '#6B7280') }}>{t('earning_fixed')}</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{ display: earningType !== 'free' ? 'flex' : 'none', backgroundColor: isDark ? '#111827' : '#FFFFFF', borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingLeft: 20, borderWidth: 1, borderColor: isDark ? '#1F2937' : '#F3F4F6' }}>
                                <Text style={{ fontSize: 20, color: '#9CA3AF' }}>{currency}</Text>
                                <TextInput style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16, color: isDark ? '#FFFFFF' : '#111827', fontSize: 16, fontWeight: '500' }} keyboardType="numeric" value={earningAmount} onChangeText={setEarningAmount} />
                            </View>
                        </View>

                        {/* Event Poster Section */}
                        <View className="mt-4 mb-6">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 ml-1 uppercase tracking-wide">
                                {t('session_poster') || 'Cartel'}
                            </Text>

                            {posterUrl ? (
                                <View className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                                    <Image
                                        source={{ uri: posterUrl }}
                                        className="w-full h-full"
                                        resizeMode="cover"
                                    />
                                    <TouchableOpacity
                                        onPress={() => {
                                            sessionService.deleteSessionPoster(posterUrl);
                                            setPosterUrl(null);
                                        }}
                                        className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full items-center justify-center backdrop-blur-md"
                                    >
                                        <X size={20} color="white" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={handlePickPoster}
                                    disabled={isUploadingPoster}
                                    className="w-full aspect-[3/4] bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl items-center justify-center p-6"
                                >
                                    {isUploadingPoster ? (
                                        <ActivityIndicator color={isDark ? '#60A5FA' : '#3B82F6'} />
                                    ) : (
                                        <>
                                            <View className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full items-center justify-center mb-4 shadow-sm">
                                                <Camera size={28} color={isDark ? '#D1D5DB' : '#4B5563'} strokeWidth={1.5} />
                                            </View>
                                            <Text className="text-gray-900 dark:text-white font-bold text-lg mb-1">{t('add_poster')}</Text>
                                            <Text className="text-gray-500 dark:text-gray-400 text-sm text-center">Formatos JPG o PNG (3:4 recomendado)</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </ScrollView>

                <View className="absolute bottom-0 left-0 right-0 bg-gray-50/95 dark:bg-gray-950/95 px-5 py-4 pb-8 border-t border-gray-200 dark:border-gray-800">
                    <TouchableOpacity activeOpacity={0.8} className={`py-4 rounded-2xl items-center ${createSessionMutation.isPending || !title.trim() || !venue.trim() ? 'bg-blue-300' : 'bg-blue-600'}`} onPress={handleSave} disabled={createSessionMutation.isPending || !title.trim() || !venue.trim()}>
                        {createSessionMutation.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">{t('save_session')}</Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Modals for Repeat and Color Picker same as before */}
            <Modal visible={isRepeatModalVisible} transparent animationType="fade">
                <TouchableOpacity className="flex-1 bg-black/50 justify-center items-center" onPress={() => setIsRepeatModalVisible(false)}>
                    <View className="bg-white dark:bg-gray-900 w-4/5 rounded-3xl p-2">
                        {[{ v: 'none', l: t('does_not_repeat') }, { v: 'daily', l: t('daily') }, { v: 'weekly', l: t('weekly') }, { v: 'monthly', l: t('monthly') }, { v: 'quarterly', l: t('quarterly') }, { v: 'biannually', l: t('biannually') }, { v: 'yearly', l: t('yearly') }].map(item => (
                            <TouchableOpacity key={item.v} className="py-4 px-5 border-b border-gray-100 dark:border-gray-800" onPress={() => { setRecurrenceType(item.v as any); setIsRepeatModalVisible(false); }}>
                                <Text className={`text-base ${recurrenceType === item.v ? 'font-bold text-blue-500' : 'text-gray-800 dark:text-gray-200'}`}>{item.l}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal visible={isColorModalVisible} transparent animationType="slide">
                <TouchableOpacity className="flex-1 bg-black/50 justify-end" onPress={() => setIsColorModalVisible(false)}>
                    <View className="bg-white dark:bg-gray-900 rounded-t-3xl pt-2 pb-8">
                        <View className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto my-3" />
                        <ScrollView className="max-h-96">
                            {[
                                { v: '#EF4444', l: t('color_tomato') }, { v: '#F97316', l: t('color_tangerine') },
                                { v: '#FBBF24', l: t('color_banana') }, { v: '#10B981', l: t('color_basil') },
                                { v: '#34D399', l: t('color_sage') }, { v: '#0EA5E9', l: t('color_peacock') },
                                { v: '#3B82F6', l: t('color_blueberry') }, { v: '#8B5CF6', l: t('color_lavender') },
                                { v: '#9333EA', l: t('color_grape') }, { v: '#F43F5E', l: t('color_flamingo') },
                                { v: '#6B7280', l: t('color_graphite') }, { v: null, l: t('color_default'), isDefault: true }
                            ].map(item => (
                                <TouchableOpacity key={item.l} className="flex-row items-center py-4 px-6 border-b border-gray-50 dark:border-gray-800" onPress={() => { setSelectedColor(item.v); setIsColorModalVisible(false); }}>
                                    <View className="w-5 h-5 rounded-full mr-3" style={{ backgroundColor: item.v || '#262626' }} />
                                    <Text className="flex-1 text-gray-700 dark:text-gray-300">{item.l}</Text>
                                    {selectedColor === item.v && <Check size={20} color="#3B82F6" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal visible={isVenueModalVisible} animationType="slide" transparent>
                <View className="flex-1 justify-end bg-black/60">
                    <Pressable className="flex-1" onPress={() => setIsVenueModalVisible(false)} />
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="bg-white dark:bg-gray-950 rounded-t-[40px] px-6 pt-8 pb-10 h-[80%]">
                        <View className="flex-row items-center justify-between mb-6">
                            <Text className="text-2xl font-black text-gray-900 dark:text-white">{t('venues_title')}</Text>
                            <TouchableOpacity onPress={() => setIsVenueModalVisible(false)} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-900 items-center justify-center">
                                <X size={24} color={isDark ? '#FFF' : '#000'} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View className="mb-6">
                                <View className="flex-row items-center bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 pr-3">
                                    <TextInput className="flex-1 px-4 py-3 text-gray-900 dark:text-white font-bold" value={venue} onChangeText={setVenue} onFocus={() => setVenueId(null)} />
                                    {venue.length > 0 && (<TouchableOpacity onPress={() => { setVenue(''); setVenueId(null); }}><X size={18} color="#9CA3AF" /></TouchableOpacity>)}
                                </View>
                                {venue.trim().length > 0 && !venues.some(v => v.name.toLowerCase() === venue.toLowerCase()) && (
                                    <TouchableOpacity onPress={async () => {
                                        try {
                                            const newV = await createVenueMutation.mutateAsync({ name: venue.trim() });
                                            setVenue(newV.name); setVenueId(newV.id); setIsVenueModalVisible(false);
                                        } catch (e) { Alert.alert(t('error'), t('error_saving_session')); }
                                    }} className="mt-3 flex-row items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                                        <Plus size={16} color="#3B82F6" />
                                        <Text className="ml-2 text-blue-600 font-bold">{t('add_as_new_venue', { name: venue.trim() })}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {filteredVenues.map(v => (
                                <TouchableOpacity key={v.id} onPress={() => { setVenue(v.name); setVenueId(v.id); setIsVenueModalVisible(false); }} className={`flex-row items-center p-4 mb-3 rounded-2xl border ${venueId === v.id ? 'border-blue-500 bg-blue-50/10' : 'border-gray-100 dark:border-gray-800'}`}>
                                    <MapPin size={20} color={venueId === v.id ? '#3B82F6' : '#9CA3AF'} />
                                    <View className="ml-3 flex-1"><Text className="font-bold text-gray-900 dark:text-white">{v.name}</Text></View>
                                    {venueId === v.id && <Check size={20} color="#3B82F6" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity onPress={() => setIsVenueModalVisible(false)} className="mt-6 bg-blue-600 py-4 rounded-2xl items-center"><Text className="text-white font-black text-lg">{t('filter_apply')}</Text></TouchableOpacity>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
