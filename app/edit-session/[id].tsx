import {
    SessionFormHeader,
    SessionFormSection,
    SessionFormFooter,
} from '../../src/components/sessions/SessionFormLayout';
import { showError } from '../../src/utils/showError';
import { SessionStatusControl } from '../../src/components/sessions/SessionStatusControl';
import { SessionScheduleSummary } from '../../src/components/sessions/SessionScheduleSummary';
import {
    parseSessionAmount,
    validateSessionInput,
} from '../../src/utils/sessionWorkflow';
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
import { Stack, useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { useTranslation } from '../../src/i18n/useTranslation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/useAuthStore';
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
    Plus,
    Check,
    Camera,
} from 'lucide-react-native';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import {
    useSessionByIdQuery,
    useUpdateSessionMutation,
} from '../../src/hooks/useSessionsQuery';
import { useTagsQuery } from '../../src/hooks/useTagsQuery';
import {
    useVenuesQuery,
    useCreateVenueMutation,
} from '../../src/hooks/useVenuesQuery';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { setupCalendarLocales } from '../../src/i18n/calendarLocales';
import * as ImagePicker from 'expo-image-picker';
import { confirmAction } from '../../src/utils/confirmAction';
import { localDateString } from '../../src/utils/sessionPlanning';
import { sessionService } from '../../src/services/sessions';

setupCalendarLocales();

export default function EditSessionScreen() {
    const { id: rawId } = useLocalSearchParams();
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const {
        data: remoteSession,
        isLoading: isLoadingSession,
        isError: isSessionError,
    } = useSessionByIdQuery(id);
    const router = useRouter();
    const { t, currentLanguage } = useTranslation();
    const { session: authSession } = useAuthStore();
    const createVenueMutation = useCreateVenueMutation();
    const themeCtx = useContext(ThemeContext) as { activeTheme?: string };
    const isDark = themeCtx?.activeTheme === 'dark';
    const updateSessionMutation = useUpdateSessionMutation();

    const [initialSession, setInitialSession] =
        useState<typeof remoteSession>(null);
    const loadedId = useRef<string | undefined>(undefined);

    // Form states (initialized after data is loaded via useEffect)
    const [isChecking, setIsChecking] = useState(false);
    const saving = useRef(false);
    const [scopeAction, setScopeAction] = useState<
        ((all: boolean) => Promise<void>) | null
    >(null);
    const [title, setTitle] = useState('');
    const [venue, setVenue] = useState('');
    const [startTime, setStartTime] = useState('22:00');
    const [endTime, setEndTime] = useState('04:00');
    const [venueId, setVenueId] = useState<string | null>(null);
    const [isVenueModalVisible, setIsVenueModalVisible] = useState(false);
    const [status, setStatus] = useState<'pending' | 'confirmed' | 'cancelled'>(
        'confirmed',
    );
    const [earningType, setEarningType] = useState<'free' | 'hourly' | 'fixed'>(
        'free',
    );
    const [earningAmount, setEarningAmount] = useState('');
    const [currency, setCurrency] = useState('€');
    const [sessionDate, setSessionDate] = useState(localDateString());
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
        if (remoteSession && loadedId.current !== remoteSession.id) {
            loadedId.current = remoteSession.id;
            setInitialSession(remoteSession);
            setTitle(remoteSession.title || '');
            setVenue(remoteSession.venue || '');
            setStartTime(remoteSession.start_time?.slice(0, 5) || '22:00');
            setEndTime(remoteSession.end_time?.slice(0, 5) || '04:00');
            setVenueId(remoteSession.venue_id || null);
            setStatus(remoteSession.status || 'confirmed');
            setEarningType(remoteSession.earning_type || 'free');
            setEarningAmount(remoteSession.earning_amount?.toString() || '');
            setCurrency(remoteSession.currency || '€');
            setSessionDate(remoteSession.date || localDateString());
            setSelectedColor(remoteSession.color || null);
            setIsCollective(remoteSession.is_collective || false);
            setSelectedDjs(remoteSession.djs || []);
            setPosterUrl(remoteSession.poster_url || null);
        }
    }, [remoteSession]);

    const handleFocus = (type: string) => setFocusedInput(type);
    const handleBlur = () => setTimeout(() => setFocusedInput(null), 150);

    // Queries and memoized filters
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

    // Local Date Parsing
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
                    authSession?.user?.id || '',
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
        if (saving.current) return;
        let amount: number;
        try {
            amount = parseSessionAmount(earningAmount, earningType);
        } catch {
            showError(t('error'), t('invalid_earning_amount'));
            return;
        }
        if (!title.trim() || !venue.trim()) {
            showError(t('error'), t('missing_fields'));
            return;
        }

        let finalDjs = [...selectedDjs];
        if (
            isCollective &&
            djInput.trim().length > 0 &&
            !finalDjs.includes(djInput.trim())
        ) {
            finalDjs.push(djInput.trim());
        }

        // 1. Build FULL current input for validation or single update
        const fullInput = {
            date: sessionDate,
            title: title.trim(),
            venue: venue.trim(),
            venue_id: venueId,
            start_time: startTime.trim(),
            end_time: endTime.trim(),
            is_collective: isCollective,
            djs: isCollective ? finalDjs : [],
            earning_type: earningType,
            earning_amount: amount,
            currency: currency,
            color: selectedColor || undefined,
            status: status,
            poster_url: posterUrl,
        };

        try {
            Object.assign(fullInput, validateSessionInput(fullInput));
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

        // 2. Diffing logic: only include fields that actually changed
        const getChangedFields = () => {
            const changes: any = {};
            if (title.trim() !== initialSession?.title)
                changes.title = title.trim();
            if (venue.trim() !== initialSession?.venue)
                changes.venue = venue.trim();
            if (venueId !== (initialSession?.venue_id || null))
                changes.venue_id = venueId || null;
            if (startTime.trim() !== initialSession?.start_time?.slice(0, 5))
                changes.start_time = startTime.trim();
            if (endTime.trim() !== initialSession?.end_time?.slice(0, 5))
                changes.end_time = endTime.trim();
            if (sessionDate !== initialSession?.date)
                changes.date = sessionDate;
            if (isCollective !== initialSession?.is_collective)
                changes.is_collective = isCollective;
            if (
                JSON.stringify(fullInput.djs) !==
                JSON.stringify(initialSession?.djs || [])
            )
                changes.djs = fullInput.djs;
            if (earningType !== initialSession?.earning_type)
                changes.earning_type = earningType;
            if (amount !== Number(initialSession?.earning_amount || 0))
                changes.earning_amount = amount;
            if (currency !== initialSession?.currency)
                changes.currency = currency;
            if (selectedColor !== initialSession?.color)
                changes.color = selectedColor;
            if (status !== initialSession?.status) changes.status = status;
            if (posterUrl !== initialSession?.poster_url)
                changes.poster_url = posterUrl;
            return changes;
        };

        const changedFields = getChangedFields();

        if (Object.keys(changedFields).length === 0) {
            router.back();
            return;
        }

        const performUpdate = async (updateAll: boolean) => {
            if (saving.current || !authSession) return;
            saving.current = true;
            setIsChecking(true);
            try {
                if (!id) throw new Error('Missing ID');

                const conflicts = await sessionService.getUpdateConflicts(
                    id,
                    changedFields,
                    authSession.user.id,
                    updateAll,
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

                // If updateAll is true, we ONLY send the changed fields
                // If updateAll is false, we send the full input (standard behavior)
                // Actually, sending only changed fields is safer in BOTH cases.
                await updateSessionMutation.mutateAsync({
                    sessionId: id,
                    input: changedFields,
                    updateAll,
                });

                router.back();
            } catch (error: any) {
                showError(
                    t('error'),
                    error.message?.startsWith('workflow.') ||
                        error.message === 'invalid_earning_amount'
                        ? t(error.message)
                        : t('error_saving_session'),
                );
            } finally {
                saving.current = false;
                setIsChecking(false);
            }
        };

        const isSeries =
            !!initialSession?.parent_session_id ||
            (!!initialSession?.recurrence_type &&
                initialSession.recurrence_type !== 'none');
        if (!isSeries || changedFields.date) {
            await performUpdate(false);
            return;
        }
        if (Platform.OS === 'web') {
            setScopeAction(() => performUpdate);
            return;
        }
        Alert.alert(t('workflow.seriesTitle'), t('workflow.seriesChoice'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('apply_only_this'), onPress: () => performUpdate(false) },
            {
                text: t('workflow.following'),
                onPress: () => performUpdate(true),
            },
        ]);
    };

    if (!authSession) return <Redirect href="/(auth)/login" />;

    if (isLoadingSession || (!initialSession && remoteSession)) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
                <ActivityIndicator size="large" color="#7666df" />
            </View>
        );
    }

    if (!initialSession) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
                <Text className="text-gray-500 dark:text-gray-400">
                    {t(
                        isSessionError
                            ? 'error_loading_session'
                            : 'session_not_found',
                    )}
                </Text>
            </View>
        );
    }

    return (
        <SafeAreaView
            style={{ flex: 1, backgroundColor: isDark ? '#0d1220' : '#f5f6fa' }}
            edges={['top', 'bottom', 'left', 'right']}
        >
            <Modal
                visible={!!scopeAction}
                transparent
                animationType="fade"
                onRequestClose={() => setScopeAction(null)}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: '#0008',
                        justifyContent: 'center',
                        padding: 24,
                    }}
                >
                    <View
                        style={{
                            backgroundColor: isDark ? '#111827' : '#fff',
                            borderRadius: 22,
                            padding: 24,
                            gap: 16,
                        }}
                    >
                        <Text
                            style={{
                                color: isDark ? '#fff' : '#111827',
                                fontWeight: '700',
                                fontSize: 18,
                            }}
                        >
                            {t('workflow.seriesTitle')}
                        </Text>
                        <Text style={{ color: isDark ? '#cbd5e1' : '#475569' }}>
                            {t('workflow.seriesChoice')}
                        </Text>
                        {[false, true].map((all) => (
                            <TouchableOpacity
                                key={String(all)}
                                accessibilityRole="button"
                                onPress={() => {
                                    const action = scopeAction;
                                    setScopeAction(null);
                                    void action?.(all);
                                }}
                                style={{
                                    backgroundColor: '#8270e4',
                                    padding: 14,
                                    borderRadius: 12,
                                }}
                            >
                                <Text
                                    style={{
                                        color: '#fff',
                                        textAlign: 'center',
                                        fontWeight: '700',
                                    }}
                                >
                                    {t(
                                        all
                                            ? 'workflow.following'
                                            : 'apply_only_this',
                                    )}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => setScopeAction(null)}
                        >
                            <Text
                                style={{
                                    color: '#8270e4',
                                    textAlign: 'center',
                                }}
                            >
                                {t('cancel')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            <SessionFormHeader
                title={t('edit_session')}
                subtitle={t('form.editIntro')}
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
                            {filteredTitleTags.length > 0 && (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    keyboardShouldPersistTaps="always"
                                    className="mb-3"
                                    contentContainerStyle={{
                                        paddingHorizontal: 4,
                                    }}
                                >
                                    {filteredTitleTags.map((tag) => (
                                        <TouchableOpacity
                                            key={tag.name}
                                            className="bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-full mr-2 border border-gray-100 dark:border-gray-700"
                                            onPress={() => {
                                                setTitle(tag.name);
                                                Keyboard.dismiss();
                                            }}
                                        >
                                            <Text className="text-gray-700 dark:text-gray-300 text-sm font-medium">
                                                {tag.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                            <View
                                className={`rounded-2xl border-2 ${focusedInput === 'title' ? 'border-[#8270e4] bg-[#f8f9fd] dark:bg-[#111625]' : 'border-[#e9ecf3] dark:border-[#252d40] bg-[#f8f9fd] dark:bg-[#111625]'}`}
                            >
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
                                    color={
                                        venueId
                                            ? isDark
                                                ? '#bdb0f5'
                                                : '#7666df'
                                            : isDark
                                              ? '#6B7280'
                                              : '#9CA3AF'
                                    }
                                />
                                <Text
                                    className={`flex-1 ml-3 text-base font-medium ${venue ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}
                                >
                                    {venue || t('venue_placeholder')}
                                </Text>
                                <ChevronRight
                                    size={20}
                                    color={isDark ? '#4B5563' : '#D1D5DB'}
                                />
                            </TouchableOpacity>

                            {/* Venue Selection Modal */}
                            <Modal
                                visible={isVenueModalVisible}
                                animationType="slide"
                                transparent
                            >
                                <View className="flex-1 justify-end bg-black/60">
                                    <Pressable
                                        className="flex-1"
                                        onPress={() =>
                                            setIsVenueModalVisible(false)
                                        }
                                    />
                                    <KeyboardAvoidingView
                                        behavior={
                                            Platform.OS === 'ios'
                                                ? 'padding'
                                                : undefined
                                        }
                                        className="bg-white dark:bg-gray-950 rounded-t-[40px] px-6 pt-8 pb-10 h-[80%]"
                                    >
                                        <View className="flex-row items-center justify-between mb-6">
                                            <Text className="text-2xl font-black text-gray-900 dark:text-white">
                                                {t('venues_title')}
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() =>
                                                    setIsVenueModalVisible(
                                                        false,
                                                    )
                                                }
                                                className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-900 items-center justify-center"
                                            >
                                                <X
                                                    size={24}
                                                    color={
                                                        isDark ? '#FFF' : '#000'
                                                    }
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        <ScrollView
                                            showsVerticalScrollIndicator={false}
                                        >
                                            <View className="mb-6">
                                                <View className="flex-row items-center bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 pr-3">
                                                    <TextInput
                                                        className="flex-1 px-4 py-3 text-gray-900 dark:text-white font-bold"
                                                        placeholder={t(
                                                            'venue_placeholder',
                                                        )}
                                                        value={venue}
                                                        onChangeText={(
                                                            value,
                                                        ) => {
                                                            setVenue(value);
                                                            setVenueId(null);
                                                        }}
                                                        onFocus={() =>
                                                            handleFocus('venue')
                                                        }
                                                        onBlur={handleBlur}
                                                        autoCapitalize="words"
                                                    />
                                                    {venue.length > 0 && (
                                                        <TouchableOpacity
                                                            onPress={() => {
                                                                setVenue('');
                                                                setVenueId(
                                                                    null,
                                                                );
                                                            }}
                                                        >
                                                            <X
                                                                size={18}
                                                                color={
                                                                    isDark
                                                                        ? '#4B5563'
                                                                        : '#9CA3AF'
                                                                }
                                                            />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                                {filteredVenueTags.length >
                                                    0 && (
                                                    <ScrollView
                                                        horizontal
                                                        showsHorizontalScrollIndicator={
                                                            false
                                                        }
                                                        keyboardShouldPersistTaps="always"
                                                        className="mt-2 mb-2"
                                                        contentContainerStyle={{
                                                            paddingHorizontal: 4,
                                                        }}
                                                    >
                                                        {filteredVenueTags.map(
                                                            (tag) => (
                                                                <TouchableOpacity
                                                                    key={
                                                                        tag.name
                                                                    }
                                                                    className="bg-white dark:bg-gray-800 px-4 py-2 rounded-full mr-2 border border-gray-200 dark:border-gray-700"
                                                                    onPress={() => {
                                                                        setVenue(
                                                                            tag.name,
                                                                        );
                                                                        setVenueId(
                                                                            null,
                                                                        );
                                                                    }}
                                                                >
                                                                    <Text className="text-gray-700 dark:text-gray-300 text-sm font-medium">
                                                                        {
                                                                            tag.name
                                                                        }
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            ),
                                                        )}
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
                                                                    const newVenue =
                                                                        await createVenueMutation.mutateAsync(
                                                                            {
                                                                                name: venue.trim(),
                                                                            },
                                                                        );
                                                                    setVenue(
                                                                        newVenue.name,
                                                                    );
                                                                    setVenueId(
                                                                        newVenue.id,
                                                                    );
                                                                    setIsVenueModalVisible(
                                                                        false,
                                                                    );
                                                                } catch (error) {
                                                                    showError(
                                                                        t(
                                                                            'error',
                                                                        ),
                                                                        t(
                                                                            'error_saving_session',
                                                                        ),
                                                                    );
                                                                }
                                                            }}
                                                            className="mt-3 flex-row items-center p-4 bg-[#f0edfc] dark:bg-[#292743] rounded-2xl border border-[#dcd6f8] dark:border-[#4a4178]"
                                                        >
                                                            <View className="w-8 h-8 rounded-full bg-[#6554df] items-center justify-center mr-3">
                                                                <Plus
                                                                    size={16}
                                                                    color="#FFF"
                                                                />
                                                            </View>
                                                            <Text className="text-[#7666df] dark:text-[#bdb0f5] font-bold flex-1">
                                                                {t(
                                                                    'add_as_new_venue',
                                                                    {
                                                                        name: venue.trim(),
                                                                    },
                                                                )}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    )}
                                            </View>

                                            <Text className="text-xs font-bold text-gray-400 st mb-3">
                                                {t('venues_title')}
                                            </Text>
                                            {filteredVenues.length === 0 ? (
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setIsVenueModalVisible(
                                                            false,
                                                        );
                                                        router.push(
                                                            '/(tabs)/venues',
                                                        );
                                                    }}
                                                    className="items-center py-10 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700"
                                                >
                                                    <MapPin
                                                        size={24}
                                                        color="#7666df"
                                                    />
                                                    <Text className="text-[#7666df] font-bold mt-2">
                                                        {t('add_venue')}
                                                    </Text>
                                                </TouchableOpacity>
                                            ) : (
                                                filteredVenues.map((v) => (
                                                    <TouchableOpacity
                                                        key={v.id}
                                                        onPress={() => {
                                                            setVenue(v.name);
                                                            setVenueId(v.id);
                                                            setIsVenueModalVisible(
                                                                false,
                                                            );
                                                        }}
                                                        className={`flex-row items-center p-4 mb-3 rounded-2xl border ${venueId === v.id ? 'border-[#8270e4] bg-[#f0edfc]' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900'}`}
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
                                                            <Text
                                                                className={`font-bold ${venueId === v.id ? 'text-[#7666df]' : 'text-gray-900 dark:text-white'}`}
                                                            >
                                                                {v.name}
                                                            </Text>
                                                            {v.address && (
                                                                <Text
                                                                    className="text-xs text-gray-400"
                                                                    numberOfLines={
                                                                        1
                                                                    }
                                                                >
                                                                    {v.address}
                                                                </Text>
                                                            )}
                                                        </View>
                                                        {venueId === v.id && (
                                                            <Check
                                                                size={20}
                                                                color="#7666df"
                                                            />
                                                        )}
                                                    </TouchableOpacity>
                                                ))
                                            )}
                                        </ScrollView>

                                        <TouchableOpacity
                                            onPress={() =>
                                                setIsVenueModalVisible(false)
                                            }
                                            className="mt-6 bg-[#6554df] py-4 rounded-2xl items-center"
                                        >
                                            <Text className="text-white font-black text-lg">
                                                {t('filter_apply')}
                                            </Text>
                                        </TouchableOpacity>
                                    </KeyboardAvoidingView>
                                </View>
                            </Modal>
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

                            {showCalendar && (
                                <View className="mt-4 bg-[#f8f9fd] dark:bg-[#111625] rounded-3xl p-3 border border-gray-100 dark:border-gray-800 overflow-hidden">
                                    <Calendar
                                        markingType={'custom'}
                                        theme={{
                                            backgroundColor: 'transparent',
                                            calendarBackground: 'transparent',
                                            textSectionTitleColor: isDark
                                                ? '#9CA3AF'
                                                : '#6B7280',
                                            selectedDayBackgroundColor:
                                                '#7666df',
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
                            )}
                        </View>
                        <View className="flex-row space-x-4">
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
                        {!!initialSession?.parent_session_id ||
                        (!!initialSession?.recurrence_type &&
                            initialSession.recurrence_type !== 'none') ? (
                            <Text
                                style={{
                                    color: '#8b78e6',
                                    fontSize: 12,
                                    marginBottom: 20,
                                }}
                            >
                                {t('workflow.seriesHint')}
                            </Text>
                        ) : null}
                    </SessionFormSection>

                    <SessionFormSection kind="fee" title={t('form.fee')}>
                        <View>
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
                            allowCancelled
                            showHeading={false}
                        />
                    </SessionFormSection>

                    <SessionFormSection
                        kind="participants"
                        title={t('form.participants')}
                    >
                        <View className="flex-row items-center justify-between bg-[#f8f9fd] dark:bg-[#111625] rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
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
                            <View className="z-30">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 ">
                                    {t('add_djs')}
                                </Text>
                                {filteredDjTags.length > 0 && (
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        keyboardShouldPersistTaps="always"
                                        className="mt-2"
                                        contentContainerStyle={{
                                            paddingHorizontal: 4,
                                        }}
                                    >
                                        {filteredDjTags.map((tag) => (
                                            <TouchableOpacity
                                                key={tag.name}
                                                className="bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-full mr-2 border border-gray-100 dark:border-gray-700"
                                                onPress={() => {
                                                    setSelectedDjs([
                                                        ...selectedDjs,
                                                        tag.name,
                                                    ]);
                                                    setDjInput('');
                                                }}
                                            >
                                                <Text className="text-gray-700 dark:text-gray-300 text-sm font-medium">
                                                    {tag.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                                <View
                                    className={`rounded-2xl border-2 flex-row items-center pl-5 mt-4 ${focusedInput === 'dj' ? 'border-[#8270e4] bg-[#f8f9fd] dark:bg-[#111625]' : 'border-[#e9ecf3] dark:border-[#252d40] bg-[#f8f9fd] dark:bg-[#111625]'}`}
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
                                {selectedDjs.length > 0 && (
                                    <View className="flex-row flex-wrap mt-3 gap-2 ml-1">
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
                                            if (
                                                posterUrl !==
                                                initialSession?.poster_url
                                            ) {
                                                // Keep the saved file until the session changes have been committed.
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
                        updateSessionMutation.isPending ||
                        !title.trim() ||
                        !venue.trim()
                    }
                    busy={isChecking || updateSessionMutation.isPending}
                    onSave={handleSave}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
