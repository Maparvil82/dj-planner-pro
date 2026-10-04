import { FEATURES } from '../../src/config/features';
import {
    FeeAgreementCard,
    ProLabel,
} from '../../src/components/sessions/FeeAgreementCard';
import {
    type FeeAgreement,
    agreementAmount,
} from '../../src/utils/feeAgreement';
import { useSessionUsage } from '../../src/hooks/useSessionUsage';
import { useKeyboardVisible } from '../../src/hooks/useKeyboardVisible';
import { SessionVenueSheet } from '../../src/components/venues/SessionVenueSheet';
import { sessionDisplayTitle } from '../../src/utils/sessionNaming';
import { SessionPosterPreview } from '../../src/components/sessions/SessionPosterPreview';
import type { PosterPosition } from '../../src/utils/posterFrame';
import { useSessionCollaborators } from '../../src/hooks/useCollaborations';
import { SessionDJPicker } from '../../src/components/sessions/SessionDJPicker';
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
    Platform,
    Modal,
    Pressable,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState, useRef, useContext, useEffect } from 'react';
import { Stack, useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { useTranslation } from '../../src/i18n/useTranslation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/useAuthStore';
import { X, ChevronRight, Plus, Check, Camera } from 'lucide-react-native';
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
import { pickSessionPoster } from '../../src/services/sessionPoster';
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
    const keyboardVisible = useKeyboardVisible();
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
    const [earningType, setEarningType] = useState<
        'free' | 'hourly' | 'fixed' | 'agreement'
    >('free');
    const [feeAgreement, setFeeAgreement] = useState<FeeAgreement | null>(null);
    const usage = useSessionUsage();
    const [earningAmount, setEarningAmount] = useState('');
    const [currency, setCurrency] = useState('€');
    const [sessionDate, setSessionDate] = useState(localDateString());
    const [showCalendar, setShowCalendar] = useState(false);
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [isColorModalVisible, setIsColorModalVisible] = useState(false);
    const [isCollective, setIsCollective] = useState(false);
    const [djInput, setDjInput] = useState('');
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

    const collaborators = useSessionCollaborators(
        remoteSession?.is_guest ? undefined : remoteSession?.id,
    );
    const [rosterLoaded, setRosterLoaded] = useState<string | null>(null);
    useEffect(() => {
        if (
            remoteSession &&
            collaborators.data &&
            rosterLoaded !== remoteSession.id
        ) {
            setLinkedDjs(
                Object.fromEntries(
                    collaborators.data.map((person) => [
                        person.artist_name,
                        person.dj_id,
                    ]),
                ),
            );
            setRosterLoaded(remoteSession.id);
        }
    }, [remoteSession, collaborators.data, rosterLoaded]);

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
            setStatus(
                remoteSession.status === 'cancelled'
                    ? 'cancelled'
                    : 'confirmed',
            );
            setEarningType(remoteSession.earning_type || 'free');
            setFeeAgreement(remoteSession.fee_agreement || null);
            setEarningAmount(remoteSession.earning_amount?.toString() || '');
            setCurrency(remoteSession.currency || '€');
            setSessionDate(remoteSession.date || localDateString());
            setSelectedColor(remoteSession.color || null);
            setIsCollective(remoteSession.is_collective || false);
            setSelectedDjs(remoteSession.djs || []);
            setPosterUrl(remoteSession.poster_url || null);
            setPosterPosition({
                x: remoteSession.poster_focus_x ?? 0.5,
                y: remoteSession.poster_focus_y ?? 0.5,
            });
        }
    }, [remoteSession]);

    const handleFocus = (type: string) => setFocusedInput(type);
    const handleBlur = () => setTimeout(() => setFocusedInput(null), 150);

    // Queries and memoized filters
    const { data: titleTags = [] } = useTagsQuery('title');
    const { data: venues = [] } = useVenuesQuery();
    const { data: djTags = [] } = useTagsQuery('dj');

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

    const posterPicking = useRef(false);
    const handlePickPoster = async () => {
        if (posterPicking.current || isUploadingPoster || !authSession?.user.id)
            return;
        posterPicking.current = true;
        setIsUploadingPoster(true);
        try {
            const asset = await pickSessionPoster();
            if (!asset?.uri) return;
            const url = await sessionService.uploadSessionPoster(
                authSession.user.id,
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
        if (saving.current) return;
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
        if (!venue.trim()) {
            showError(t('error'), t('missing_fields'));
            return;
        }

        if (collaborators.isPending || collaborators.isError) {
            showError(t('error'), t('collaboration.searchError'));
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
            dj_profile_ids: isCollective ? Object.values(linkedDjs) : [],
            earning_type: earningType,
            fee_agreement: earningType === 'agreement' ? feeAgreement : null,
            earning_amount: amount,
            currency: currency,
            color: selectedColor || undefined,
            status: status,
            poster_url: posterUrl,
            poster_focus_x: posterPosition.x,
            poster_focus_y: posterPosition.y,
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
            if (
                JSON.stringify(fullInput.dj_profile_ids.slice().sort()) !==
                JSON.stringify(
                    (initialSession?.dj_profile_ids || []).slice().sort(),
                )
            )
                changes.dj_profile_ids = fullInput.dj_profile_ids;
            if (
                JSON.stringify(fullInput.fee_agreement) !==
                JSON.stringify(initialSession?.fee_agreement || null)
            )
                changes.fee_agreement = fullInput.fee_agreement;
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
            if (posterPosition.x !== (initialSession?.poster_focus_x ?? 0.5))
                changes.poster_focus_x = posterPosition.x;
            if (posterPosition.y !== (initialSession?.poster_focus_y ?? 0.5))
                changes.poster_focus_y = posterPosition.y;
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
                                        `${sessionDisplayTitle(item, t)} · ${item.date} · ${item.start_time}–${item.end_time}`,
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

                if (router.canGoBack()) router.back();
                else router.replace(`/session/${id}`);
            } catch (error: any) {
                showError(
                    t('error'),
                    error.message?.startsWith('workflow.') ||
                        error.message?.startsWith('bookings.errors.') ||
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
        const frameOnly = Object.keys(changedFields).every((key) =>
            ['poster_focus_x', 'poster_focus_y'].includes(key),
        );
        if (!isSeries || changedFields.date || frameOnly) {
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

    if (remoteSession?.is_guest)
        return <Redirect href={`/session/${remoteSession.id}`} />;
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
            edges={
                keyboardVisible
                    ? ['top', 'left', 'right']
                    : ['top', 'bottom', 'left', 'right']
            }
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
                                <ChevronRight
                                    size={20}
                                    color={isDark ? '#4B5563' : '#D1D5DB'}
                                />
                            </TouchableOpacity>

                            {/* Venue Selection Modal */}
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
                                onCreate={(name) =>
                                    createVenueMutation.mutateAsync({ name })
                                }
                            />
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
                            {FEATURES.feeAgreements &&
                                earningType === 'agreement' && (
                                    <FeeAgreementCard
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
                                disabled={
                                    collaborators.isPending ||
                                    collaborators.isError
                                }
                                query={djInput}
                                onQueryChange={setDjInput}
                                suggestions={djTags}
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
                            updateSessionMutation.isPending ||
                            !venue.trim()
                        }
                        busy={isChecking || updateSessionMutation.isPending}
                        onSave={handleSave}
                    />
                )}
            </View>
        </SafeAreaView>
    );
}
