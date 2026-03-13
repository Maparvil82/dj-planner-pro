import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Switch, Keyboard, KeyboardAvoidingView, Platform, Modal, Pressable, Image } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState, useRef, useContext, useEffect } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from '../../src/i18n/useTranslation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Calendar as LucideCalendar, MapPin, Clock, Users, X, DollarSign, ChevronRight, Repeat, Palette, Plus, Check, Camera } from 'lucide-react-native';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { useSessionByIdQuery, useUpdateSessionMutation } from '../../src/hooks/useSessionsQuery';
import { useTagsQuery } from '../../src/hooks/useTagsQuery';
import { useVenuesQuery, useCreateVenueMutation } from '../../src/hooks/useVenuesQuery';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { setupCalendarLocales } from '../../src/i18n/calendarLocales';
import * as ImagePicker from 'expo-image-picker';
import { sessionService } from '../../src/services/sessions';

setupCalendarLocales();

export default function EditSessionScreen() {
    const { id: rawId } = useLocalSearchParams();
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { data: initialSession, isLoading: isLoadingSession } = useSessionByIdQuery(id);
    const router = useRouter();
    const { t, currentLanguage } = useTranslation();
    const { session: authSession } = useAuthStore();
    const createVenueMutation = useCreateVenueMutation();
    const themeCtx = useContext(ThemeContext) as { activeTheme?: string };
    const isDark = themeCtx?.activeTheme === 'dark';
    const updateSessionMutation = useUpdateSessionMutation();

    // Form states (initialized after data is loaded via useEffect)
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
    const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
    const [showCalendar, setShowCalendar] = useState(false);
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [isColorModalVisible, setIsColorModalVisible] = useState(false);
    const [isCollective, setIsCollective] = useState(false);
    const [djInput, setDjInput] = useState('');
    const [selectedDjs, setSelectedDjs] = useState<string[]>([]);
    const [focusedInput, setFocusedInput] = useState<string | null>(null);
    const [posterUrl, setPosterUrl] = useState<string | null>(null);
    const [isUploadingPoster, setIsUploadingPoster] = useState(false);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);

    // Sync initial data
    useEffect(() => {
        if (initialSession) {
            setTitle(initialSession.title || '');
            setVenue(initialSession.venue || '');
            setStartTime(initialSession.start_time || '22:00');
            setEndTime(initialSession.end_time || '04:00');
            setVenueId(initialSession.venue_id || null);
            setStatus(initialSession.status || 'confirmed');
            setEarningType(initialSession.earning_type || 'free');
            setEarningAmount(initialSession.earning_amount?.toString() || '');
            setCurrency(initialSession.currency || '€');
            setSessionDate(initialSession.date || new Date().toISOString().split('T')[0]);
            setSelectedColor(initialSession.color || null);
            setIsCollective(initialSession.is_collective || false);
            setSelectedDjs(initialSession.djs || []);
            setPosterUrl(initialSession.poster_url || null);
        }
    }, [initialSession]);

    const handleFocus = (type: string) => setFocusedInput(type);
    const handleBlur = () => setTimeout(() => setFocusedInput(null), 150);

    // Queries and memoized filters
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

    const filteredTitleTags = focusedInput === 'title'
        ? titleTags.filter(t => t.name.toLowerCase().includes(title.toLowerCase()) && t.name.toLowerCase() !== title.toLowerCase()).slice(0, 10)
        : [];

    const filteredVenueTags = focusedInput === 'venue'
        ? venueTags.filter(v => v.name.toLowerCase().includes(venue.toLowerCase()) && v.name.toLowerCase() !== venue.toLowerCase()).slice(0, 10)
        : [];

    const filteredDjTags = focusedInput === 'dj'
        ? djTags.filter(d => d.name.toLowerCase().includes(djInput.toLowerCase()) && !selectedDjs.includes(d.name)).slice(0, 10)
        : [];

    const onStartTimeChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowStartTimePicker(false);
        if (selectedDate) {
            const hours = selectedDate.getHours().toString().padStart(2, '0');
            const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
            setStartTime(`${hours}:${minutes}`);
        }
    };

    const onEndTimeChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowEndTimePicker(false);
        if (selectedDate) {
            const hours = selectedDate.getHours().toString().padStart(2, '0');
            const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
            setEndTime(`${hours}:${minutes}`);
        }
    };

    const getTimeDate = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours);
        date.setMinutes(minutes);
        return date;
    };

    // Local Date Parsing
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
                // Delete old poster if it exists and changed
                if (posterUrl && posterUrl !== initialSession?.poster_url) {
                    await sessionService.deleteSessionPoster(posterUrl);
                }

                const url = await sessionService.uploadSessionPoster(authSession?.user?.id || '', result.assets[0].uri);
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

        // 1. Build FULL current input for validation or single update
        const fullInput = {
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
            color: selectedColor || undefined,
            status: status,
            poster_url: posterUrl
        };

        // 2. Diffing logic: only include fields that actually changed
        const getChangedFields = () => {
            const changes: any = {};
            if (title.trim() !== initialSession?.title) changes.title = title.trim();
            if (venue.trim() !== initialSession?.venue) changes.venue = venue.trim();
            if (venueId !== initialSession?.venue_id) changes.venue_id = venueId || null;
            if (startTime.trim() !== initialSession?.start_time) changes.start_time = startTime.trim();
            if (endTime.trim() !== initialSession?.end_time) changes.end_time = endTime.trim();
            if (sessionDate !== initialSession?.date) changes.date = sessionDate;
            if (isCollective !== initialSession?.is_collective) changes.is_collective = isCollective;
            if (JSON.stringify(finalDjs) !== JSON.stringify(initialSession?.djs)) changes.djs = finalDjs;
            if (earningType !== initialSession?.earning_type) changes.earning_type = earningType;
            if (parseFloat(earningAmount) !== initialSession?.earning_amount) changes.earning_amount = parseFloat(earningAmount) || 0;
            if (currency !== initialSession?.currency) changes.currency = currency;
            if (selectedColor !== initialSession?.color) changes.color = selectedColor;
            if (status !== initialSession?.status) changes.status = status;
            if (posterUrl !== initialSession?.poster_url) changes.poster_url = posterUrl;
            return changes;
        };

        const changedFields = getChangedFields();

        if (Object.keys(changedFields).length === 0) {
            router.back();
            return;
        }

        const performUpdate = async (updateAll: boolean) => {
            try {
                if (!id) throw new Error("Missing ID");

                // If updateAll is true, we ONLY send the changed fields
                // If updateAll is false, we send the full input (standard behavior)
                // Actually, sending only changed fields is safer in BOTH cases.
                await updateSessionMutation.mutateAsync({
                    sessionId: id,
                    input: updateAll ? changedFields : fullInput,
                    updateAll
                });

                Alert.alert(t('success'), t('session_added_success'), [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            } catch (error: any) {
                Alert.alert(t('error'), error.message || t('error_saving_session'));
            }
        };

        Alert.alert(
            t('apply_color_to_all_title') || '¿Actualizar sesiones?',
            t('apply_changes_to_all_message', { title: initialSession?.title }),
            [
                { text: t('cancel'), style: 'cancel' },
                { text: t('apply_only_this'), onPress: () => performUpdate(false) },
                { text: t('apply_all_related', { title: initialSession?.title }), onPress: () => performUpdate(true) }
            ]
        );
    };

    if (isLoadingSession) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    if (!initialSession) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
                <Text className="text-gray-500 dark:text-gray-400">Session not found</Text>
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-950" edges={['top', 'bottom', 'left', 'right']}>
            <View className="flex-row items-center justify-between px-5 pt-2 pb-4 border-b border-gray-100 dark:border-gray-900">
                <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                    <X size={24} color={isDark ? '#FFF' : '#000'} />
                </TouchableOpacity>
                <Text className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                    {t('edit_session')}
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
                    {/* Date Input */}
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

                        {showCalendar && (
                            <View className="mt-4 bg-white dark:bg-gray-900 rounded-3xl p-3 border border-gray-100 dark:border-gray-800 overflow-hidden">
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
                                            customStyles: {
                                                container: { backgroundColor: '#3B82F6', borderRadius: 10 },
                                                text: { color: 'white', fontWeight: 'bold' }
                                            }
                                        }
                                    }}
                                />
                            </View>
                        )}
                    </View>

                    {/* Title & Venue */}
                    <View className="flex-col gap-8">
                        <View className="z-50">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">
                                {t('session_title')} *
                            </Text>
                            {filteredTitleTags.length > 0 && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" className="mb-3" contentContainerStyle={{ paddingHorizontal: 4 }}>
                                    {filteredTitleTags.map((tag) => (
                                        <TouchableOpacity key={tag.name} className="bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-full mr-2 border border-gray-100 dark:border-gray-700" onPress={() => { setTitle(tag.name); Keyboard.dismiss(); }}>
                                            <Text className="text-gray-700 dark:text-gray-300 text-sm font-medium">{tag.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                            <View className={`rounded-2xl border-2 ${focusedInput === 'title' ? 'border-blue-500 bg-white dark:bg-gray-900' : 'border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-900'}`}>
                                <TextInput
                                    className="px-5 py-4 text-gray-900 dark:text-white text-base font-medium"
                                    value={title}
                                    onChangeText={setTitle}
                                    onFocus={() => handleFocus('title')}
                                    onBlur={handleBlur}
                                    autoCapitalize="words"
                                />
                            </View>
                        </View>

                        <View className="z-40">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">
                                {t('venue')} *
                            </Text>

                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setIsVenueModalVisible(true);
                                }}
                                className={`flex-row items-center rounded-2xl border-2 py-4 px-5 ${venueId ? 'border-blue-500 bg-blue-50/10' : 'border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-900'}`}
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
                                            <View className="mb-6">
                                                <View className="flex-row items-center bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 pr-3">
                                                    <TextInput
                                                        className="flex-1 px-4 py-3 text-gray-900 dark:text-white font-bold"
                                                        placeholder={t('venue_placeholder')}
                                                        value={venue}
                                                        onChangeText={setVenue}
                                                        onFocus={() => { setVenueId(null); handleFocus('venue'); }}
                                                        onBlur={handleBlur}
                                                        autoCapitalize="words"
                                                    />
                                                    {venue.length > 0 && (
                                                        <TouchableOpacity onPress={() => { setVenue(''); setVenueId(null); }}>
                                                            <X size={18} color={isDark ? '#4B5563' : '#9CA3AF'} />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                                {filteredVenueTags.length > 0 && (
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" className="mt-2 mb-2" contentContainerStyle={{ paddingHorizontal: 4 }}>
                                                        {filteredVenueTags.map((tag) => (
                                                            <TouchableOpacity key={tag.name} className="bg-white dark:bg-gray-800 px-4 py-2 rounded-full mr-2 border border-gray-200 dark:border-gray-700" onPress={() => { setVenue(tag.name); setVenueId(null); }}>
                                                                <Text className="text-gray-700 dark:text-gray-300 text-sm font-medium">{tag.name}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                )}
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
                                                    <MapPin size={24} color="#3B82F6" />
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

                        {/* Crew */}
                        <View className="flex-row items-center justify-between bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                            <View className="flex-row items-center">
                                <Users size={20} color={isDark ? '#60A5FA' : '#3B82F6'} className="mr-3" />
                                <Text className="text-base font-semibold text-gray-900 dark:text-white">{t('collective_session')}</Text>
                            </View>
                            <Switch value={isCollective} onValueChange={setIsCollective} />
                        </View>

                        {isCollective && (
                            <View className="z-30">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">{t('add_djs')}</Text>
                                {filteredDjTags.length > 0 && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" className="mt-2" contentContainerStyle={{ paddingHorizontal: 4 }}>
                                        {filteredDjTags.map((tag) => (
                                            <TouchableOpacity key={tag.name} className="bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-full mr-2 border border-gray-100 dark:border-gray-700" onPress={() => { setSelectedDjs([...selectedDjs, tag.name]); setDjInput(''); }}>
                                                <Text className="text-gray-700 dark:text-gray-300 text-sm font-medium">{tag.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                                <View className={`rounded-2xl border-2 flex-row items-center pl-5 mt-4 ${focusedInput === 'dj' ? 'border-blue-500 bg-white dark:bg-gray-900' : 'border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-900'}`}>
                                    <Users size={22} color={focusedInput === 'dj' ? '#3B82F6' : '#9CA3AF'} />
                                    <TextInput
                                        className="flex-1 px-4 py-4 text-gray-900 dark:text-white text-base font-medium"
                                        value={djInput}
                                        onChangeText={setDjInput}
                                        onFocus={() => handleFocus('dj')}
                                        onBlur={handleBlur}
                                        autoCapitalize="words"
                                        onSubmitEditing={() => { if (djInput.trim()) { setSelectedDjs([...selectedDjs, djInput.trim()]); setDjInput(''); } }}
                                    />
                                </View>
                                {selectedDjs.length > 0 && (
                                    <View className="flex-row flex-wrap mt-3 gap-2 ml-1">
                                        {selectedDjs.map((dj, index) => (
                                            <View key={index} className="flex-row items-center bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-800">
                                                <Text className="text-blue-600 dark:text-blue-400 text-sm font-bold">{dj}</Text>
                                                <TouchableOpacity onPress={() => setSelectedDjs(selectedDjs.filter((_, i) => i !== index))} className="ml-2">
                                                    <X size={14} color="#3B82F6" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Time */}
                        <View className="flex-row space-x-4">
                            <View className="flex-1 mr-2">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">{t('start_time')}</Text>
                                <TouchableOpacity 
                                    onPress={() => setShowStartTimePicker(true)}
                                    className="bg-white dark:bg-gray-900 rounded-2xl flex-row items-center pl-4 border border-gray-100 dark:border-gray-900 py-4"
                                >
                                    <Clock size={20} color="#9CA3AF" />
                                    <Text className="ml-3 text-gray-900 dark:text-white font-medium text-base">{startTime}</Text>
                                </TouchableOpacity>
                                {showStartTimePicker && (
                                    Platform.OS === 'ios' ? (
                                        <Modal transparent animationType="fade" visible={showStartTimePicker}>
                                            <TouchableOpacity 
                                                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} 
                                                onPress={() => setShowStartTimePicker(false)}
                                            >
                                                <View className="bg-white dark:bg-gray-900 m-5 p-5 rounded-3xl w-full max-w-[300px]">
                                                    <DateTimePicker
                                                        value={getTimeDate(startTime)}
                                                        mode="time"
                                                        is24Hour={true}
                                                        display="spinner"
                                                        onChange={onStartTimeChange}
                                                    />
                                                    <TouchableOpacity 
                                                        className="mt-4 bg-blue-600 py-3 rounded-2xl items-center" 
                                                        onPress={() => setShowStartTimePicker(false)}
                                                    >
                                                        <Text className="text-white font-bold">{t('confirm') || 'OK'}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </TouchableOpacity>
                                        </Modal>
                                    ) : (
                                        <DateTimePicker
                                            value={getTimeDate(startTime)}
                                            mode="time"
                                            is24Hour={true}
                                            display="default"
                                            onChange={onStartTimeChange}
                                        />
                                    )
                                )}
                            </View>
                            <View className="flex-1 ml-2">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">{t('end_time')}</Text>
                                <TouchableOpacity 
                                    onPress={() => setShowEndTimePicker(true)}
                                    className="bg-white dark:bg-gray-900 rounded-2xl flex-row items-center pl-4 border border-gray-100 dark:border-gray-900 py-4"
                                >
                                    <Clock size={20} color="#9CA3AF" />
                                    <Text className="ml-3 text-gray-900 dark:text-white font-medium text-base">{endTime}</Text>
                                </TouchableOpacity>
                                {showEndTimePicker && (
                                    Platform.OS === 'ios' ? (
                                        <Modal transparent animationType="fade" visible={showEndTimePicker}>
                                            <TouchableOpacity 
                                                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} 
                                                onPress={() => setShowEndTimePicker(false)}
                                            >
                                                <View className="bg-white dark:bg-gray-900 m-5 p-5 rounded-3xl w-full max-w-[300px]">
                                                    <DateTimePicker
                                                        value={getTimeDate(endTime)}
                                                        mode="time"
                                                        is24Hour={true}
                                                        display="spinner"
                                                        onChange={onEndTimeChange}
                                                    />
                                                    <TouchableOpacity 
                                                        className="mt-4 bg-blue-600 py-3 rounded-2xl items-center" 
                                                        onPress={() => setShowEndTimePicker(false)}
                                                    >
                                                        <Text className="text-white font-bold">{t('confirm') || 'OK'}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </TouchableOpacity>
                                        </Modal>
                                    ) : (
                                        <DateTimePicker
                                            value={getTimeDate(endTime)}
                                            mode="time"
                                            is24Hour={true}
                                            display="default"
                                            onChange={onEndTimeChange}
                                        />
                                    )
                                )}
                            </View>
                        </View>

                        {/* Status Section */}
                        <View className="z-10 mt-2 mb-6">
                            <View className="flex-row justify-between items-end mb-2">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1 uppercase tracking-wide">
                                    {t('session_status', { status: '' }).replace(':', '').trim() || 'Status'}
                                </Text>
                            </View>

                            <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1F2937' : '#F3F4F6', borderRadius: 12, padding: 4 }}>
                                {[
                                    { id: 'confirmed', label: t('status_confirmed') || 'Confirmada', color: isDark ? '#60A5FA' : '#2563EB', activeBg: isDark ? '#374151' : '#FFFFFF' },
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

                        {/* Earnings */}
                        <View>
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
                                            if (posterUrl !== initialSession?.poster_url) {
                                                sessionService.deleteSessionPoster(posterUrl);
                                            }
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
                    <TouchableOpacity
                        activeOpacity={0.8}
                        className={`py-4 rounded-2xl items-center ${updateSessionMutation.isPending || !title.trim() || !venue.trim() ? 'bg-blue-300' : 'bg-blue-600'}`}
                        onPress={handleSave}
                        disabled={updateSessionMutation.isPending || !title.trim() || !venue.trim()}
                    >
                        {updateSessionMutation.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">{t('save_session')}</Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
