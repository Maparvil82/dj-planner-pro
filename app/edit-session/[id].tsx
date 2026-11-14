import { CurrencyPicker } from '../../src/components/ui/CurrencyPicker';
import { recordReviewUse } from '../../src/services/appReview';
import type { ComponentRef } from 'react';
import { SessionNotesField } from '../../src/components/sessions/SessionNotesField';
import { SessionTextInput as TextInput } from '../../src/components/sessions/SessionTextInput';
import { SessionTypePicker } from '../../src/components/sessions/SessionTypePicker';
import type { SessionEventType } from '../../src/types/session';
import { useScrollHeader } from '../../src/hooks/useScrollHeader';
import { useDarkPalette } from '../../src/contexts/ThemeContext';
import { confirmBlockedDays } from '../../src/utils/confirmBlockedDays';
import { relatedSessionTargets } from '../../src/utils/sessionWorkflow';
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
import { SessionColorPicker } from '../../src/components/sessions/SessionColorPicker';
import { SessionEditManagement } from '../../src/components/sessions/SessionEditManagement';
import { SessionScheduleSummary } from '../../src/components/sessions/SessionScheduleSummary';
import {
    parseSessionAmount,
    validateSessionInput,
} from '../../src/utils/sessionWorkflow';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
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
    const darkPalette = useDarkPalette();
    const { progress: headerProgress, onScroll: onHeaderScroll, onScrollBeginDrag: onHeaderScrollBeginDrag } = useScrollHeader('compact');
    const { id: rawId } = useLocalSearchParams();
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const {
        data: remoteSession,
        isLoading: isLoadingSession,
        isError: isSessionError,
    } = useSessionByIdQuery(id);
    const router = useRouter();
    const notesScrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
    const { t, currentLanguage, dateLocale, firstDay, numberLocale, defaultCurrency } = useTranslation();
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
    const [notes, setNotes] = useState('');
    const [eventType, setEventType] = useState<SessionEventType | null>(null);
    const [venue, setVenue] = useState('');
    const [timezone, setTimezone] = useState(
        Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
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
    const [currency, setCurrency] = useState(defaultCurrency);
    const [sessionDate, setSessionDate] = useState(localDateString());
    const [showCalendar, setShowCalendar] = useState(false);
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
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
            setNotes(remoteSession.notes || '');
            setEventType(remoteSession.event_type || null);
            setVenue(remoteSession.venue || '');
            setTimezone(
                remoteSession.booking_timezone ||
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
            );
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
    const weekday = dateObj.toLocaleDateString(dateLocale, {
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
                        : error instanceof Error &&
                            error.message.startsWith('storageSafety.')
                          ? error.message
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
            event_type: eventType,
            notes: notes.trim() || null,
            venue: venue.trim(),
            venue_id: venueId,
            booking_timezone: timezone,
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
            if ((notes.trim() || null) !== (initialSession?.notes || null))
                changes.notes = notes.trim() || null;
            if (eventType !== (initialSession?.event_type || null))
                changes.event_type = eventType;
            if (timezone !== initialSession?.booking_timezone)
                changes.booking_timezone = timezone;
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

                if (
                    [
                        'date',
                        'start_time',
                        'end_time',
                        'booking_timezone',
                        'status',
                    ].some((key) => key in changedFields)
                ) {
                    const all = await sessionService.getAllSessions(
                        authSession.user.id,
                    );
                    const original = all.find((s) => s.id === id);
                    const affected = original
                        ? relatedSessionTargets(all, original, updateAll)
                              .map((s) => ({
                                  ...s,
                                  ...changedFields,
                                  date: updateAll
                                      ? s.date
                                      : changedFields.date || s.date,
                                  recurrence_type: 'none' as const,
                              }))
                              .filter((s) => s.status !== 'cancelled')
                        : [];
                    if (!(await confirmBlockedDays(affected, t))) return;
                }
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

                if (authSession?.user.id) await recordReviewUse(authSession.user.id, true);
                if (router.canGoBack()) router.back();
                else router.replace(`/session/${id}`);
            } catch (error: any) {
                showError(
                    t('error'),
                    error.message?.startsWith('tools.') ||
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
            <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-djDark-background"
                  style={{ backgroundColor: isDark ? darkPalette.background : '#f9fafb' }}>
                <ActivityIndicator size="large" color="#7666df" />
            </View>
        );
    }

    if (!initialSession) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-djDark-background"
                  style={{ backgroundColor: isDark ? darkPalette.background : '#f9fafb' }}>
                <Text className="text-gray-500 dark:text-djDark-muted"
                      style={{ color: isDark ? darkPalette.muted : '#6b7280' }}>
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
            style={{ flex: 1, backgroundColor: isDark ? darkPalette.background : '#f5f6fa' }}
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
                            backgroundColor: isDark ? darkPalette.background : '#fff',
                            borderRadius: 22,
                            padding: 24,
                            gap: 16,
                        }}
                    >
                        <Text
                            style={{
                                color: isDark ? darkPalette.text : '#111827',
                                fontWeight: '700',
                                fontSize: 18,
                            }}
                        >
                            {t('workflow.seriesTitle')}
                        </Text>
                        <Text style={{ color: isDark ? darkPalette.muted : '#475569' }}>
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
            <SessionFormHeader progress={headerProgress}
                title={t('edit_session')}
                subtitle={t('form.editIntro')}
                onClose={() => router.back()}
            />

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView ref={notesScrollRef} scrollEventThrottle={16} onScrollBeginDrag={onHeaderScrollBeginDrag} onTouchStart={onHeaderScrollBeginDrag} onScroll={onHeaderScroll}
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
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    <SessionFormSection kind="event" title={t('form.event')}>
                        <SessionTypePicker value={eventType} onChange={setEventType} />
                        <View className="z-50">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-djDark-text mb-2 ml-1 "
                                  style={{ color: isDark ? darkPalette.text : '#374151' }}>
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
                                            className="bg-gray-50 dark:bg-djDark-raised px-4 py-2 rounded-full mr-2 border border-gray-100 dark:border-djDark-border"
                                            style={{ backgroundColor: isDark ? darkPalette.raised : '#f9fafb', borderColor: isDark ? darkPalette.border : '#f3f4f6' }}
                                            onPress={() => {
                                                setTitle(tag.name);
                                                Keyboard.dismiss();
                                            }}
                                        >
                                            <Text className="text-gray-700 dark:text-djDark-text text-sm font-medium"
                                                  style={{ color: isDark ? darkPalette.text : '#374151' }}>
                                                {tag.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                            <View
                                className={`rounded-2xl border-2 ${focusedInput === 'title' ? 'border-[#8270e4] bg-[#f8f9fd] dark:bg-djDark-field' : 'border-[#e9ecf3] dark:border-djDark-border bg-[#f8f9fd] dark:bg-djDark-field'}`}
                                style={{ backgroundColor: isDark ? darkPalette.field : '#f8f9fd', borderColor: focusedInput === 'title' ? (isDark ? darkPalette.primary : '#8270e4') : (isDark ? darkPalette.border : '#e9ecf3') }}
                            >
                                <TextInput
                                    className="px-5 py-4 text-gray-900 dark:text-djDark-text text-base font-medium"
                                    style={{ color: isDark ? darkPalette.text : '#111827' }}
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
                            <Text className="text-xs text-gray-500 dark:text-djDark-muted mt-2 ml-1"
                                  style={{ color: isDark ? darkPalette.muted : '#6b7280' }}>
                                {t('sessionNaming.hint')}
                            </Text>
                        </View>
                        <View className="z-40">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-djDark-text mb-2 ml-1 "
                                  style={{ color: isDark ? darkPalette.text : '#374151' }}>
                                {t('venue')} *
                            </Text>

                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setIsVenueModalVisible(true);
                                }}
                                className={`flex-row items-center rounded-2xl border-2 py-4 px-5 ${venueId ? 'border-[#8270e4] bg-[#f0edfc]' : 'border-[#e9ecf3] dark:border-djDark-border bg-[#f8f9fd] dark:bg-djDark-field'}`}
                                testID="session-venue-field"
                                style={{
                                    backgroundColor: isDark ? darkPalette.field : venueId ? '#f0edfc' : '#f8f9fd',
                                    borderColor: venueId ? (isDark ? darkPalette.primary : '#8270e4') : (isDark ? darkPalette.border : '#e9ecf3'),
                                }}
                            >
                                <Text
                                    className={`flex-1 text-base font-medium ${venue ? 'text-gray-900 dark:text-djDark-text' : 'text-gray-400'}`}
                                    style={{ color: isDark ? (venue ? darkPalette.text : darkPalette.muted) : venue ? '#111827' : '#9CA3AF' }}
                                >
                                    {venue || t('venue_placeholder')}
                                </Text>
                                <ChevronRight
                                    size={20}
                                    color={isDark ? darkPalette.muted : '#D1D5DB'}
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
                                onCreate={(input) =>
                                    createVenueMutation.mutateAsync(input)
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
                                <Text className="text-sm font-semibold text-gray-700 dark:text-djDark-text ml-1 "
                                      style={{ color: isDark ? darkPalette.text : '#374151' }}>
                                    {t('date') || 'Date'} *
                                </Text>
                            </View>
                            <TouchableOpacity testID="session-date-field"
                                activeOpacity={0.8}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setShowCalendar(!showCalendar);
                                }}
                                className="flex-row items-center bg-[#f8f9fd] dark:bg-djDark-field border border-[#e9ecf3] dark:border-djDark-border rounded-xl px-4 py-3.5"
                                style={{ backgroundColor: isDark ? darkPalette.field : '#f8f9fd', borderColor: isDark ? darkPalette.border : '#e9ecf3' }}
                            >
                                <Text className="flex-1 text-base text-gray-900 dark:text-djDark-text font-medium"
                                      style={{ color: isDark ? darkPalette.text : '#111827' }}>
                                    {`${weekday}, ${dateObj.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })}`}
                                </Text>
                            </TouchableOpacity>

                            {showCalendar && (
                                <View className="mt-4 bg-[#f8f9fd] dark:bg-djDark-field rounded-3xl p-3 border border-gray-100 dark:border-djDark-border overflow-hidden"
                                      style={{ backgroundColor: isDark ? darkPalette.field : '#f8f9fd', borderColor: isDark ? darkPalette.border : '#f3f4f6' }}>
                                    <Calendar
                                        firstDay={firstDay}
                                        markingType={'custom'}
                                        theme={{
                                            backgroundColor: 'transparent',
                                            calendarBackground: 'transparent',
                                            textSectionTitleColor: isDark
                                                ? darkPalette.muted
                                                : '#6B7280',
                                            selectedDayBackgroundColor:
                                                '#7666df',
                                            selectedDayTextColor: '#ffffff',
                                            todayTextColor: '#7666df',
                                            dayTextColor: isDark
                                                ? darkPalette.muted
                                                : '#111827',
                                            textDisabledColor: isDark
                                                ? darkPalette.muted
                                                : '#374151',
                                            arrowColor: isDark
                                                ? darkPalette.primary
                                                : '#7666df',
                                            monthTextColor: isDark
                                                ? darkPalette.text
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
                                <Text className="text-sm font-semibold text-gray-700 dark:text-djDark-text mb-2 ml-1 "
                                      style={{ color: isDark ? darkPalette.text : '#374151' }}>
                                    {t('start_time')}
                                </Text>
                                {Platform.OS === 'web' ? (
                                    <TextInput testID="session-start-time-field"
                                        accessibilityLabel={t('start_time')}
                                        value={startTime}
                                        onChangeText={setStartTime}
                                        placeholder="HH:MM"
                                        maxLength={5}
                                        className="bg-[#f8f9fd] dark:bg-djDark-field rounded-2xl px-4 py-4 text-gray-900 dark:text-djDark-text border border-[#e9ecf3] dark:border-djDark-border"
                                        style={{ backgroundColor: isDark ? darkPalette.field : '#f8f9fd', color: isDark ? darkPalette.text : '#111827', borderColor: isDark ? darkPalette.border : '#e9ecf3' }}
                                    />
                                ) : (
                                    <TouchableOpacity testID="session-start-time-field"
                                        onPress={() =>
                                            setShowStartTimePicker(true)
                                        }
                                        className="bg-[#f8f9fd] dark:bg-djDark-field rounded-2xl flex-row items-center pl-4 border border-[#e9ecf3] dark:border-djDark-border py-4"
                                        style={{ backgroundColor: isDark ? darkPalette.field : '#f8f9fd', borderColor: isDark ? darkPalette.border : '#e9ecf3' }}
                                    >
                                        <Text className="ml-3 text-gray-900 dark:text-djDark-text font-medium text-base"
                                              style={{ color: isDark ? darkPalette.text : '#111827' }}>
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
                                                <View className="bg-[#f8f9fd] dark:bg-djDark-field m-5 p-5 rounded-3xl w-full max-w-[300px]"
                                                      style={{ backgroundColor: isDark ? darkPalette.field : '#f8f9fd' }}>
                                                    <DateTimePicker
                                                        value={getTimeDate(
                                                            startTime,
                                                        )}
                                                        mode="time"
                                                        is24Hour={true}
                                                        display="spinner"
                                                        themeVariant={isDark ? 'dark' : 'light'}
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
                                <Text className="text-sm font-semibold text-gray-700 dark:text-djDark-text mb-2 ml-1 "
                                      style={{ color: isDark ? darkPalette.text : '#374151' }}>
                                    {t('end_time')}
                                </Text>
                                {Platform.OS === 'web' ? (
                                    <TextInput testID="session-end-time-field"
                                        accessibilityLabel={t('end_time')}
                                        value={endTime}
                                        onChangeText={setEndTime}
                                        placeholder="HH:MM"
                                        maxLength={5}
                                        className="bg-[#f8f9fd] dark:bg-djDark-field rounded-2xl px-4 py-4 text-gray-900 dark:text-djDark-text border border-[#e9ecf3] dark:border-djDark-border"
                                        style={{ backgroundColor: isDark ? darkPalette.field : '#f8f9fd', color: isDark ? darkPalette.text : '#111827', borderColor: isDark ? darkPalette.border : '#e9ecf3' }}
                                    />
                                ) : (
                                    <TouchableOpacity testID="session-end-time-field"
                                        onPress={() =>
                                            setShowEndTimePicker(true)
                                        }
                                        className="bg-[#f8f9fd] dark:bg-djDark-field rounded-2xl flex-row items-center pl-4 border border-[#e9ecf3] dark:border-djDark-border py-4"
                                        style={{ backgroundColor: isDark ? darkPalette.field : '#f8f9fd', borderColor: isDark ? darkPalette.border : '#e9ecf3' }}
                                    >
                                        <Text className="ml-3 text-gray-900 dark:text-djDark-text font-medium text-base"
                                              style={{ color: isDark ? darkPalette.text : '#111827' }}>
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
                                                <View className="bg-[#f8f9fd] dark:bg-djDark-field m-5 p-5 rounded-3xl w-full max-w-[300px]"
                                                      style={{ backgroundColor: isDark ? darkPalette.field : '#f8f9fd' }}>
                                                    <DateTimePicker
                                                        value={getTimeDate(
                                                            endTime,
                                                        )}
                                                        mode="time"
                                                        is24Hour={true}
                                                        display="spinner"
                                                        themeVariant={isDark ? 'dark' : 'light'}
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
                        <View style={{ gap: 8, marginTop: 16 }}>
                            <Text className="text-sm font-semibold text-gray-700 dark:text-djDark-text"
                                  style={{ color: isDark ? darkPalette.text : '#374151' }}>
                                {t('location.timezone')}
                            </Text>
                            <TextInput
                                value={timezone}
                                onChangeText={setTimezone}
                                autoCapitalize="none"
                                autoCorrect={false}
                                maxLength={80}
                                accessibilityLabel={t('location.timezone')}
                                className="rounded-2xl p-4 bg-gray-50 dark:bg-djDark-surface text-gray-900 dark:text-djDark-text"
                                style={{ backgroundColor: isDark ? darkPalette.surface : '#f9fafb', color: isDark ? darkPalette.text : '#111827' }}
                            />
                            <Text className="text-xs text-gray-500">
                                {t('location.timezoneHint')}
                            </Text>
                        </View>
                    </SessionFormSection>

                    <SessionFormSection kind="fee" title={t('form.fee')}>
                        <View>
                            {!(
                                earningType === 'agreement' &&
                                feeAgreement?.version === 2
                            ) && (
                                <>
                                    <Text className="text-sm font-semibold text-gray-700 dark:text-djDark-text mb-2 ml-1 "
                                          style={{ color: isDark ? darkPalette.text : '#374151' }}>
                                        {t('earning_type')}
                                    </Text>
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            backgroundColor: isDark
                                                ? darkPalette.border
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
                                                            ? darkPalette.tint
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
                                                                ? darkPalette.primary
                                                                : '#6554df'
                                                            : isDark
                                                              ? darkPalette.muted
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
                                                            ? darkPalette.tint
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
                                                                ? darkPalette.primary
                                                                : '#6554df'
                                                            : isDark
                                                              ? darkPalette.muted
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
                                                            ? darkPalette.tint
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
                                                                ? darkPalette.primary
                                                                : '#6554df'
                                                            : isDark
                                                              ? darkPalette.muted
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
                                                    ? darkPalette.tint
                                                    : '#f0edfc'
                                                : isDark
                                                  ? darkPalette.border
                                                  : '#e9ecf3',
                                        marginBottom: 16,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: isDark
                                                ? darkPalette.primary
                                                : '#6554df',
                                            fontWeight: '800',
                                        }}
                                    >
                                        {t('agreement.title')}
                                    </Text>
                                    <ProLabel />
                                </TouchableOpacity>
                            )}
                            <CurrencyPicker value={currency} onChange={setCurrency} />
                            {(FEATURES.feeAgreements ||
                                feeAgreement?.version === 2) &&
                                earningType === 'agreement' && (
                                    <FeeAgreementCard
                                        value={feeAgreement}
                                        onChange={setFeeAgreement}
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
                                        ? darkPalette.field
                                        : '#f8f9fd',
                                    borderRadius: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingLeft: 20,
                                    borderWidth: 1,
                                    borderColor: isDark ? darkPalette.border : '#e9ecf3',
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
                                        numberLocale,
                                        { minimumFractionDigits: 2 },
                                    ).format(0)}
                                    placeholderTextColor={
                                        isDark ? darkPalette.muted : '#afb5c5'
                                    }
                                    style={{
                                        flex: 1,
                                        paddingHorizontal: 16,
                                        paddingVertical: 16,
                                        color: isDark ? darkPalette.text : '#111827',
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



                    <SessionFormSection kind="notes" title={t('sessionNotes.title')}>
                        <SessionNotesField value={notes} onChange={setNotes} scrollRef={notesScrollRef} />
                    </SessionFormSection>

                    <SessionFormSection
                        kind="participants"
                        title={t('form.participants')}
                    >
                        <View className="flex-row items-center justify-between bg-[#f8f9fd] dark:bg-djDark-field rounded-2xl p-4 border border-gray-100 dark:border-djDark-border"
                              style={{ backgroundColor: isDark ? darkPalette.field : '#f8f9fd', borderColor: isDark ? darkPalette.border : '#f3f4f6' }}>
                            <View className="flex-row items-center">
                                <Text className="text-base font-semibold text-gray-900 dark:text-djDark-text"
                                      style={{ color: isDark ? darkPalette.text : '#111827' }}>
                                    {t('collective_session')}
                                </Text>
                            </View>
                            <Switch
                                accessibilityLabel={t('collective_session')}
                                trackColor={{
                                    false: isDark ? darkPalette.raised : '#d9dce8',
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
                                    className="w-full h-40 bg-gray-50 dark:bg-djDark-surface border-2 border-dashed border-[#e9ecf3] dark:border-djDark-border rounded-3xl items-center justify-center p-6 dark:border-0"
                                    style={{ backgroundColor: isDark ? darkPalette.surface : '#f9fafb', borderColor: isDark ? darkPalette.border : '#e9ecf3' }}
                                >
                                    {isUploadingPoster ? (
                                        <ActivityIndicator
                                            color={
                                                isDark ? darkPalette.primary : '#7666df'
                                            }
                                        />
                                    ) : (
                                        <>
                                            <View className="w-16 h-16 bg-white dark:bg-djDark-raised rounded-full items-center justify-center mb-4 shadow-sm"
                                                  style={{ backgroundColor: isDark ? darkPalette.raised : '#ffffff' }}>
                                                <Camera
                                                    size={28}
                                                    color={
                                                        isDark
                                                            ? darkPalette.muted
                                                            : '#4B5563'
                                                    }
                                                    strokeWidth={1.5}
                                                />
                                            </View>
                                            <Text style={isDark && { color: darkPalette.onSurface }} className="text-gray-900 dark:text-djDark-text font-bold text-lg mb-1">
                                                {t('add_poster')}
                                            </Text>
                                            <Text style={isDark && { color: darkPalette.onSurface }} className="text-gray-500 dark:text-djDark-muted text-sm text-center">
                                                {t('form.posterHint')}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    </SessionFormSection>
                    <SessionFormSection kind="settings" title={t('choose_color')}>
                        <SessionColorPicker value={selectedColor} onChange={setSelectedColor} />
                    </SessionFormSection>
                    {remoteSession && !remoteSession.is_guest && remoteSession.user_id === authSession?.user.id && <SessionFormSection kind="settings" title={t('sessionManagement.title')}>
                        <SessionEditManagement session={remoteSession} status={status} onStatusChange={setStatus} busy={isChecking || isUploadingPoster || updateSessionMutation.isPending} />
                    </SessionFormSection>}
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
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
