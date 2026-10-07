import { useConditionalDraft } from '../src/store/useConditionalDraft';
import { useRecentCollaborators } from '../src/hooks/useRecentCollaborators';
import { SessionTimezoneField } from '../src/components/sessions/SessionTimezoneField';
import { FEATURES } from '../src/config/features';
import {
    FeeAgreementCard,
    ProLabel,
} from '../src/components/sessions/FeeAgreementCard';
import { type FeeAgreement, agreementAmount } from '../src/utils/feeAgreement';
import { useSessionUsage } from '../src/hooks/useSessionUsage';
import { useKeyboardVisible } from '../src/hooks/useKeyboardVisible';
import { SessionVenueSheet } from '../src/components/venues/SessionVenueSheet';
import { sessionDisplayTitle } from '../src/utils/sessionNaming';
import { SessionPosterPreview } from '../src/components/sessions/SessionPosterPreview';
import type { PosterPosition } from '../src/utils/posterFrame';
import { SessionDJPicker } from '../src/components/sessions/SessionDJPicker';
import {
    SessionFormHeader,
    SessionFormSection,
    SessionFormFooter,
} from '../src/components/sessions/SessionFormLayout';
import { showError } from '../src/utils/showError';
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
    Platform,
    Modal,
    Pressable,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState, useRef, useContext, useEffect } from 'react';
import { Stack, useGlobalSearchParams, useRouter, Redirect } from 'expo-router';
import { useTranslation } from '../src/i18n/useTranslation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/useAuthStore';
import { X, ChevronRight, Check, Plus, Camera } from 'lucide-react-native';
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
import { localDateString, sessionRange } from '../src/utils/sessionPlanning';
import { pickSessionPoster } from '../src/services/sessionPoster';
import { SessionLimitError } from '../src/utils/sessionLimit';
import { sessionService } from '../src/services/sessions';

setupCalendarLocales();

export default function AddSessionScreen() {
    const { date, conditional } = useGlobalSearchParams<{
        date: string;
        conditional?: string;
    }>();
    const conditionalMode = conditional === '1';
    const router = useRouter();
    const { t, currentLanguage } = useTranslation();
    const keyboardVisible = useKeyboardVisible();
    const { session } = useAuthStore();
    const createVenueMutation = useCreateVenueMutation();

    const themeCtx = useContext(ThemeContext) as { activeTheme?: string };
    const isDark = themeCtx?.activeTheme === 'dark';
    const createSessionMutation = useCreateSessionMutation();

    const [isChecking, setIsChecking] = useState(false);
    const saving = useRef(false);
    const [title, setTitle] = useState('');
    const status: BookingStatus = 'confirmed';
    const [venue, setVenue] = useState('');
    const [timezone, setTimezone] = useState(
        Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    const [startTime, setStartTime] = useState('22:00');
    const [endTime, setEndTime] = useState('04:00');
    const [venueId, setVenueId] = useState<string | null>(null);
    const [isVenueModalVisible, setIsVenueModalVisible] = useState(false);
    const [earningType, setEarningType] = useState<
        'free' | 'hourly' | 'fixed' | 'agreement'
    >(conditionalMode ? 'agreement' : 'free');
    const [feeAgreement, setFeeAgreement] = useState<FeeAgreement | null>(() =>
        conditionalMode ? useConditionalDraft.getState().pending : null,
    );
    useEffect(() => {
        if (conditionalMode) useConditionalDraft.getState().set(null);
    }, [conditionalMode]);
    const usage = useSessionUsage();
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
    const recentDjs = useRecentCollaborators(isCollective);
    const [selectedDjs, setSelectedDjs] = useState<string[]>([]);
    const [linkedDjs, setLinkedDjs] = useState<Record<string, string>>({});
    const [focusedInput, setFocusedInput] = useState<string | null>(null);
    const [posterPosition, setPosterPosition] = useState<PosterPosition>({
        x: 0.5,
        y: 0.5,
    });
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
    const { data: venues = [] } = useVenuesQuery();

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

    const posterPicking = useRef(false);
    const handlePickPoster = async () => {
        if (posterPicking.current || isUploadingPoster || !session?.user.id)
            return;
        posterPicking.current = true;
        setIsUploadingPoster(true);
        try {
            const asset = await pickSessionPoster();
            if (!asset?.uri) return;
            const url = await sessionService.uploadSessionPoster(
                session.user.id,
                asset.uri,
                asset,
            );
            if (!url) throw new Error('error_uploading');
            setPosterUrl(url);
            setPosterPosition({ x: 0.5, y: 0.5 });
        } catch (error) {
            console.error('Error picking poster:', error);
            showError(
                t('error'),
                t(
                    error instanceof Error &&
                        error.message === 'poster_permission'
                        ? 'form.posterPermission'
                        : 'error_uploading',
                ),
            );
        } finally {
            posterPicking.current = false;
            setIsUploadingPoster(false);
        }
    };

    const handleSave = async () => {
        if (saving.current || !session) return;
        if (!venue.trim()) {
            showError(t('error'), t('missing_fields'));
            return;
        }
        let amount: number;
        try {
            if (earningType === 'agreement' && !feeAgreement)
                throw new Error('agreement.noTerms');
            amount =
                earningType === 'agreement'
                    ? agreementAmount(feeAgreement)
                    : parseSessionAmount(earningAmount, earningType);
        } catch {
            showError(
                t('error'),
                t(
                    earningType === 'agreement'
                        ? 'agreement.noTerms'
                        : 'invalid_earning_amount',
                ),
            );
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
            booking_timezone: timezone,
            date: sessionDate,
            title: title.trim(),
            venue: venue.trim(),
            venue_id: venueId || undefined,
            start_time: startTime.trim(),
            end_time: endTime.trim(),
            is_collective: isCollective,
            djs: isCollective ? finalDjs : [],
            dj_profile_ids: isCollective ? Object.values(linkedDjs) : [],
            earning_type: earningType,
            fee_agreement: earningType === 'agreement' ? feeAgreement : null,
            earning_amount: amount,
            currency,
            recurrence_type: recurrenceType,
            recurrence_end_date:
                recurrenceType !== 'none' ? recurrenceEndDate : undefined,
            color: selectedColor || undefined,
            status,
            poster_url: posterUrl,
            poster_focus_x: posterPosition.x,
            poster_focus_y: posterPosition.y,
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
                                    `${sessionDisplayTitle(item, t)} · ${item.date} · ${item.start_time}–${item.end_time}`,
                            )
                            .join('\n'),
                    }),
                    t('cancel'),
                    t('continue'),
                ))
            )
                return;
            if (
                sessionRange(input).start < new Date() &&
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
            if (error instanceof SessionLimitError) {
                router.push({
                    pathname: '/paywall',
                    params: {
                        reason: 'session-limit',
                        count: error.usage.count,
                        requested: error.requested,
                    },
                });
                return;
            }
            const key = error instanceof Error ? error.message : '';
            showError(
                t('error'),
                [
                    'invalid_recurrence',
                    'recurrence_limit',
                    'invalid_earning_amount',
                ].includes(key) ||
                    key.startsWith('workflow.') ||
                    key.startsWith('billing.') ||
                    key.startsWith('bookings.errors.')
                    ? t(key)
                    : t('error_saving_session'),
            );
        } finally {
            saving.current = false;
            setIsChecking(false);
        }
    };

    if (!session) return <Redirect href="/(auth)/login" />;
    if (conditionalMode && usage.isPending)
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <ActivityIndicator color="#6554df" />
            </View>
        );
    if (conditionalMode && usage.isError)
        return (
            <View style={{ padding: 24 }}>
                <Text>{t('billing.verificationError')}</Text>
                <TouchableOpacity onPress={() => void usage.refetch()}>
                    <Text>{t('insights.retry')}</Text>
                </TouchableOpacity>
            </View>
        );
    if (conditionalMode && !usage.data?.isPro)
        return <Redirect href="/paywall?reason=conditional" />;

    return (
        <SafeAreaView
            style={{ flex: 1, backgroundColor: isDark ? '#0d1220' : '#f5f6fa' }}
            edges={
                keyboardVisible
                    ? ['top', 'left', 'right']
                    : ['top', 'bottom', 'left', 'right']
            }
        >
            <SessionFormHeader
                title={
                    conditionalMode
                        ? t('conditional.title')
                        : t('createMenu.addSimple')
                }
                badge={conditionalMode ? 'PRO' : undefined}
                subtitle={t('form.addIntro')}
                onClose={() => router.back()}
            />

            <View style={{ flex: 1 }}>
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                        paddingHorizontal: 20,
                        paddingBottom: keyboardVisible ? 24 : 130,
                        gap: 16,
                        width: '100%',
                        maxWidth: 900,
                        alignSelf: 'center',
                    }}
                    showsVerticalScrollIndicator={false}
                    automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    <SessionFormSection kind="event" title={t('form.event')}>
                        <View className="z-50">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 ">
                                {t('sessionNaming.label')}
                            </Text>
                            <View
                                className={`rounded-2xl border-2 ${focusedInput === 'title' ? 'border-[#8270e4] bg-[#f8f9fd] dark:bg-[#111625]' : 'border-[#e9ecf3] dark:border-[#252d40] bg-[#f8f9fd] dark:bg-[#111625]'}`}
                            >
                                <TextInput
                                    className="px-5 py-4 text-gray-900 dark:text-white text-base font-medium"
                                    accessibilityLabel={t(
                                        'sessionNaming.label',
                                    )}
                                    placeholder={t('sessionNaming.placeholder')}
                                    value={title}
                                    onChangeText={setTitle}
                                    onFocus={() => handleFocus('title')}
                                    onBlur={handleBlur}
                                    autoCapitalize="words"
                                />
                            </View>
                            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-1">
                                {t('sessionNaming.hint')}
                            </Text>
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
                                <Text
                                    className={`flex-1 text-base font-medium ${venue ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}
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
                                {selectedColor === '#34D399' && t('color_sage')}
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
                        <SessionTimezoneField
                            value={timezone}
                            onChange={setTimezone}
                            date={sessionDate}
                        />
                    </SessionFormSection>

                    <SessionFormSection kind="fee" title={t('form.fee')}>
                        <View style={{ zIndex: 10, marginTop: 8 }}>
                            {!conditionalMode && (
                                <>
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
                                            onPress={() =>
                                                setEarningType('free')
                                            }
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
                                            onPress={() =>
                                                setEarningType('hourly')
                                            }
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
                                            onPress={() =>
                                                setEarningType('fixed')
                                            }
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
                                </>
                            )}
                            {FEATURES.feeAgreements && (
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityState={{
                                        selected: earningType === 'agreement',
                                    }}
                                    onPress={async () => {
                                        const verified = await usage.refetch();
                                        if (verified.isError) {
                                            Alert.alert(
                                                t('error'),
                                                t('error_saving_session'),
                                            );
                                            return;
                                        }
                                        if (verified.data?.isPro)
                                            setEarningType('agreement');
                                        else
                                            router.push(
                                                '/paywall?reason=agreement',
                                            );
                                    }}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                        padding: 14,
                                        borderRadius: 14,
                                        backgroundColor:
                                            earningType === 'agreement'
                                                ? isDark
                                                    ? '#292743'
                                                    : '#f0edfc'
                                                : isDark
                                                  ? '#252d40'
                                                  : '#e9ecf3',
                                        marginBottom: 16,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: isDark
                                                ? '#bdb0f5'
                                                : '#6554df',
                                            fontWeight: '800',
                                        }}
                                    >
                                        {t('agreement.title')}
                                    </Text>
                                    <ProLabel />
                                </TouchableOpacity>
                            )}
                            {(FEATURES.feeAgreements || conditionalMode) &&
                                earningType === 'agreement' && (
                                    <FeeAgreementCard
                                        conditional={conditionalMode}
                                        value={feeAgreement}
                                        onChange={setFeeAgreement}
                                        onCurrency={setCurrency}
                                        currency={currency}
                                        names={isCollective ? selectedDjs : []}
                                    />
                                )}

                            <View
                                style={{
                                    display:
                                        earningType !== 'free' &&
                                        earningType !== 'agreement'
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
                        kind="participants"
                        title={t('form.participants')}
                    >
                        <View className="flex-row items-center justify-between mb-4 mt-2 bg-[#f8f9fd] dark:bg-[#111625] rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                            <View className="flex-row items-center">
                                <Text className="text-base font-semibold text-gray-900 dark:text-white">
                                    {t('collective_session')}
                                </Text>
                            </View>
                            <Switch
                                accessibilityLabel={t('collective_session')}
                                trackColor={{
                                    false: isDark ? '#343d52' : '#d9dce8',
                                    true: '#8270e4',
                                }}
                                value={isCollective}
                                onValueChange={setIsCollective}
                            />
                        </View>
                        {isCollective && (
                            <SessionDJPicker
                                names={selectedDjs}
                                linked={linkedDjs}
                                query={djInput}
                                onQueryChange={setDjInput}
                                suggestions={[]}
                                recentSuggestions={recentDjs.data || []}
                                onChange={(names, refs) => {
                                    setSelectedDjs(names);
                                    setLinkedDjs(refs);
                                }}
                            />
                        )}
                    </SessionFormSection>

                    <SessionFormSection
                        kind="poster"
                        title={t('session_poster')}
                    >
                        <View className="">
                            {posterUrl ? (
                                <SessionPosterPreview
                                    uri={posterUrl}
                                    color={selectedColor}
                                    onRemove={() => {
                                        setPosterUrl(null);
                                        setPosterPosition({ x: 0.5, y: 0.5 });
                                    }}
                                />
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

                {!keyboardVisible && (
                    <SessionFormFooter
                        disabled={
                            isChecking ||
                            isUploadingPoster ||
                            createSessionMutation.isPending ||
                            !venue.trim()
                        }
                        busy={isChecking || createSessionMutation.isPending}
                        onSave={handleSave}
                    />
                )}
            </View>

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

            <SessionVenueSheet
                visible={isVenueModalVisible}
                venues={venues}
                selectedId={venueId}
                onClose={() => setIsVenueModalVisible(false)}
                onSelect={(selected) => {
                    setVenue(selected.name);
                    setVenueId(selected.id);
                    setIsVenueModalVisible(false);
                }}
                onCreate={(input) => createVenueMutation.mutateAsync(input)}
            />
        </SafeAreaView>
    );
}
