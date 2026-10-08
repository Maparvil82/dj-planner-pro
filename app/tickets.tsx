import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import {
    useInfiniteQuery,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useAuthStore } from '../src/store/useAuthStore';
import { useTranslation } from '../src/i18n/useTranslation';
import { sessionService } from '../src/services/sessions';
import {
    ticketService,
    type EventTicket,
    type TicketPayment,
} from '../src/services/tickets';
import { sessionDisplayTitle } from '../src/utils/sessionNaming';
import { ticketPrice, ticketQuantity } from '../src/utils/ticketing';
import { SessionFormHeader } from '../src/components/sessions/SessionFormLayout';
import {
    CommunityButton,
    CommunityMessage,
    useCommunityColors,
} from '../src/components/community/CommunityUI';
import { TicketPassSheet } from '../src/components/tickets/TicketPassSheet';

export default function TicketsScreen() {
    const router = useRouter(),
        c = useCommunityColors(),
        { t, currentLanguage } = useTranslation();
    const userId = useAuthStore((s) => s.session?.user.id),
        queryClient = useQueryClient();
    const params = useLocalSearchParams<{ sessionId?: string }>();
    const [sessionId, setSessionId] = useState(params.sessionId || ''),
        [search, setSearch] = useState('');
    const [tab, setTab] = useState<'overview' | 'issue' | 'list'>('overview');
    const [addingType, setAddingType] = useState(false),
        [name, setName] = useState(''),
        [price, setPrice] = useState(''),
        [invitation, setInvitation] = useState(false);
    const [typeId, setTypeId] = useState(''),
        [quantity, setQuantity] = useState('1'),
        [payment, setPayment] = useState<TicketPayment>('pending');
    const [busy, setBusy] = useState(false),
        [error, setError] = useState(''),
        [pass, setPass] = useState<EventTicket | null>(null);
    const batch = useRef<{ signature: string; id: string } | null>(null),
        working = useRef(false);
    const sessions = useQuery({
        queryKey: ['sessions', 'all', userId],
        queryFn: () => sessionService.getAllSessions(userId!),
        enabled: !!userId,
        staleTime: 0,
    });
    const event = sessions.data?.find(
        (s) => s.id === sessionId && s.user_id === userId && !s.is_guest,
    );
    const types = useQuery({
        queryKey: ['tickets', userId, sessionId, 'types'],
        queryFn: () => ticketService.types(sessionId),
        enabled: !!event,
    });
    const summary = useQuery({
        queryKey: ['tickets', userId, sessionId, 'summary'],
        queryFn: () => ticketService.summary(sessionId),
        enabled: !!event,
        refetchInterval: 10000,
    });
    const list = useInfiniteQuery({
        queryKey: ['tickets', userId, sessionId, 'list'],
        queryFn: ({ pageParam }) => ticketService.list(sessionId, pageParam),
        initialPageParam: 0,
        getNextPageParam: (last, pages) =>
            last.length === 50 ? pages.length : undefined,
        enabled: !!event && tab === 'list',
    });
    const kind = types.data?.find((k) => k.id === typeId);
    if (!userId) return <Redirect href="/(auth)/login" />;
    const refresh = () =>
        queryClient.invalidateQueries({
            queryKey: ['tickets', userId, sessionId],
        });
    const money = (n: number) =>
        `${Number(n).toLocaleString(currentLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${event?.currency || '€'}`;
    const field = {
        backgroundColor: c.field,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 14,
        padding: 15,
        color: c.fg,
        fontSize: 16,
    };
    async function act(task: () => Promise<void>) {
        if (working.current) return;
        working.current = true;
        setBusy(true);
        setError('');
        try {
            await task();
            await refresh();
        } catch (e) {
            setError(
                t(e instanceof Error ? e.message : 'tickets.connectionError'),
            );
        } finally {
            working.current = false;
            setBusy(false);
        }
    }
    async function addType() {
        const amount = invitation ? 0 : ticketPrice(price);
        if (!name.trim() || name.trim().length > 80 || amount === null) {
            setError(t('tickets.invalidType'));
            return;
        }
        await act(async () => {
            const k = await ticketService.addType(
                sessionId,
                name,
                amount,
                invitation,
            );
            setTypeId(k.id);
            setName('');
            setPrice('');
            setInvitation(false);
            setAddingType(false);
        });
    }
    async function importAgreementTypes() {
        if (
            event?.fee_agreement?.version !== 2 ||
            types.isPending ||
            types.isError
        )
            return;
        const tickets = event.fee_agreement.tickets;
        await act(async () => {
            // Fetch once on each attempt so an interrupted import can resume safely.
            const existing = await ticketService.types(sessionId);
            const names = new Set(
                existing.map((k) => k.name.trim().toLowerCase()),
            );
            for (const row of tickets) {
                if (names.has(row.name.trim().toLowerCase())) continue;
                await ticketService.addType(
                    sessionId,
                    row.name,
                    row.price,
                    false,
                );
                names.add(row.name.trim().toLowerCase());
            }
        });
    }
    async function issue() {
        const count = ticketQuantity(quantity);
        if (!kind || count === null) {
            setError(t('tickets.invalidIssue'));
            return;
        }
        const paymentStatus = kind.is_invitation ? 'invitation' : payment;
        const signature = `${sessionId}:${typeId}:${count}:${paymentStatus}`;
        if (batch.current?.signature !== signature)
            batch.current = { signature, id: Crypto.randomUUID() };
        await act(async () => {
            const created = await ticketService.issue(
                sessionId,
                typeId,
                count,
                paymentStatus,
                batch.current!.id,
            );
            batch.current = null;
            setTab('list');
            if (created.length === 1) setPass(created[0]);
        });
    }
    const heading = (text: string) => (
        <Text style={{ color: c.fg, fontSize: 20, fontWeight: '800' }}>
            {text}
        </Text>
    );
    const rows =
        sessions.data
            ?.filter(
                (s) =>
                    !s.is_guest &&
                    s.user_id === userId &&
                    `${sessionDisplayTitle(s, t)} ${s.venue} ${s.date}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
            )
            .sort((a, b) => b.date.localeCompare(a.date)) || [];
    const stats = summary.data;
    const readError =
        types.isError || summary.isError || (tab === 'list' && list.isError);
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
            <SessionFormHeader
                title={t('tickets.title')}
                subtitle={
                    event
                        ? `${sessionDisplayTitle(event, t)} · ${event.date}`
                        : t('tickets.chooseSession')
                }
                onClose={() => !busy && router.back()}
            />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{
                        paddingHorizontal: 20,
                        paddingBottom: 30,
                        gap: 18,
                    }}
                >
                    {sessions.isPending ? (
                        <ActivityIndicator color={c.accent} />
                    ) : sessions.isError ? (
                        <CommunityMessage
                            title={t('tickets.connectionError')}
                            retry={() => void sessions.refetch()}
                        />
                    ) : !event ? (
                        <>
                            <TextInput
                                accessibilityLabel={t('search')}
                                placeholder={t('search')}
                                placeholderTextColor={c.muted}
                                value={search}
                                onChangeText={setSearch}
                                style={field}
                            />
                            {rows.map((s) => (
                                <TouchableOpacity
                                    key={s.id}
                                    accessibilityRole="button"
                                    onPress={() => {
                                        setSessionId(s.id);
                                        setTab('overview');
                                        setError('');
                                        setTypeId('');
                                    }}
                                    style={{
                                        padding: 18,
                                        borderRadius: 20,
                                        backgroundColor: c.card,
                                        borderWidth: 1,
                                        borderColor: c.border,
                                        gap: 5,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: c.fg,
                                            fontSize: 16,
                                            fontWeight: '700',
                                        }}
                                    >
                                        {sessionDisplayTitle(s, t)}
                                    </Text>
                                    <Text style={{ color: c.muted }}>
                                        {s.date} · {s.venue}
                                    </Text>
                                    {s.status === 'cancelled' && (
                                        <Text style={{ color: '#c83d53' }}>
                                            {t('tickets.eventCancelled')}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                            {!rows.length && (
                                <CommunityMessage
                                    title={t('tickets.noSessions')}
                                    hint={t('tickets.noSessionsHint')}
                                />
                            )}
                        </>
                    ) : (
                        <>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    backgroundColor: c.border,
                                    padding: 4,
                                    borderRadius: 16,
                                }}
                            >
                                {(['overview', 'issue', 'list'] as const).map(
                                    (key) => (
                                        <TouchableOpacity
                                            key={key}
                                            disabled={busy}
                                            accessibilityRole="tab"
                                            accessibilityState={{
                                                selected: tab === key,
                                            }}
                                            onPress={() => {
                                                setTab(key);
                                                setError('');
                                            }}
                                            style={{
                                                flex: 1,
                                                paddingVertical: 13,
                                                alignItems: 'center',
                                                borderRadius: 12,
                                                backgroundColor:
                                                    tab === key
                                                        ? c.card
                                                        : 'transparent',
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color:
                                                        tab === key
                                                            ? c.accent
                                                            : c.muted,
                                                    fontWeight: '700',
                                                }}
                                            >
                                                {t(`tickets.tab_${key}`)}
                                            </Text>
                                        </TouchableOpacity>
                                    ),
                                )}
                            </View>
                            {event.status === 'cancelled' && (
                                <Text style={{ color: '#c83d53' }}>
                                    {t('tickets.eventCancelled')}
                                </Text>
                            )}
                            {!!error && (
                                <Text
                                    accessibilityRole="alert"
                                    style={{ color: '#c83d53' }}
                                >
                                    {error}
                                </Text>
                            )}
                            {readError && (
                                <CommunityMessage
                                    title={t('tickets.connectionError')}
                                    retry={() => void refresh()}
                                />
                            )}
                            {tab === 'overview' && (
                                <>
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            flexWrap: 'wrap',
                                            gap: 12,
                                        }}
                                    >
                                        {(
                                            [
                                                'accepted',
                                                'paid',
                                                'pending',
                                                'invited',
                                            ] as const
                                        ).map((key) => (
                                            <View
                                                key={key}
                                                style={{
                                                    width: '48%',
                                                    backgroundColor: c.card,
                                                    borderRadius: 20,
                                                    padding: 20,
                                                    gap: 8,
                                                }}
                                            >
                                                <Text
                                                    style={{ color: c.muted }}
                                                >
                                                    {t(`tickets.metric_${key}`)}
                                                </Text>
                                                <Text
                                                    style={{
                                                        color:
                                                            key === 'accepted'
                                                                ? c.accent
                                                                : c.fg,
                                                        fontSize: 32,
                                                        fontWeight: '800',
                                                    }}
                                                >
                                                    {stats ? stats[key] : '—'}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                    <CommunityButton
                                        label={t('tickets.scan')}
                                        onPress={() =>
                                            router.push({
                                                pathname: '/ticket-scanner',
                                                params: { sessionId },
                                            })
                                        }
                                        disabled={event.status === 'cancelled'}
                                    />
                                    <Text
                                        style={{
                                            color: c.muted,
                                            lineHeight: 20,
                                        }}
                                    >
                                        {t('tickets.onlineHint')}
                                    </Text>
                                    {stats?.by_type.some(
                                        (k) => k.is_guest_list,
                                    ) && (
                                        <>
                                            <Text style={{ color: c.muted }}>
                                                {t('guests.ticketCountHint')}
                                            </Text>
                                            <CommunityButton
                                                secondary
                                                label={t('guests.manage')}
                                                onPress={() =>
                                                    router.push({
                                                        pathname: '/guests',
                                                        params: { sessionId },
                                                    })
                                                }
                                            />
                                        </>
                                    )}
                                    {heading(t('tickets.types'))}
                                    {stats?.by_type.map((k) => (
                                        <View
                                            key={k.id}
                                            style={{
                                                backgroundColor: c.card,
                                                padding: 18,
                                                borderRadius: 18,
                                                gap: 6,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: c.fg,
                                                    fontWeight: '700',
                                                    fontSize: 16,
                                                }}
                                            >
                                                {k.is_guest_list
                                                    ? t('guests.title')
                                                    : k.name}{' '}
                                                · {money(k.price)}
                                            </Text>
                                            <Text style={{ color: c.muted }}>
                                                {t('tickets.typeSummary', {
                                                    accepted: k.accepted,
                                                    issued: k.issued,
                                                })}
                                            </Text>
                                        </View>
                                    ))}
                                    {!types.isPending &&
                                        !types.data?.length && (
                                            <CommunityMessage
                                                title={t('tickets.emptyTypes')}
                                                hint={t(
                                                    'tickets.emptyTypesHint',
                                                )}
                                            />
                                        )}
                                    <View
                                        style={{
                                            padding: 18,
                                            backgroundColor: c.tint,
                                            borderRadius: 18,
                                            gap: 8,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: c.fg,
                                                fontWeight: '700',
                                            }}
                                        >
                                            {t('tickets.revenue')} ·{' '}
                                            {stats ? money(stats.revenue) : '—'}
                                        </Text>
                                        <Text
                                            style={{
                                                color: c.muted,
                                                lineHeight: 20,
                                            }}
                                        >
                                            {t('tickets.revenueHint')}
                                        </Text>
                                        <Text style={{ color: c.muted }}>
                                            {t('tickets.cancelledCount', {
                                                count: stats?.cancelled || 0,
                                            })}
                                        </Text>
                                        {!!stats?.cancelled_paid_amount && (
                                            <Text
                                                style={{
                                                    color: c.muted,
                                                    lineHeight: 20,
                                                }}
                                            >
                                                {t('tickets.cancelledPaid', {
                                                    amount: money(
                                                        stats.cancelled_paid_amount,
                                                    ),
                                                })}
                                            </Text>
                                        )}
                                    </View>
                                </>
                            )}
                            {tab === 'issue' && (
                                <>
                                    {heading(t('tickets.chooseType'))}
                                    {event.fee_agreement?.version === 2 && (
                                        <CommunityButton
                                            secondary
                                            label={t('tickets.importTypes')}
                                            onPress={importAgreementTypes}
                                            disabled={
                                                busy ||
                                                types.isPending ||
                                                types.isError ||
                                                event.status === 'cancelled'
                                            }
                                        />
                                    )}
                                    {types.isPending && (
                                        <ActivityIndicator color={c.accent} />
                                    )}
                                    {types.data?.map((k) => (
                                        <TouchableOpacity
                                            key={k.id}
                                            disabled={busy}
                                            accessibilityRole="radio"
                                            accessibilityState={{
                                                checked: typeId === k.id,
                                            }}
                                            onPress={() => {
                                                setTypeId(k.id);
                                                batch.current = null;
                                            }}
                                            style={{
                                                padding: 18,
                                                borderRadius: 16,
                                                borderWidth: 1.5,
                                                borderColor:
                                                    typeId === k.id
                                                        ? c.accent
                                                        : c.border,
                                                backgroundColor:
                                                    typeId === k.id
                                                        ? c.tint
                                                        : c.card,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: c.fg,
                                                    fontWeight: '700',
                                                }}
                                            >
                                                {k.name} · {money(k.price)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                    <CommunityButton
                                        secondary
                                        label={t('tickets.addType')}
                                        onPress={() =>
                                            setAddingType(!addingType)
                                        }
                                        disabled={
                                            busy || event.status === 'cancelled'
                                        }
                                    />
                                    {addingType && (
                                        <View
                                            style={{
                                                gap: 12,
                                                paddingVertical: 12,
                                            }}
                                        >
                                            <Text style={{ color: c.fg }}>
                                                {t('tickets.typeName')}
                                            </Text>
                                            <TextInput
                                                accessibilityLabel={t(
                                                    'tickets.typeName',
                                                )}
                                                placeholder={t(
                                                    'tickets.typePlaceholder',
                                                )}
                                                placeholderTextColor={c.muted}
                                                maxLength={80}
                                                value={name}
                                                onChangeText={setName}
                                                style={field}
                                            />
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    gap: 8,
                                                }}
                                            >
                                                {[false, true].map((v) => (
                                                    <View
                                                        key={String(v)}
                                                        style={{ flex: 1 }}
                                                    >
                                                        <CommunityButton
                                                            label={t(
                                                                v
                                                                    ? 'tickets.invitation'
                                                                    : 'tickets.standard',
                                                            )}
                                                            secondary={
                                                                invitation !== v
                                                            }
                                                            onPress={() =>
                                                                setInvitation(v)
                                                            }
                                                            disabled={busy}
                                                        />
                                                    </View>
                                                ))}
                                            </View>
                                            {!invitation && (
                                                <>
                                                    <Text
                                                        style={{ color: c.fg }}
                                                    >
                                                        {t('tickets.price')} (
                                                        {event.currency})
                                                    </Text>
                                                    <TextInput
                                                        accessibilityLabel={t(
                                                            'tickets.price',
                                                        )}
                                                        keyboardType="decimal-pad"
                                                        placeholder="10"
                                                        placeholderTextColor={
                                                            c.muted
                                                        }
                                                        value={price}
                                                        onChangeText={setPrice}
                                                        style={field}
                                                    />
                                                </>
                                            )}
                                            <CommunityButton
                                                label={t('tickets.saveType')}
                                                onPress={addType}
                                                busy={busy}
                                            />
                                        </View>
                                    )}
                                    {kind && (
                                        <>
                                            <Text style={{ color: c.fg }}>
                                                {t('tickets.quantity')}
                                            </Text>
                                            <TextInput
                                                accessibilityLabel={t(
                                                    'tickets.quantity',
                                                )}
                                                value={quantity}
                                                onChangeText={setQuantity}
                                                keyboardType="number-pad"
                                                maxLength={3}
                                                style={field}
                                            />
                                            <Text style={{ color: c.muted }}>
                                                {t('tickets.quantityHint')}
                                            </Text>
                                            {!kind.is_invitation && (
                                                <View
                                                    style={{
                                                        flexDirection: 'row',
                                                        gap: 8,
                                                    }}
                                                >
                                                    {(
                                                        [
                                                            'paid',
                                                            'pending',
                                                        ] as const
                                                    ).map((v) => (
                                                        <View
                                                            key={v}
                                                            style={{ flex: 1 }}
                                                        >
                                                            <CommunityButton
                                                                label={t(
                                                                    `tickets.${v}`,
                                                                )}
                                                                secondary={
                                                                    payment !==
                                                                    v
                                                                }
                                                                onPress={() =>
                                                                    setPayment(
                                                                        v,
                                                                    )
                                                                }
                                                                disabled={busy}
                                                            />
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                            <CommunityButton
                                                label={t('tickets.issue')}
                                                onPress={issue}
                                                busy={busy}
                                                disabled={
                                                    event.status === 'cancelled'
                                                }
                                            />
                                            <Text
                                                style={{
                                                    color: c.muted,
                                                    lineHeight: 20,
                                                }}
                                            >
                                                {t('tickets.issueHint')}
                                            </Text>
                                        </>
                                    )}
                                </>
                            )}
                            {tab === 'list' && (
                                <>
                                    {list.isPending && (
                                        <ActivityIndicator color={c.accent} />
                                    )}
                                    {list.data?.pages.flat().map((ticket) => {
                                        const k = types.data?.find(
                                            (v) => v.id === ticket.type_id,
                                        );
                                        return (
                                            <TouchableOpacity
                                                key={ticket.id}
                                                accessibilityRole="button"
                                                onPress={() => setPass(ticket)}
                                                style={{
                                                    padding: 18,
                                                    backgroundColor: c.card,
                                                    borderRadius: 18,
                                                    gap: 6,
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        flexDirection: 'row',
                                                        justifyContent:
                                                            'space-between',
                                                        gap: 10,
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            color: c.fg,
                                                            flex: 1,
                                                            fontWeight: '700',
                                                        }}
                                                    >
                                                        {k?.name ||
                                                            t('tickets.ticket')}
                                                    </Text>
                                                    <Text
                                                        style={{
                                                            color: c.accent,
                                                        }}
                                                    >
                                                        {t(
                                                            `tickets.${ticket.state === 'issued' ? ticket.payment_status : ticket.state}`,
                                                        )}
                                                    </Text>
                                                </View>
                                                <Text
                                                    style={{ color: c.muted }}
                                                >
                                                    #
                                                    {ticket.id
                                                        .slice(0, 8)
                                                        .toUpperCase()}{' '}
                                                    ·{' '}
                                                    {new Date(
                                                        ticket.created_at,
                                                    ).toLocaleDateString(
                                                        currentLanguage,
                                                    )}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                    {!list.isPending &&
                                        !list.isError &&
                                        !list.data?.pages[0]?.length && (
                                            <CommunityMessage
                                                title={t(
                                                    'tickets.emptyTickets',
                                                )}
                                                hint={t(
                                                    'tickets.emptyTicketsHint',
                                                )}
                                            />
                                        )}
                                    {list.hasNextPage && (
                                        <CommunityButton
                                            secondary
                                            label={t('tickets.loadMore')}
                                            onPress={() =>
                                                void list.fetchNextPage()
                                            }
                                            busy={list.isFetchingNextPage}
                                        />
                                    )}
                                </>
                            )}
                            <CommunityButton
                                outlined
                                label={t('tickets.changeSession')}
                                onPress={() => {
                                    setSessionId('');
                                    setError('');
                                    setTypeId('');
                                }}
                                disabled={busy}
                            />
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
            {event &&
                pass &&
                types.data?.find((k) => k.id === pass.type_id) && (
                    <TicketPassSheet
                        key={pass.id}
                        ticket={pass}
                        session={event}
                        kind={types.data.find((k) => k.id === pass.type_id)!}
                        onClose={() => setPass(null)}
                        onChange={async (action) => {
                            const changed = await ticketService.change(
                                sessionId,
                                pass.id,
                                action,
                            );
                            setPass(changed);
                            await refresh();
                        }}
                    />
                )}
        </SafeAreaView>
    );
}
