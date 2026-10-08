import { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import {
    SafeAreaView,
    useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
    Redirect,
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useAuthStore } from '../src/store/useAuthStore';
import { useTranslation } from '../src/i18n/useTranslation';
import { sessionService } from '../src/services/sessions';
import {
    guestService,
    guestSearch,
    type EventGuest,
} from '../src/services/guests';
import { sessionDisplayTitle } from '../src/utils/sessionNaming';
import { SessionFormHeader } from '../src/components/sessions/SessionFormLayout';
import {
    CommunityButton,
    CommunityMessage,
    useCommunityColors,
} from '../src/components/community/CommunityUI';

function Stepper({
    value,
    max,
    min = 0,
    onChange,
    label,
    disabled,
}: {
    value: number;
    max: number;
    min?: number;
    onChange: (value: number) => void;
    label: string;
    disabled: boolean;
}) {
    const c = useCommunityColors(),
        { t } = useTranslation();
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
            }}
        >
            <Text style={{ color: c.fg, fontSize: 16, flex: 1 }}>{label}</Text>
            <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}
            >
                <CommunityButton
                    compact
                    secondary
                    label="−"
                    accessibilityLabel={t('guests.decrease')}
                    disabled={disabled || value <= min}
                    onPress={() => onChange(value - 1)}
                />
                <Text
                    accessibilityLiveRegion="polite"
                    style={{
                        color: c.fg,
                        fontSize: 20,
                        fontWeight: '700',
                        minWidth: 24,
                        textAlign: 'center',
                    }}
                >
                    {value}
                </Text>
                <CommunityButton
                    compact
                    secondary
                    label="+"
                    accessibilityLabel={t('guests.increase')}
                    disabled={disabled || value >= max}
                    onPress={() => onChange(value + 1)}
                />
            </View>
        </View>
    );
}

export default function GuestsScreen() {
    const router = useRouter(),
        c = useCommunityColors(),
        { t, currentLanguage } = useTranslation(),
        insets = useSafeAreaInsets(),
        { height } = useWindowDimensions();
    const userId = useAuthStore((s) => s.session?.user.id),
        qc = useQueryClient();
    const params = useLocalSearchParams<{ sessionId?: string }>();
    const [sessionId, setSessionId] = useState(params.sessionId || ''),
        [search, setSearch] = useState('');
    const [mode, setMode] = useState<'add' | 'edit' | 'access' | null>(null),
        [guestId, setGuestId] = useState('');
    const [editingRevision, setEditingRevision] = useState(0),
        [pullRefreshing, setPullRefreshing] = useState(false);
    const [name, setName] = useState(''),
        [companions, setCompanions] = useState(0),
        [quantity, setQuantity] = useState(1);
    const [confirmDelete, setConfirmDelete] = useState(false),
        [allowDuplicate, setAllowDuplicate] = useState(false);
    const [busy, setBusy] = useState(false),
        [error, setError] = useState('');
    const lock = useRef(false),
        newId = useRef(''),
        request = useRef<{ signature: string; id: string } | null>(null);
    const sessions = useQuery({
        queryKey: ['sessions', 'all', userId],
        queryFn: () => sessionService.getAllSessions(userId!),
        enabled: !!userId,
        staleTime: 0,
    });
    const event = sessions.data?.find(
        (s) => s.id === sessionId && s.user_id === userId && !s.is_guest,
    );
    const guests = useQuery({
        queryKey: ['guests', userId, sessionId],
        queryFn: () => guestService.list(sessionId),
        enabled: !!event,
        refetchInterval: 10000,
    });
    useFocusEffect(
        useCallback(() => {
            if (userId && sessionId)
                void qc.invalidateQueries({
                    queryKey: ['guests', userId, sessionId],
                });
        }, [qc, userId, sessionId]),
    );
    const rows = guests.data || [],
        selected = rows.find((g) => g.id === guestId);
    const cancelled = event?.status === 'cancelled';
    const total = rows.reduce((sum, g) => sum + Number(g.total), 0),
        admitted = rows.reduce((sum, g) => sum + Number(g.admitted), 0);
    const duplicate = rows.some(
        (g) =>
            g.id !== guestId && guestSearch(g.full_name) === guestSearch(name),
    );
    const field = {
        backgroundColor: c.field,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 14,
        padding: 15,
        color: c.fg,
        fontSize: 16,
    };
    const close = () => {
        if (lock.current) return;
        setMode(null);
        setError('');
        setConfirmDelete(false);
    };
    async function refresh() {
        await Promise.all([
            qc.invalidateQueries({ queryKey: ['guests', userId, sessionId] }),
            qc.invalidateQueries({ queryKey: ['tickets', userId, sessionId] }),
        ]);
    }
    async function act(task: () => Promise<void>, closeAfter = false) {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            await task();
            await refresh();
            if (closeAfter) setMode(null);
        } catch (e) {
            setError(
                t(e instanceof Error ? e.message : 'tickets.connectionError'),
            );
            void refresh();
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    function openAdd() {
        newId.current = Crypto.randomUUID();
        setGuestId('');
        setName('');
        setCompanions(0);
        setError('');
        setAllowDuplicate(false);
        setMode('add');
    }
    function openGuest(g: EventGuest) {
        setGuestId(g.id);
        setEditingRevision(g.revision);
        setName(g.full_name);
        setCompanions(g.companions);
        setQuantity(1);
        setConfirmDelete(false);
        setAllowDuplicate(false);
        setError('');
        setMode('access');
    }
    async function save() {
        if (name.trim().length < 2 || name.trim().length > 120) {
            setError(t('guests.invalid'));
            return;
        }
        if (duplicate && !allowDuplicate) {
            setAllowDuplicate(true);
            return;
        }
        await act(
            () =>
                guestService.save(
                    sessionId,
                    selected?.id || newId.current,
                    name,
                    companions,
                    mode === 'edit' ? editingRevision : 0,
                ),
            true,
        );
    }
    async function access(action: 'admit' | 'undo', count: number) {
        if (!selected) return;
        const signature = `${sessionId}:${selected.id}:${action}:${count}`;
        if (request.current?.signature !== signature)
            request.current = { signature, id: Crypto.randomUUID() };
        const key = request.current.id;
        await act(async () => {
            await guestService.access(
                sessionId,
                selected.id,
                action,
                count,
                key,
            );
            request.current = null;
        }, true);
    }
    if (!userId) return <Redirect href="/(auth)/login" />;
    return (
        <SafeAreaView
            edges={['top', 'bottom']}
            style={{ flex: 1, backgroundColor: c.bg }}
        >
            <SessionFormHeader
                title={t('guests.title')}
                subtitle={
                    event
                        ? sessionDisplayTitle(event, t)
                        : t('guests.selectSession')
                }
                onClose={() => router.back()}
            />
            {!event ? (
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ padding: 20, gap: 12 }}
                >
                    {sessions.isPending ? (
                        <ActivityIndicator color={c.accent} />
                    ) : sessions.isError ? (
                        <CommunityMessage
                            title={t('tickets.connectionError')}
                            retry={() => {
                                void sessions.refetch();
                            }}
                        />
                    ) : (
                        <>
                            {!(sessions.data || []).some(
                                (s) =>
                                    s.user_id === userId &&
                                    !s.is_guest &&
                                    s.status !== 'cancelled',
                            ) ? (
                                <>
                                    <CommunityMessage
                                        title={t('guests.noSessions')}
                                        hint={t('guests.noSessionsHint')}
                                    />
                                    <CommunityButton
                                        label={t('guests.createSession')}
                                        onPress={() =>
                                            router.push('/add-session')
                                        }
                                    />
                                </>
                            ) : (
                                <>
                                    <TextInput
                                        style={field}
                                        placeholder={t('tickets.searchSession')}
                                        placeholderTextColor={c.muted}
                                        accessibilityLabel={t(
                                            'tickets.searchSession',
                                        )}
                                        value={search}
                                        onChangeText={setSearch}
                                    />
                                    {(sessions.data || [])
                                        .filter(
                                            (s) =>
                                                s.user_id === userId &&
                                                !s.is_guest &&
                                                s.status !== 'cancelled' &&
                                                guestSearch(
                                                    `${sessionDisplayTitle(s, t)} ${s.venue}`,
                                                ).includes(guestSearch(search)),
                                        )
                                        .map((s) => (
                                            <Pressable
                                                key={s.id}
                                                accessibilityRole="button"
                                                onPress={() => {
                                                    setSessionId(s.id);
                                                    setSearch('');
                                                }}
                                                style={{
                                                    padding: 18,
                                                    borderRadius: 18,
                                                    backgroundColor: c.card,
                                                    borderWidth: 1,
                                                    borderColor: c.border,
                                                    gap: 6,
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        color: c.accent,
                                                        fontWeight: '700',
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    {new Date(
                                                        `${s.date}T12:00:00`,
                                                    ).toLocaleDateString(
                                                        currentLanguage,
                                                        {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric',
                                                        },
                                                    )}
                                                </Text>
                                                <Text
                                                    style={{
                                                        color: c.fg,
                                                        fontSize: 17,
                                                        fontWeight: '700',
                                                    }}
                                                >
                                                    {sessionDisplayTitle(s, t)}
                                                </Text>
                                                <Text
                                                    style={{ color: c.muted }}
                                                >
                                                    {s.venue}
                                                </Text>
                                            </Pressable>
                                        ))}
                                </>
                            )}
                        </>
                    )}
                </ScrollView>
            ) : (
                <>
                    <View
                        style={{
                            paddingHorizontal: 20,
                            gap: 16,
                            paddingBottom: 16,
                        }}
                    >
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            {[
                                ['expected', total],
                                ['inside', admitted],
                                ['pending', total - admitted],
                            ].map(([label, n]) => (
                                <View
                                    key={label}
                                    style={{
                                        flex: 1,
                                        padding: 14,
                                        borderRadius: 18,
                                        backgroundColor:
                                            label === 'inside'
                                                ? c.tint
                                                : c.card,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: c.accent,
                                            fontSize: 26,
                                            fontWeight: '800',
                                        }}
                                    >
                                        {n}
                                    </Text>
                                    <Text
                                        style={{
                                            color: c.muted,
                                            fontSize: 11,
                                            marginTop: 4,
                                        }}
                                    >
                                        {t(`guests.${label}`)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                        {cancelled && (
                            <Text style={{ color: c.muted }}>
                                {t('tickets.cancelledSession')}
                            </Text>
                        )}
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                                <CommunityButton
                                    label={t('guests.add')}
                                    disabled={
                                        cancelled ||
                                        guests.isPending ||
                                        guests.isError
                                    }
                                    onPress={openAdd}
                                />
                            </View>
                            <CommunityButton
                                secondary
                                label={t('guests.changeSession')}
                                onPress={() => {
                                    setSessionId('');
                                    setSearch('');
                                }}
                            />
                        </View>
                        <TextInput
                            style={field}
                            placeholder={t('guests.search')}
                            placeholderTextColor={c.muted}
                            accessibilityLabel={t('guests.search')}
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                    <FlatList
                        data={rows.filter((g) =>
                            guestSearch(g.full_name).includes(
                                guestSearch(search),
                            ),
                        )}
                        keyExtractor={(g) => g.id}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{
                            paddingHorizontal: 20,
                            paddingBottom: 24,
                            gap: 10,
                        }}
                        refreshing={pullRefreshing}
                        onRefresh={() => {
                            setPullRefreshing(true);
                            void guests
                                .refetch()
                                .finally(() => setPullRefreshing(false));
                        }}
                        ListEmptyComponent={
                            guests.isPending ? (
                                <ActivityIndicator color={c.accent} />
                            ) : (
                                <CommunityMessage
                                    title={
                                        guests.isError
                                            ? t('tickets.connectionError')
                                            : search
                                              ? t('guests.noResults')
                                              : t('guests.empty')
                                    }
                                    hint={
                                        !search && !guests.isError
                                            ? t('guests.emptyHint')
                                            : undefined
                                    }
                                    retry={
                                        guests.isError
                                            ? () => {
                                                  void guests.refetch();
                                              }
                                            : undefined
                                    }
                                />
                            )
                        }
                        renderItem={({ item: g }) => (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`${g.full_name}, ${t('guests.progress', { count: Number(g.admitted), total: Number(g.total) })}`}
                                onPress={() => openGuest(g)}
                                style={{
                                    backgroundColor: c.card,
                                    borderRadius: 18,
                                    borderWidth: 1,
                                    borderColor: c.border,
                                    padding: 16,
                                    gap: 10,
                                }}
                            >
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}
                                >
                                    <Text
                                        style={{
                                            flex: 1,
                                            color: c.fg,
                                            fontSize: 17,
                                            fontWeight: '700',
                                        }}
                                    >
                                        {g.full_name}
                                    </Text>
                                    {g.companions > 0 && (
                                        <Text
                                            style={{
                                                color: c.accent,
                                                fontWeight: '800',
                                                backgroundColor: c.tint,
                                                paddingHorizontal: 10,
                                                paddingVertical: 5,
                                                borderRadius: 9,
                                            }}
                                        >
                                            +{g.companions}
                                        </Text>
                                    )}
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <Text style={{ color: c.muted, flex: 1 }}>
                                        {t('guests.progress', {
                                            count: Number(g.admitted),
                                            total: Number(g.total),
                                        })}
                                    </Text>
                                    <Text
                                        style={{
                                            color:
                                                g.admitted === g.total
                                                    ? '#009980'
                                                    : c.accent,
                                            fontSize: 12,
                                            fontWeight: '700',
                                        }}
                                    >
                                        {g.admitted === g.total
                                            ? t('guests.complete')
                                            : t('guests.register')}
                                    </Text>
                                </View>
                            </Pressable>
                        )}
                    />
                </>
            )}
            <Modal
                visible={mode !== null}
                transparent
                animationType="slide"
                onRequestClose={close}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{
                        flex: 1,
                        justifyContent: 'flex-end',
                        backgroundColor: 'rgba(10,14,28,.45)',
                    }}
                >
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('accountMenu.close')}
                        onPress={close}
                        style={{ position: 'absolute', inset: 0 }}
                    />
                    <View
                        accessibilityViewIsModal
                        style={{
                            backgroundColor: c.bg,
                            borderTopLeftRadius: 28,
                            borderTopRightRadius: 28,
                            maxHeight: height * 0.88,
                            paddingBottom: Math.max(insets.bottom, 20),
                        }}
                    >
                        <SessionFormHeader
                            title={
                                mode === 'access'
                                    ? selected?.full_name || t('guests.title')
                                    : mode === 'edit'
                                      ? t('guests.edit')
                                      : t('guests.add')
                            }
                            subtitle={
                                mode === 'access' && selected
                                    ? t('guests.progress', {
                                          count: Number(selected.admitted),
                                          total: Number(selected.total),
                                      })
                                    : t('guests.formHint')
                            }
                            onClose={close}
                        />
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            automaticallyAdjustKeyboardInsets={false}
                            contentContainerStyle={{
                                paddingHorizontal: 24,
                                paddingBottom: 12,
                                gap: 20,
                            }}
                        >
                            {error !== '' && (
                                <Text
                                    accessibilityRole="alert"
                                    style={{ color: '#d64a62' }}
                                >
                                    {error}
                                </Text>
                            )}
                            {mode === 'access' && selected ? (
                                <>
                                    {selected.total > selected.admitted && (
                                        <>
                                            <Stepper
                                                label={t('guests.arriving')}
                                                value={Math.min(
                                                    quantity,
                                                    selected.total -
                                                        selected.admitted,
                                                )}
                                                min={1}
                                                max={
                                                    selected.total -
                                                    selected.admitted
                                                }
                                                onChange={setQuantity}
                                                disabled={busy || !!cancelled}
                                            />
                                            <CommunityButton
                                                label={t('guests.admitCount', {
                                                    count: Math.min(
                                                        quantity,
                                                        selected.total -
                                                            selected.admitted,
                                                    ),
                                                })}
                                                disabled={cancelled}
                                                busy={busy}
                                                onPress={() => {
                                                    void access(
                                                        'admit',
                                                        Math.min(
                                                            quantity,
                                                            selected.total -
                                                                selected.admitted,
                                                        ),
                                                    );
                                                }}
                                            />
                                        </>
                                    )}
                                    {selected.admitted > 0 && (
                                        <CommunityButton
                                            secondary
                                            label={t('guests.undo')}
                                            disabled={cancelled || busy}
                                            onPress={() => {
                                                void access('undo', 1);
                                            }}
                                        />
                                    )}
                                    <CommunityButton
                                        outlined
                                        label={t('guests.edit')}
                                        disabled={cancelled || busy}
                                        onPress={() => {
                                            setEditingRevision(
                                                selected.revision,
                                            );
                                            setName(selected.full_name);
                                            setCompanions(selected.companions);
                                            setMode('edit');
                                        }}
                                    />
                                    {!confirmDelete ? (
                                        <CommunityButton
                                            outlined
                                            label={t('guests.remove')}
                                            disabled={
                                                busy || selected.admitted > 0
                                            }
                                            onPress={() =>
                                                setConfirmDelete(true)
                                            }
                                        />
                                    ) : (
                                        <>
                                            <Text style={{ color: c.muted }}>
                                                {t('guests.removeConfirm')}
                                            </Text>
                                            <CommunityButton
                                                label={t(
                                                    'guests.confirmRemove',
                                                )}
                                                busy={busy}
                                                onPress={() => {
                                                    void act(
                                                        () =>
                                                            guestService.remove(
                                                                sessionId,
                                                                selected.id,
                                                            ),
                                                        true,
                                                    );
                                                }}
                                            />
                                        </>
                                    )}
                                    <Text
                                        style={{ color: c.muted, fontSize: 12 }}
                                    >
                                        {t('guests.onlineHint')}
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <TextInput
                                        style={field}
                                        value={name}
                                        onChangeText={(v) => {
                                            setName(v);
                                            setAllowDuplicate(false);
                                        }}
                                        editable={!busy}
                                        maxLength={120}
                                        autoCapitalize="words"
                                        autoFocus
                                        placeholder={t('guests.fullName')}
                                        placeholderTextColor={c.muted}
                                        accessibilityLabel={t(
                                            'guests.fullName',
                                        )}
                                    />
                                    <Stepper
                                        label={t('guests.companions')}
                                        value={companions}
                                        max={99}
                                        onChange={setCompanions}
                                        disabled={busy}
                                    />
                                    <Text style={{ color: c.muted }}>
                                        {t('guests.totalPeople', {
                                            count: companions + 1,
                                        })}
                                    </Text>
                                    {allowDuplicate && duplicate && (
                                        <Text style={{ color: c.accent }}>
                                            {t('guests.duplicate')}
                                        </Text>
                                    )}
                                    <CommunityButton
                                        label={
                                            allowDuplicate && duplicate
                                                ? t('guests.addAnyway')
                                                : mode === 'edit'
                                                  ? t('guests.save')
                                                  : t('guests.add')
                                        }
                                        busy={busy}
                                        onPress={() => {
                                            void save();
                                        }}
                                    />
                                    {mode === 'edit' && (
                                        <CommunityButton
                                            secondary
                                            label={t('guests.backAccess')}
                                            disabled={busy}
                                            onPress={() => {
                                                if (selected) {
                                                    setName(selected.full_name);
                                                    setCompanions(
                                                        selected.companions,
                                                    );
                                                }
                                                setMode('access');
                                            }}
                                        />
                                    )}
                                </>
                            )}
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}
