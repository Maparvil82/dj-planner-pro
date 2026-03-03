import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Switch, Keyboard, KeyboardAvoidingView, Platform, Modal, Pressable } from 'react-native';
import React, { useState, useRef, useContext, useEffect } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from '../../src/i18n/useTranslation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Calendar as LucideCalendar, MapPin, Clock, Users, X, DollarSign, ChevronRight, Repeat, Palette, Plus } from 'lucide-react-native';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { useSessionByIdQuery, useUpdateSessionMutation } from '../../src/hooks/useSessionsQuery';
import { useTagsQuery } from '../../src/hooks/useTagsQuery';
import { useVenuesQuery, useCreateVenueMutation } from '../../src/hooks/useVenuesQuery';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { setupCalendarLocales } from '../../src/i18n/calendarLocales';

setupCalendarLocales();

export default function EditSessionScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { data: sessionData, isLoading: isLoadingSession } = useSessionByIdQuery(id);
    const router = useRouter();

    if (isLoadingSession) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    if (!sessionData) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
                <Text className="text-gray-500 dark:text-gray-400">Session not found</Text>
            </View>
        );
    }

    return <EditSessionContent session={sessionData} onBack={() => router.back()} />;
}

function EditSessionContent({ session: initialSession, onBack }: { session: any, onBack: () => void }) {
    const { t, currentLanguage } = useTranslation();
    const { session: authSession } = useAuthStore();
    const router = useRouter();
    const createVenueMutation = useCreateVenueMutation();
    const themeCtx = useContext(ThemeContext) as { activeTheme?: string };
    const isDark = themeCtx?.activeTheme === 'dark';

    const updateSessionMutation = useUpdateSessionMutation();

    const [title, setTitle] = useState(initialSession.title || '');
    const [venue, setVenue] = useState(initialSession.venue || '');
    const [startTime, setStartTime] = useState(initialSession.start_time || '22:00');
    const [endTime, setEndTime] = useState(initialSession.end_time || '04:00');
    const [venueId, setVenueId] = useState<string | null>(initialSession.venue_id || null);
    const [isVenueModalVisible, setIsVenueModalVisible] = useState(false);

    // Earnings State
    const [earningType, setEarningType] = useState<'free' | 'hourly' | 'fixed'>(initialSession.earning_type || 'free');
    const [earningAmount, setEarningAmount] = useState(initialSession.earning_amount?.toString() || '');
    const [currency, setCurrency] = useState(initialSession.currency || '€');

    const [sessionDate, setSessionDate] = useState(initialSession.date || new Date().toISOString().split('T')[0]);
    const [showCalendar, setShowCalendar] = useState(false);

    // Color State
    const [selectedColor, setSelectedColor] = useState<string | null>(initialSession.color || null);
    const [isColorModalVisible, setIsColorModalVisible] = useState(false);

    // Collective Session State
    const [isCollective, setIsCollective] = useState(initialSession.is_collective || false);
    const [djInput, setDjInput] = useState('');
    const [selectedDjs, setSelectedDjs] = useState<string[]>(initialSession.djs || []);

    // Focus state
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    const handleFocus = (type: string) => {
        setFocusedInput(type);
    };

    const handleBlur = () => {
        setTimeout(() => setFocusedInput(null), 150);
    };

    // Autocomplete Tags
    const { data: titleTags = [] } = useTagsQuery('title');
    const { data: venueTags = [] } = useTagsQuery('venue');
    const { data: venues = [] } = useVenuesQuery();
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

    // Local Date Parsing
    const [y, m, d] = sessionDate.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const weekday = dateObj.toLocaleDateString(currentLanguage, { weekday: 'long' });
    LocaleConfig.defaultLocale = currentLanguage;

    const handleSave = async () => {
        if (!title.trim() || !venue.trim()) {
            Alert.alert(t('error'), t('missing_fields'));
            return;
        }

        let finalDjs = [...selectedDjs];
        if (isCollective && djInput.trim().length > 0 && !finalDjs.includes(djInput.trim())) {
            finalDjs.push(djInput.trim());
        }

        const input = {
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
            color: selectedColor || undefined
        };

        const performUpdate = async (updateAll: boolean) => {
            try {
                await updateSessionMutation.mutateAsync({
                    sessionId: initialSession.id,
                    input,
                    updateAll
                });

                Alert.alert(t('success'), t('session_added_success'), [
                    { text: 'OK', onPress: onBack }
                ]);
            } catch (error) {
                Alert.alert(t('error'), t('error_saving_session'));
            }
        };

        Alert.alert(
            t('apply_color_to_all_title') || '¿Actualizar sesiones?',
            t('apply_changes_to_all_message', { title: initialSession.title }),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('apply_only_this'),
                    onPress: () => performUpdate(false)
                },
                {
                    text: t('apply_all_related', { title: initialSession.title }),
                    onPress: () => performUpdate(true)
                }
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50/50 dark:bg-gray-950" edges={['top', 'bottom', 'left', 'right']}>
            <View className="flex-row items-center justify-between px-5 pt-4 pb-6">
                <TouchableOpacity onPress={onBack} className="p-2 -ml-2">
                    <Text className="text-blue-600 dark:text-blue-500 font-medium text-lg">{t('cancel')}</Text>
                </TouchableOpacity>
                <Text className="text-lg font-bold text-gray-900 dark:text-white">{t('session_detail_header')}</Text>
                <View className="w-16" />
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
                            className="flex-row items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3.5 shadow-sm shadow-black/5"
                        >
                            <LucideCalendar size={20} color={isDark ? '#9CA3AF' : '#6B7280'} className="mr-3" />
                            <Text className="flex-1 text-base text-gray-900 dark:text-white font-medium">
                                {`${weekday}, ${dateObj.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'long', year: 'numeric' })}`}
                            </Text>
                        </TouchableOpacity>

                        {showCalendar && (
                            <View className="mt-4 bg-white dark:bg-gray-900 rounded-3xl p-3 shadow-md shadow-black/5 border border-gray-100 dark:border-gray-800 overflow-hidden">
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
                            {focusedInput === 'title' && filteredTitleTags.length > 0 && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="mb-3">
                                    {filteredTitleTags.map((tag) => (
                                        <TouchableOpacity key={tag.name} className="mr-2 mb-2 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700" onPress={() => setTitle(tag.name)}>
                                            <Text className="text-gray-400">{tag.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                            <View className={`rounded-2xl border-2 ${focusedInput === 'title' ? 'border-blue-500 bg-white dark:bg-gray-900' : 'border-transparent bg-white dark:bg-gray-900'}`}>
                                <TextInput
                                    className="px-5 py-4 text-gray-900 dark:text-white text-base font-medium"
                                    value={title}
                                    onChangeText={setTitle}
                                    onFocus={() => handleFocus('title')}
                                    onBlur={handleBlur}
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
                                            <View className="mb-6">
                                                <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t('search_placeholder')}</Text>
                                                <TextInput
                                                    className="bg-gray-50 dark:bg-gray-900 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-bold border border-gray-100 dark:border-gray-800"
                                                    placeholder={t('venue_placeholder')}
                                                    value={venue}
                                                    onChangeText={setVenue}
                                                    onFocus={() => setVenueId(null)}
                                                />
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
                                            {venues.length === 0 ? (
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
                                                venues.map((v) => (
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
                                                        {venueId === v.id && <ChevronRight size={20} color="#3B82F6" />}
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
                        <View className="flex-row items-center justify-between bg-white dark:bg-gray-900 rounded-2xl p-4">
                            <View className="flex-row items-center">
                                <Users size={20} color={isDark ? '#60A5FA' : '#3B82F6'} className="mr-3" />
                                <Text className="text-base font-semibold text-gray-900 dark:text-white">{t('collective_session')}</Text>
                            </View>
                            <Switch value={isCollective} onValueChange={setIsCollective} />
                        </View>

                        {isCollective && (
                            <View className="z-30">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">{t('add_djs')}</Text>
                                {focusedInput === 'dj' && filteredDjTags.length > 0 && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="mb-3">
                                        {filteredDjTags.map((tag) => (
                                            <TouchableOpacity key={tag.name} className="mr-2 mb-2 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 flex-row items-center" onPress={() => { setSelectedDjs([...selectedDjs, tag.name]); setDjInput(''); }}>
                                                <Users size={14} color="#A3A3A3" className="mr-1.5" />
                                                <Text className="text-gray-400">{tag.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                                <View className={`rounded-2xl border-2 flex-row items-center pl-5 ${focusedInput === 'dj' ? 'border-blue-500 bg-white dark:bg-gray-900' : 'border-transparent bg-white dark:bg-gray-900'}`}>
                                    <Users size={22} color={focusedInput === 'dj' ? '#3B82F6' : '#9CA3AF'} />
                                    <TextInput
                                        className="flex-1 px-4 py-4 text-gray-900 dark:text-white text-base font-medium"
                                        value={djInput}
                                        onChangeText={setDjInput}
                                        onFocus={() => handleFocus('dj')}
                                        onBlur={handleBlur}
                                        onSubmitEditing={() => { if (djInput.trim()) { setSelectedDjs([...selectedDjs, djInput.trim()]); setDjInput(''); } }}
                                    />
                                </View>
                                <View className="flex-row flex-wrap mt-2 gap-2">
                                    {selectedDjs.map(dj => (
                                        <View key={dj} className="flex-row items-center bg-gray-800 rounded-full px-3 py-1.5 border border-gray-700">
                                            <Text className="text-gray-300 font-semibold mr-2">{dj}</Text>
                                            <TouchableOpacity onPress={() => setSelectedDjs(selectedDjs.filter(d => d !== dj))}><X size={12} color="#D1D5DB" /></TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Time */}
                        <View className="flex-row space-x-4">
                            <View className="flex-1 mr-2">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">{t('start_time')}</Text>
                                <View className="bg-white dark:bg-gray-900 rounded-2xl flex-row items-center pl-4">
                                    <Clock size={20} color="#9CA3AF" />
                                    <TextInput className="flex-1 px-3 py-4 text-gray-900 dark:text-white font-medium" value={startTime} onChangeText={setStartTime} />
                                </View>
                            </View>
                            <View className="flex-1 ml-2">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">{t('end_time')}</Text>
                                <View className="bg-white dark:bg-gray-900 rounded-2xl flex-row items-center pl-4">
                                    <Clock size={20} color="#9CA3AF" />
                                    <TextInput className="flex-1 px-3 py-4 text-gray-900 dark:text-white font-medium" value={endTime} onChangeText={setEndTime} />
                                </View>
                            </View>
                        </View>

                        {/* Earnings */}
                        <View>
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">{t('earning_type')}</Text>
                            <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4">
                                {['free', 'hourly', 'fixed'].map(type => (
                                    <TouchableOpacity key={type} className={`flex-1 py-2 rounded-lg items-center ${earningType === type ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`} onPress={() => setEarningType(type as any)}>
                                        <Text className={`font-semibold ${earningType === type ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>{t(`earning_${type}`)}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {earningType !== 'free' && (
                                <View className="bg-white dark:bg-gray-900 rounded-2xl flex-row items-center pl-5 border border-transparent">
                                    <Text className="text-xl font-medium text-gray-400">{currency}</Text>
                                    <TextInput className="flex-1 px-4 py-4 text-gray-900 dark:text-white text-base font-medium" keyboardType="numeric" value={earningAmount} onChangeText={setEarningAmount} />
                                </View>
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
