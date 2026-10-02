import {
    SessionFormHeader,
    SessionFormSection,
    SessionFormFooter,
} from '../src/components/sessions/SessionFormLayout';
import { showError } from '../src/utils/showError';
import { SessionStatusControl } from '../src/components/sessions/SessionStatusControl';
import { SessionScheduleSummary } from '../src/components/sessions/SessionScheduleSummary';
import {
    parseSessionAmount,
    validateSessionInput,
    type BookingStatus,
} from '../src/utils/sessionWorkflow';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    Switch,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Modal,
    Pressable,
    Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState, useRef, useContext, useEffect } from 'react';
import { Stack, useGlobalSearchParams, useRouter, Redirect } from 'expo-router';
import { useTranslation } from '../src/i18n/useTranslation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/useAuthStore';
import {
    Calendar as LucideCalendar,
    MapPin,
    Clock,
    Users,
    X,
    DollarSign,
    ChevronRight,
    Repeat,
    Palette,
    Check,
    Plus,
    Camera,
} from 'lucide-react-native';
import { ThemeContext } from '../src/contexts/ThemeContext';
import { useCreateSessionMutation } from '../src/hooks/useSessionsQuery';
import { useTagsQuery } from '../src/hooks/useTagsQuery';
import {
    useVenuesQuery,
    useCreateVenueMutation,
} from '../src/hooks/useVenuesQuery';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { setupCalendarLocales } from '../src/i18n/calendarLocales';
import { confirmAction } from '../src/utils/confirmAction';
import { localDateString } from '../src/utils/sessionPlanning';
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

    const [isChecking, setIsChecking] = useState(false);
    const saving = useRef(false);
    const [title, setTitle] = useState('');
    const [status, setStatus] = useState<BookingStatus>('pending');
    const [venue, setVenue] = useState('');
    const [startTime, setStartTime] = useState('22:00');
    const [endTime, setEndTime] = useState('04:00');
    const [venueId, setVenueId] = useState<string | null>(null);
    const [isVenueModalVisible, setIsVenueModalVisible] = useState(false);
    const [earningType, setEarningType] = useState<'free' | 'hourly' | 'fixed'>(
        'free',
    );
    const [earningAmount, setEarningAmount] = useState('');
    const [currency, setCurrency] = useState('€');

    const [sessionDate, setSessionDate] = useState(() => {
        const d = date ? new Date(date) : new Date();
        return localDateString(d);
    });
    const [showCalendar, setShowCalendar] = useState(false);

    const [recurrenceType, setRecurrenceType] = useState<
        | 'none'
        | 'daily'
        | 'weekly'
        | 'monthly'
        | 'quarterly'
        | 'biannually'
        | 'yearly'
    >('none');
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
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);

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

    const onStartTimeChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowStartTimePicker(false);
        if (selectedDate) {
            const hours = selectedDate.getHours().toString().padStart(2, '0');
            const minutes = selectedDate
                .getMinutes()
                .toString()
                .padStart(2, '0');
            setStartTime(`${hours}:${minutes}`);
        }
    };

    const onEndTimeChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowEndTimePicker(false);
        if (selectedDate) {
            const hours = selectedDate.getHours().toString().padStart(2, '0');
            const minutes = selectedDate
                .getMinutes()
                .toString()
                .padStart(2, '0');
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

    const { data: titleTags = [] } = useTagsQuery('title');
    const { data: venueTags = [] } = useTagsQuery('venue');
    const { data: venues = [] } = useVenuesQuery();
    const { data: djTags = [] } = useTagsQuery('dj');

    const filteredVenues = React.useMemo(() => {
        if (!venue) return venues;
        return venues.filter(
            (v) =>
                v.name.toLowerCase().includes(venue.toLowerCase()) ||
                v.address?.toLowerCase().includes(venue.toLowerCase()),
        );
    }, [venue, venues]);

    const filteredTitleTags =
        focusedInput === 'title'
            ? titleTags
                  .filter(
                      (t) =>
                          t.name.toLowerCase().includes(title.toLowerCase()) &&
                          t.name.toLowerCase() !== title.toLowerCase(),
                  )
                  .slice(0, 10)
            : [];

    const filteredVenueTags =
        focusedInput === 'venue'
            ? venueTags
                  .filter(
                      (v) =>
                          v.name.toLowerCase().includes(venue.toLowerCase()) &&
                          v.name.toLowerCase() !== venue.toLowerCase(),
                  )
                  .slice(0, 10)
            : [];

    const filteredDjTags =
        focusedInput === 'dj'
            ? djTags
                  .filter(
                      (d) =>
                          d.name
                              .toLowerCase()
                              .includes(djInput.toLowerCase()) &&
                          !selectedDjs.includes(d.name),
                  )
                  .slice(0, 10)
            : [];

    const dateParts = sessionDate.split('-');
    const dateObj =
        dateParts.length === 3
            ? new Date(
                  Number(dateParts[0]),
                  Number(dateParts[1]) - 1,
                  Number(dateParts[2]),
              )
            : new Date();
    const weekday = dateObj.toLocaleDateString(currentLanguage, {
        weekday: 'long',
    });
    LocaleConfig.defaultLocale = currentLanguage;

    const handlePickPoster = async () => {
        const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showError(
                t('error'),
                'Permission to access media library is required',
            );
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
                const url = await sessionService.uploadSessionPoster(
                    session?.user?.id || '',
                    result.assets[0].uri,
                );
                if (url) {
                    setPosterUrl(url);
                } else {
                    showError(t('error'), t('error_uploading'));
                }
            } catch (error) {
                console.error('Error picking poster:', error);
                showError(t('error'), t('error_uploading'));
            } finally {
                setIsUploadingPoster(false);
            }
        }
    };

    const handleSave = async () => {
        if (saving.current || !session) return;
        if (!title.trim() || !venue.trim()) {
            showError(t('error'), t('missing_fields'));
            return;
        }
        let amount: number;
        try {
            amount = parseSessionAmount(earningAmount, earningType);
        } catch {
            showError(t('error'), t('invalid_earning_amount'));
            return;
        }
        const finalDjs = [...selectedDjs];
        if (
            isCollective &&
            djInput.trim() &&
            !finalDjs.includes(djInput.trim())
        )
            finalDjs.push(djInput.trim());
        const input = {
            date: sessionDate,
            title: title.trim(),
            venue: venue.trim(),
            venue_id: venueId || undefined,
            start_time: startTime.trim(),
            end_time: endTime.trim(),
            is_collective: isCollective,
            djs: isCollective ? finalDjs : [],
            earning_type: earningType,
            earning_amount: amount,
            currency,
            recurrence_type: recurrenceType,
            recurrence_end_date:
                recurrenceType !== 'none' ? recurrenceEndDate : undefined,
            color: selectedColor || undefined,
            status,
            poster_url: posterUrl,
        };
        try {
            Object.assign(input, validateSessionInput(input));
        } catch (error) {
            showError(
                t('error'),
                t(
                    error instanceof Error
                        ? error.message
                        : 'error_saving_session',
                ),
            );
            return;
        }
        saving.current = true;
        setIsChecking(true);
        try {
            const conflicts = await sessionService.getCreationConflicts(
                input,
                session.user.id,
            );
            if (
                conflicts.length &&
                !(await confirmAction(
                    t('session_conflict_title'),
                    t('session_conflict_message', {
                        count: conflicts.length,
                        sessions: conflicts
                            .slice(0, 3)
                            .map(
                                (item) =>
                                    `${item.title} · ${item.date} · ${item.start_time}–${item.end_time}`,
                            )
                            .join('\n'),
                    }),
                    t('cancel'),
                    t('continue'),
                ))
            )
                return;
            if (
                new Date(`${sessionDate}T${startTime}:00`) < new Date() &&
                !(await confirmAction(
                    t('past_date_warning_title'),
                    t('past_date_warning_message'),
                    t('cancel'),
                    t('continue'),
                ))
            )
                return;
            const created = await createSessionMutation.mutateAsync(input);
            router.replace(`/session/${created.id}`);
        } catch (error) {
            const key = error instanceof Error ? error.message : '';
            showError(
                t('error'),
                [
                    'invalid_recurrence',
                    'recurrence_limit',
                    'invalid_earning_amount',
                ].includes(key) || key.startsWith('workflow.')
                    ? t(key)
                    : t('error_saving_session'),
            );
        } finally {
            saving.current = false;
            setIsChecking(false);
        }
    };

    if (!session) return <Redirect href="/(auth)/login" />;

    return (
        <SafeAreaView
            style={{ flex: 1, backgroundColor: isDark ? '#0d1220' : '#f5f6fa' }}
            edges={['top', 'bottom', 'left', 'right']}
        >
            <SessionFormHeader
                title={t('add_session')}
                subtitle={t('form.addIntro')}
                onClose={() => router.back()}
            />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                        paddingHorizontal: 20,
                        paddingBottom: 130,
                        gap: 16,
                        width: '100%',
                        maxWidth: 900,
                        alignSelf: 'center',
                    }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    <SessionFormSection kind="event" title={t('form.event')}>
                        <View className="z-50">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 ">
                                {t('session_title')} *
                            </Text>
                            <View
                                className={`rounded-2xl border-2 ${focusedInput === 'title' ? 'border-[#8270e4] bg-[#f8f9fd] dark:bg-[#111625]' : 'border-[#e9ecf3] dark:border-[#252d40] bg-[#f8f9fd] dark:bg-[#111625]'}`}
                            >
                                <TextInput
                                    className="px-5 py-4 text-gray-900 dark:text-white text-base font-medium"
                                    placeholder={t('session_title_placeholder')}
                                    value={title}
                                    onChangeText={setTitle}
                                    onFocus={() => handleFocus('title')}
                                    onBlur={handleBlur}
                                    autoCapitalize="words"
                                />
                            </View>
                            {filteredTitleTags.length > 0 && (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    className="mt-2"
                                    contentContainerStyle={{
                                        paddingHorizontal: 4,
                                    }}
                                    keyboardShouldPersistTaps="always"
                                >
                                    {filteredTitleTags.map((tag, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            onPress={() => {
                                                setTitle(tag.name);
                                                Keyboard.dismiss();
                                            }}
                                            className="bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-full mr-2 border border-gray-100 dark:border-gray-700"
                                        >
                                            <Text className="text-gray-700 dark:text-gray-300 text-sm font-medium">
                                                {tag.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                        </View>
                        <View className="z-40">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 ">
                                {t('venue')} *
                            </Text>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setIsVenueModalVisible(true);
                                }}
                                className={`flex-row items-center rounded-2xl border-2 py-4 px-5 ${venueId ? 'border-[#8270e4] bg-[#f0edfc]' : 'border-[#e9ecf3] dark:border-[#252d40] bg-[#f8f9fd] dark:bg-[#111625]'}`}
                            >
                                <MapPin
                                    size={22}
                                    color={venueId ? '#7666df' : '#9CA3AF'}
                                />
                                <Text
                                    className={`flex-1 ml-3 text-base font-medium ${venue ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}
                                >
                                    {venue || t('venue_placeholder')}
                                </Text>
                                <ChevronRight size={20} color="#D1D5DB" />
                            </TouchableOpacity>
                        </View>
                    </SessionFormSection>

                    <SessionFormSection
                        kind="schedule"
                        title={t('form.schedule')}
                    >
                        <View className="z-40">
                            <View className="flex-row justify-between items-end mb-2">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1 ">
                                    {t('date') || 'Date'} *
                                </Text>
                            </View>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setShowCalendar(!showCalendar);
                                }}
                                className="flex-row items-center bg-[#f8f9fd] dark:bg-[#111625] border border-[#e9ecf3] dark:border-[#252d40] rounded-xl px-4 py-3.5"
                            >
                                <LucideCalendar
                                    size={20}
                                    color={isDark ? '#9CA3AF' : '#6B7280'}
                                    className="mr-3"
                                />
                                <Text className="flex-1 text-base text-gray-900 dark:text-white font-medium">
                                    {`${weekday}, ${dateObj.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'long', year: 'numeric' })}`}
                                </Text>
                            </TouchableOpacity>

                            <View
                                className="mt-4 bg-[#f8f9fd] dark:bg-[#111625] rounded-3xl p-3 border border-gray-100 dark:border-gray-800 overflow-hidden"
                                style={{
                                    display: showCalendar ? 'flex' : 'none',
                                }}
                            >
                                <Calendar
                                    markingType={'custom'}
                                    theme={{
                                        backgroundColor: 'transparent',
                                        calendarBackground: 'transparent',
                                        textSectionTitleColor: isDark
                                            ? '#9CA3AF'
                                            : '#6B7280',
                                        selectedDayBackgroundColor: '#7666df',
                                        selectedDayTextColor: '#ffffff',
                                        todayTextColor: '#7666df',
                                        dayTextColor: isDark
                                            ? '#D1D5DB'
                                            : '#111827',
                                        textDisabledColor: isDark
                                            ? '#4B5563'
                                            : '#374151',
                                        arrowColor: isDark
                                            ? '#bdb0f5'
                                            : '#7666df',
                                        monthTextColor: isDark
                                            ? '#F9FAFB'
                                            : '#111827',
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
                                                container: {
                                                    backgroundColor: '#7666df',
                                                    borderRadius: 10,
                                                },
                                                text: {
                                                    color: 'white',
                                                    fontWeight: 'bold',
                                                },
                                            },
                                        },
                                    }}
                                />
                            </View>

                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setIsRepeatModalVisible(true);
                                }}
                                className="flex-row items-center bg-[#f8f9fd] dark:bg-[#111625] border border-[#e9ecf3] dark:border-[#252d40] rounded-xl px-4 py-3.5 mt-4"
                            >
                                <Repeat
                                    size={20}
                                    color={isDark ? '#9CA3AF' : '#6B7280'}
                                    className="mr-3"
                                />
                                <Text className="flex-1 text-base text-gray-900 dark:text-white font-medium">
                                    {recurrenceType === 'none' &&
                                        t('does_not_repeat')}
                                    {recurrenceType === 'daily' && t('daily')}
                                    {recurrenceType === 'weekly' && t('weekly')}
                                    {recurrenceType === 'monthly' &&
                                        t('monthly')}
                                    {recurrenceType === 'quarterly' &&
                                        t('quarterly')}
                                    {recurrenceType === 'biannually' &&
                                        t('biannually')}
                                    {recurrenceType === 'yearly' && t('yearly')}
                                </Text>
                            </TouchableOpacity>

                            {recurrenceType !== 'none' && (
                                <>
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={() => {
                                            Keyboard.dismiss();
                                            setShowEndCalendar(
                                                !showEndCalendar,
                                            );
                                        }}
                                        className="flex-row items-center bg-[#f8f9fd] dark:bg-[#111625] border border-[#e9ecf3] dark:border-[#252d40] rounded-xl px-4 py-3.5 mt-3 ml-8"
                                    >
                                        <Text className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                                            {t('repeat_until')}
                                        </Text>
                                        <Text className="flex-1 text-base text-gray-900 dark:text-white font-medium">
                                            {(() => {
                                                const parts =
                                                    recurrenceEndDate.split(
                                                        '-',
                                                    );
                                                const ed = new Date(
                                                    Number(parts[0]),
                                                    Number(parts[1]) - 1,
                                                    Number(parts[2]),
                                                );
                                                return ed.toLocaleDateString(
                                                    currentLanguage,
                                                    {
                                                        day: 'numeric',
                                                        month: 'long',
                                                        year: 'numeric',
                                                    },
                                                );
                                            })()}
                                        </Text>
                                    </TouchableOpacity>
                                    <View
                                        className="mt-3 ml-8 bg-[#f8f9fd] dark:bg-[#111625] rounded-3xl p-3 border border-gray-100 dark:border-gray-800 overflow-hidden"
                                        style={{
                                            display: showEndCalendar
                                                ? 'flex'
                                                : 'none',
                                        }}
                                    >
                                        <Calendar
                                            markingType={'custom'}
                                            onDayPress={(day: any) => {
                                                setRecurrenceEndDate(
                                                    day.dateString,
                                                );
                                                setShowEndCalendar(false);
                                            }}
                                            minDate={sessionDate}
                                            markedDates={{
                                                [recurrenceEndDate]: {
                                                    selected: true,
                                                    customStyles: {
                                                        container: {
                                                            backgroundColor:
                                                                '#7666df',
                                                            borderRadius: 10,
                                                        },
                                                        text: {
                                                            color: 'white',
                                                            fontWeight: 'bold',
                                                        },
                                                    },
                                                },
                                            }}
                                        />
                                    </View>
                                </>
                            )}

                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setIsColorModalVisible(true);
                                }}
                                className="flex-row items-center bg-[#f8f9fd] dark:bg-[#111625] border border-[#e9ecf3] dark:border-[#252d40] rounded-xl px-4 py-3.5 mt-4"
                            >
                                {!selectedColor ? (
                                    <View
                                        className="w-5 h-5 rounded-full mr-3"
                                        style={{ backgroundColor: '#262626' }}
                                    />
                                ) : (
                                    <View
                                        className="w-5 h-5 rounded-full mr-3"
                                        style={{
                                            backgroundColor: selectedColor,
                                        }}
                                    />
                                )}
                                <Text className="flex-1 text-base text-gray-900 dark:text-white font-medium">
                                    {!selectedColor &&
                                        (t('color_default') ||
                                            'Color predeterminado')}
                                    {selectedColor === '#EF4444' &&
                                        t('color_tomato')}
                                    {selectedColor === '#F97316' &&
                                        t('color_tangerine')}
                                    {selectedColor === '#FBBF24' &&
                                        t('color_banana')}
                                    {selectedColor === '#10B981' &&
                                        t('color_basil')}
                                    {selectedColor === '#34D399' &&
                                        t('color_sage')}
                                    {selectedColor === '#0EA5E9' &&
                                        t('color_peacock')}
                                    {selectedColor === '#3B82F6' &&
                                        t('color_blueberry')}
                                    {selectedColor === '#8B5CF6' &&
                                        t('color_lavender')}
                                    {selectedColor === '#9333EA' &&
                                        t('color_grape')}
                                    {selectedColor === '#F43F5E' &&
                                        t('color_flamingo')}
                                    {selectedColor === '#6B7280' &&
                                        t('color_graphite')}
                                </Text>
                                <ChevronRight
                                    size={20}
                                    color={isDark ? '#4B5563' : '#D1D5DB'}
                                />
                            </TouchableOpacity>
                        </View>
                        <View className="flex-row space-x-4 mb-4">
                            <View className="flex-1 mr-2">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 ">
                                    {t('start_time')}
                                </Text>
                                {Platform.OS === 'web' ? (
                                    <TextInput
                                        accessibilityLabel={t('start_time')}
                                        value={startTime}
                                        onChangeText={setStartTime}
                                        placeholder="HH:MM"
                                        maxLength={5}
                                        className="bg-[#f8f9fd] dark:bg-[#111625] rounded-2xl px-4 py-4 text-gray-900 dark:text-white border border-[#e9ecf3] dark:border-[#252d40]"
                                    />
                                ) : (
                                    <TouchableOpacity
                                        onPress={() =>
                                            setShowStartTimePicker(true)
                                        }
                                        className="bg-[#f8f9fd] dark:bg-[#111625] rounded-2xl flex-row items-center pl-4 border border-[#e9ecf3] dark:border-[#252d40] py-4"
                                    >
                                        <Clock size={20} color="#9CA3AF" />
                                        <Text className="ml-3 text-gray-900 dark:text-white font-medium text-base">
                                            {startTime}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {showStartTimePicker &&
                                    Platform.OS !== 'web' &&
                                    (Platform.OS === 'ios' ? (
                                        <Modal
                                            transparent
                                            animationType="fade"
                                            visible={showStartTimePicker}
                                        >
                                            <TouchableOpacity
                                                style={{
                                                    flex: 1,
                                                    backgroundColor:
                                                        'rgba(0,0,0,0.5)',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                }}
                                                onPress={() =>
                                                    setShowStartTimePicker(
                                                        false,
                                                    )
                                                }
                                            >
                                                <View className="bg-[#f8f9fd] dark:bg-[#111625] m-5 p-5 rounded-3xl w-full max-w-[300px]">
                                                    <DateTimePicker
                                                        value={getTimeDate(
                                                            startTime,
                                                        )}
                                                        mode="time"
                                                        is24Hour={true}
                                                        display="spinner"
                                                        onChange={
                                                            onStartTimeChange
                                                        }
                                                    />
                                                    <TouchableOpacity
                                                        className="mt-4 bg-[#6554df] py-3 rounded-2xl items-center"
                                                        onPress={() =>
                                                            setShowStartTimePicker(
                                                                false,
                                                            )
                                                        }
                                                    >
                                                        <Text className="text-white font-bold">
                                                            {t('confirm') ||
                                                                'OK'}
                                                        </Text>
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
                                    ))}
                            </View>
                            <View className="flex-1 ml-2">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 ">
                                    {t('end_time')}
                                </Text>
                                {Platform.OS === 'web' ? (
                                    <TextInput
                                        accessibilityLabel={t('end_time')}
                                        value={endTime}
                                        onChangeText={setEndTime}
                                        placeholder="HH:MM"
                                        maxLength={5}
                                        className="bg-[#f8f9fd] dark:bg-[#111625] rounded-2xl px-4 py-4 text-gray-900 dark:text-white border border-[#e9ecf3] dark:border-[#252d40]"
                                    />
                                ) : (
                                    <TouchableOpacity
                                        onPress={() =>
                                            setShowEndTimePicker(true)
                                        }
                                        className="bg-[#f8f9fd] dark:bg-[#111625] rounded-2xl flex-row items-center pl-4 border border-[#e9ecf3] dark:border-[#252d40] py-4"
                                    >
                                        <Clock size={20} color="#9CA3AF" />
                                        <Text className="ml-3 text-gray-900 dark:text-white font-medium text-base">
                                            {endTime}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {showEndTimePicker &&
                                    Platform.OS !== 'web' &&
                                    (Platform.OS === 'ios' ? (
                                        <Modal
                                            transparent
                                            animationType="fade"
                                            visible={showEndTimePicker}
                                        >
                                            <TouchableOpacity
                                                style={{
                                                    flex: 1,
                                                    backgroundColor:
                                                        'rgba(0,0,0,0.5)',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                }}
                                                onPress={() =>
                                                    setShowEndTimePicker(false)
                                                }
                                            >
                                                <View className="bg-[#f8f9fd] dark:bg-[#111625] m-5 p-5 rounded-3xl w-full max-w-[300px]">
                                                    <DateTimePicker
                                                        value={getTimeDate(
                                                            endTime,
                                                        )}
                                                        mode="time"
                                                        is24Hour={true}
                                                        display="spinner"
                                                        onChange={
                                                            onEndTimeChange
                                                        }
                                                    />
                                                    <TouchableOpacity
                                                        className="mt-4 bg-[#6554df] py-3 rounded-2xl items-center"
                                                        onPress={() =>
                                                            setShowEndTimePicker(
                                                                false,
                                                            )
                                                        }
                                                    >
                                                        <Text className="text-white font-bold">
                                                            {t('confirm') ||
                                                                'OK'}
                                                        </Text>
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
                                    ))}
                            </View>
                        </View>
                    </SessionFormSection>

                    <SessionFormSection kind="fee" title={t('form.fee')}>
                        <View style={{ zIndex: 10, marginTop: 8 }}>
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 ">
                                {t('earning_type')}
                            </Text>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    backgroundColor: isDark
                                        ? '#252d40'
                                        : '#e9ecf3',
                                    borderRadius: 12,
                                    padding: 4,
                                    marginBottom: 16,
                                }}
                            >
                                <TouchableOpacity
                                    style={{
                                        flex: 1,
                                        paddingVertical: 8,
                                        borderRadius: 8,
                                        alignItems: 'center',
                                        backgroundColor:
                                            earningType === 'free'
                                                ? isDark
                                                    ? '#292743'
                                                    : '#f0edfc'
                                                : 'transparent',
                                    }}
                                    onPress={() => setEarningType('free')}
                                >
                                    <Text
                                        style={{
                                            fontWeight: '600',
                                            color:
                                                earningType === 'free'
                                                    ? isDark
                                                        ? '#bdb0f5'
                                                        : '#6554df'
                                                    : isDark
                                                      ? '#9CA3AF'
                                                      : '#6B7280',
                                        }}
                                    >
                                        {t('earning_free')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{
                                        flex: 1,
                                        paddingVertical: 8,
                                        borderRadius: 8,
                                        alignItems: 'center',
                                        backgroundColor:
                                            earningType === 'hourly'
                                                ? isDark
                                                    ? '#292743'
                                                    : '#f0edfc'
                                                : 'transparent',
                                    }}
                                    onPress={() => setEarningType('hourly')}
                                >
                                    <Text
                                        style={{
                                            fontWeight: '600',
                                            color:
                                                earningType === 'hourly'
                                                    ? isDark
                                                        ? '#bdb0f5'
                                                        : '#6554df'
                                                    : isDark
                                                      ? '#9CA3AF'
                                                      : '#6B7280',
                                        }}
                                    >
                                        {t('earning_hourly')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{
                                        flex: 1,
                                        paddingVertical: 8,
                                        borderRadius: 8,
                                        alignItems: 'center',
                                        backgroundColor:
                                            earningType === 'fixed'
                                                ? isDark
                                                    ? '#292743'
                                                    : '#f0edfc'
                                                : 'transparent',
                                    }}
                                    onPress={() => setEarningType('fixed')}
                                >
                                    <Text
                                        style={{
                                            fontWeight: '600',
                                            color:
                                                earningType === 'fixed'
                                                    ? isDark
                                                        ? '#bdb0f5'
                                                        : '#6554df'
                                                    : isDark
                                                      ? '#9CA3AF'
                                                      : '#6B7280',
                                        }}
                                    >
                                        {t('earning_fixed')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View
                                style={{
                                    display:
                                        earningType !== 'free'
                                            ? 'flex'
                                            : 'none',
                                    backgroundColor: isDark
                                        ? '#111625'
                                        : '#f8f9fd',
                                    borderRadius: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingLeft: 20,
                                    borderWidth: 1,
                                    borderColor: isDark ? '#252d40' : '#e9ecf3',
                                    marginBottom: 20,
                                }}
                            >
                                <Text
                                    style={{ fontSize: 20, color: '#9CA3AF' }}
                                >
                                    {currency}
                                </Text>
                                <TextInput
                                    accessibilityLabel={t(
                                        earningType === 'hourly'
                                            ? 'form.hourlyAmount'
                                            : 'form.fixedAmount',
                                    )}
                                    placeholder={new Intl.NumberFormat(
                                        currentLanguage,
                                        { minimumFractionDigits: 2 },
                                    ).format(0)}
                                    placeholderTextColor={
                                        isDark ? '#657089' : '#afb5c5'
                                    }
                                    style={{
                                        flex: 1,
                                        paddingHorizontal: 16,
                                        paddingVertical: 16,
                                        color: isDark ? '#FFFFFF' : '#111827',
                                        fontSize: 16,
                                        fontWeight: '500',
                                    }}
                                    keyboardType="decimal-pad"
                                    value={earningAmount}
                                    onChangeText={setEarningAmount}
                                />
                            </View>
                        </View>
                        <SessionScheduleSummary
                            start={startTime}
                            end={endTime}
                            type={earningType}
                            amount={earningAmount}
                            currency={currency}
                        />
                    </SessionFormSection>

                    <SessionFormSection
                        kind="booking"
                        title={t('workflow.bookingState')}
                    >
                        <SessionStatusControl
                            value={status}
                            onChange={setStatus}
                            showHeading={false}
                        />
                    </SessionFormSection>

                    <SessionFormSection
                        kind="participants"
                        title={t('form.participants')}
                    >
                        <View className="flex-row items-center justify-between mb-4 mt-2 bg-[#f8f9fd] dark:bg-[#111625] rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                            <View className="flex-row items-center">
                                <Users
                                    size={20}
                                    color={isDark ? '#bdb0f5' : '#7666df'}
                                    className="mr-3"
                                />
                                <Text className="text-base font-semibold text-gray-900 dark:text-white">
                                    {t('collective_session')}
                                </Text>
                            </View>
                            <Switch
                                trackColor={{
                                    false: isDark ? '#343d52' : '#d9dce8',
                                    true: '#8270e4',
                                }}
                                value={isCollective}
                                onValueChange={setIsCollective}
                            />
                        </View>
                        {isCollective && (
                            <View className="z-30 mb-6">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 ">
                                    {t('add_djs')}
                                </Text>
                                <View
                                    className={`rounded-2xl border-2 flex-row items-center pl-5 ${focusedInput === 'dj' ? 'border-[#8270e4] bg-[#f8f9fd] dark:bg-[#111625]' : 'border-[#e9ecf3] dark:border-[#252d40] bg-[#f8f9fd] dark:bg-[#111625]'}`}
                                >
                                    <Users
                                        size={22}
                                        color={
                                            focusedInput === 'dj'
                                                ? '#7666df'
                                                : '#9CA3AF'
                                        }
                                    />
                                    <TextInput
                                        className="flex-1 px-4 py-4 text-gray-900 dark:text-white text-base font-medium"
                                        placeholder={t('add_djs_placeholder')}
                                        value={djInput}
                                        onChangeText={setDjInput}
                                        onFocus={() => handleFocus('dj')}
                                        onBlur={handleBlur}
                                        autoCapitalize="words"
                                        onSubmitEditing={() => {
                                            if (djInput.trim()) {
                                                setSelectedDjs([
                                                    ...selectedDjs,
                                                    djInput.trim(),
                                                ]);
                                                setDjInput('');
                                            }
                                        }}
                                    />
                                </View>
                                {filteredDjTags.length > 0 && (
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        className="mt-2"
                                        contentContainerStyle={{
                                            paddingHorizontal: 4,
                                        }}
                                        keyboardShouldPersistTaps="always"
                                    >
                                        {filteredDjTags.map((tag, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                onPress={() => {
                                                    setSelectedDjs([
                                                        ...selectedDjs,
                                                        tag.name,
                                                    ]);
                                                    setDjInput('');
                                                }}
                                                className="bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-full mr-2 border border-gray-100 dark:border-gray-700"
                                            >
                                                <Text className="text-gray-700 dark:text-gray-300 text-sm font-medium">
                                                    {tag.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                                {selectedDjs.length > 0 && (
                                    <View className="flex-row flex-wrap gap-2 mt-3 ml-1">
                                        {selectedDjs.map((dj, index) => (
                                            <View
                                                key={index}
                                                className="flex-row items-center bg-[#f0edfc] dark:bg-[#292743] px-3 py-1.5 rounded-full border border-[#dcd6f8] dark:border-[#4a4178]"
                                            >
                                                <Text className="text-[#7666df] dark:text-[#bdb0f5] text-sm font-bold">
                                                    {dj}
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() =>
                                                        setSelectedDjs(
                                                            selectedDjs.filter(
                                                                (_, i) =>
                                                                    i !== index,
                                                            ),
                                                        )
                                                    }
                                                    className="ml-2"
                                                >
                                                    <X
                                                        size={14}
                                                        color="#7666df"
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}
                    </SessionFormSection>

                    <SessionFormSection
                        kind="poster"
                        title={t('session_poster')}
                    >
                        <View className="">
                            {posterUrl ? (
                                <View className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-[#e9ecf3] dark:border-[#252d40]">
                                    <Image
                                        source={{ uri: posterUrl }}
                                        className="w-full h-full"
                                        resizeMode="cover"
                                    />
                                    <TouchableOpacity
                                        onPress={() => {
                                            // Keep the saved file until the session changes have been committed.
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
                                    className="w-full h-40 bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-[#e9ecf3] dark:border-[#252d40] rounded-3xl items-center justify-center p-6"
                                >
                                    {isUploadingPoster ? (
                                        <ActivityIndicator
                                            color={
                                                isDark ? '#bdb0f5' : '#7666df'
                                            }
                                        />
                                    ) : (
                                        <>
                                            <View className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full items-center justify-center mb-4 shadow-sm">
                                                <Camera
                                                    size={28}
                                                    color={
                                                        isDark
                                                            ? '#D1D5DB'
                                                            : '#4B5563'
                                                    }
                                                    strokeWidth={1.5}
                                                />
                                            </View>
                                            <Text className="text-gray-900 dark:text-white font-bold text-lg mb-1">
                                                {t('add_poster')}
                                            </Text>
                                            <Text className="text-gray-500 dark:text-gray-400 text-sm text-center">
                                                {t('form.posterHint')}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    </SessionFormSection>
                </ScrollView>

                <SessionFormFooter
                    disabled={
                        isChecking ||
                        isUploadingPoster ||
                        createSessionMutation.isPending ||
                        !title.trim() ||
                        !venue.trim()
                    }
                    busy={isChecking || createSessionMutation.isPending}
                    onSave={handleSave}
                />
            </KeyboardAvoidingView>

            {/* Modals for Repeat and Color Picker same as before */}
            <Modal
                visible={isRepeatModalVisible}
                transparent
                animationType="fade"
            >
                <TouchableOpacity
                    className="flex-1 bg-black/50 justify-center items-center"
                    onPress={() => setIsRepeatModalVisible(false)}
                >
                    <View className="bg-[#f8f9fd] dark:bg-[#111625] w-4/5 rounded-3xl p-2">
                        {[
                            { v: 'none', l: t('does_not_repeat') },
                            { v: 'daily', l: t('daily') },
                            { v: 'weekly', l: t('weekly') },
                            { v: 'monthly', l: t('monthly') },
                            { v: 'quarterly', l: t('quarterly') },
                            { v: 'biannually', l: t('biannually') },
                            { v: 'yearly', l: t('yearly') },
                        ].map((item) => (
                            <TouchableOpacity
                                key={item.v}
                                className="py-4 px-5 border-b border-gray-100 dark:border-gray-800"
                                onPress={() => {
                                    setRecurrenceType(item.v as any);
                                    setIsRepeatModalVisible(false);
                                }}
                            >
                                <Text
                                    className={`text-base ${recurrenceType === item.v ? 'font-bold text-blue-500' : 'text-gray-800 dark:text-gray-200'}`}
                                >
                                    {item.l}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal
                visible={isColorModalVisible}
                transparent
                animationType="slide"
            >
                <TouchableOpacity
                    className="flex-1 bg-black/50 justify-end"
                    onPress={() => setIsColorModalVisible(false)}
                >
                    <View className="bg-[#f8f9fd] dark:bg-[#111625] rounded-t-3xl pt-2 pb-8">
                        <View className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto my-3" />
                        <ScrollView className="max-h-96">
                            {[
                                { v: '#EF4444', l: t('color_tomato') },
                                { v: '#F97316', l: t('color_tangerine') },
                                { v: '#FBBF24', l: t('color_banana') },
                                { v: '#10B981', l: t('color_basil') },
                                { v: '#34D399', l: t('color_sage') },
                                { v: '#0EA5E9', l: t('color_peacock') },
                                { v: '#3B82F6', l: t('color_blueberry') },
                                { v: '#8B5CF6', l: t('color_lavender') },
                                { v: '#9333EA', l: t('color_grape') },
                                { v: '#F43F5E', l: t('color_flamingo') },
                                { v: '#6B7280', l: t('color_graphite') },
                                {
                                    v: null,
                                    l: t('color_default'),
                                    isDefault: true,
                                },
                            ].map((item) => (
                                <TouchableOpacity
                                    key={item.l}
                                    className="flex-row items-center py-4 px-6 border-b border-gray-50 dark:border-gray-800"
                                    onPress={() => {
                                        setSelectedColor(item.v);
                                        setIsColorModalVisible(false);
                                    }}
                                >
                                    <View
                                        className="w-5 h-5 rounded-full mr-3"
                                        style={{
                                            backgroundColor:
                                                item.v || '#262626',
                                        }}
                                    />
                                    <Text className="flex-1 text-gray-700 dark:text-gray-300">
                                        {item.l}
                                    </Text>
                                    {selectedColor === item.v && (
                                        <Check size={20} color="#7666df" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal
                visible={isVenueModalVisible}
                animationType="slide"
                transparent
            >
                <View className="flex-1 justify-end bg-black/60">
                    <Pressable
                        className="flex-1"
                        onPress={() => setIsVenueModalVisible(false)}
                    />
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        className="bg-white dark:bg-gray-950 rounded-t-[40px] px-6 pt-8 pb-10 h-[80%]"
                    >
                        <View className="flex-row items-center justify-between mb-6">
                            <Text className="text-2xl font-black text-gray-900 dark:text-white">
                                {t('venues_title')}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setIsVenueModalVisible(false)}
                                className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-900 items-center justify-center"
                            >
                                <X size={24} color={isDark ? '#FFF' : '#000'} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View className="mb-6">
                                <View className="flex-row items-center bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 pr-3">
                                    <TextInput
                                        className="flex-1 px-4 py-3 text-gray-900 dark:text-white font-bold"
                                        value={venue}
                                        onChangeText={(value) => {
                                            setVenue(value);
                                            setVenueId(null);
                                        }}
                                        onFocus={() => handleFocus('venue')}
                                        onBlur={handleBlur}
                                        autoCapitalize="words"
                                    />
                                    {venue.length > 0 && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setVenue('');
                                                setVenueId(null);
                                            }}
                                        >
                                            <X size={18} color="#9CA3AF" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                {filteredVenueTags.length > 0 && (
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        className="mt-2"
                                        contentContainerStyle={{
                                            paddingHorizontal: 4,
                                        }}
                                        keyboardShouldPersistTaps="always"
                                    >
                                        {filteredVenueTags.map((tag, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                onPress={() => {
                                                    setVenue(tag.name);
                                                    setVenueId(null);
                                                }}
                                                className="bg-white dark:bg-gray-800 px-4 py-2 rounded-full mr-2 border border-gray-200 dark:border-gray-700"
                                            >
                                                <Text className="text-gray-700 dark:text-gray-300 text-sm font-medium">
                                                    {tag.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                                {venue.trim().length > 0 &&
                                    !venues.some(
                                        (v) =>
                                            v.name.toLowerCase() ===
                                            venue.toLowerCase(),
                                    ) && (
                                        <TouchableOpacity
                                            onPress={async () => {
                                                try {
                                                    const newV =
                                                        await createVenueMutation.mutateAsync(
                                                            {
                                                                name: venue.trim(),
                                                            },
                                                        );
                                                    setVenue(newV.name);
                                                    setVenueId(newV.id);
                                                    setIsVenueModalVisible(
                                                        false,
                                                    );
                                                } catch (e) {
                                                    showError(
                                                        t('error'),
                                                        t(
                                                            'error_saving_session',
                                                        ),
                                                    );
                                                }
                                            }}
                                            className="mt-3 flex-row items-center p-4 bg-[#f0edfc] dark:bg-[#292743] rounded-2xl"
                                        >
                                            <Plus size={16} color="#7666df" />
                                            <Text className="ml-2 text-[#7666df] font-bold">
                                                {t('add_as_new_venue', {
                                                    name: venue.trim(),
                                                })}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                            </View>
                            {filteredVenues.map((v) => (
                                <TouchableOpacity
                                    key={v.id}
                                    onPress={() => {
                                        setVenue(v.name);
                                        setVenueId(v.id);
                                        setIsVenueModalVisible(false);
                                    }}
                                    className={`flex-row items-center p-4 mb-3 rounded-2xl border ${venueId === v.id ? 'border-[#8270e4] bg-[#f0edfc]' : 'border-gray-100 dark:border-gray-800'}`}
                                >
                                    <MapPin
                                        size={20}
                                        color={
                                            venueId === v.id
                                                ? '#7666df'
                                                : '#9CA3AF'
                                        }
                                    />
                                    <View className="ml-3 flex-1">
                                        <Text className="font-bold text-gray-900 dark:text-white">
                                            {v.name}
                                        </Text>
                                    </View>
                                    {venueId === v.id && (
                                        <Check size={20} color="#7666df" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            onPress={() => setIsVenueModalVisible(false)}
                            className="mt-6 bg-[#6554df] py-4 rounded-2xl items-center"
                        >
                            <Text className="text-white font-black text-lg">
                                {t('filter_apply')}
                            </Text>
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
