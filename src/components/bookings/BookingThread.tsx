import { useState } from 'react';
import { View, Switch, Alert, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../i18n/useTranslation';
import {
    bookingCall,
    BookingThread as Thread,
    BookingStatus,
} from '../../services/bookings';
import {
    currentProposal,
    canAcceptProposal,
    bookingAmount,
    validBookingSchedule,
} from '../../utils/bookingWorkflow';
import {
    BookingPage,
    BookingCard,
    BookingText,
    BookingField,
    BookingError,
    BookingDate,
    BookingCurrency,
} from './BookingUI';
import { CommunityButton } from '../community/CommunityUI';
export function BookingThreadScreen({
    id,
    guest = false,
    access = '',
    ownerId,
}: {
    id: string;
    guest?: boolean;
    access?: string;
    ownerId?: string;
}) {
    const { t, currentLanguage } = useTranslation();
    const router = useRouter();
    const cache = useQueryClient();
    const [body, setBody] = useState('');
    const [compose, setCompose] = useState(false);
    const [acceptReview, setAcceptReview] = useState(false);
    const [proposal, setProposal] = useState({
        event_title: '',
        venue: '',
        city: '',
        date: '',
        start_time: '22:00',
        end_time: '04:00',
        fee: '',
        currency: 'EUR',
        terms: '',
        expires_hours: '48',
        hold: false,
    });
    const queryKey = ['booking-thread', guest ? 'guest' : ownerId, id];
    const q = useQuery({
        queryKey,
        queryFn: () =>
            bookingCall<Thread>(guest ? 'verify' : 'owner_read', {
                id,
                ...(guest ? { access } : {}),
            }),
        enabled: !!id && (!guest || !!access),
        retry: false,
        refetchInterval: 15000,
    });
    const status = useQuery({
        queryKey: ['booking-status', ownerId],
        queryFn: () => bookingCall<BookingStatus>('owner_status'),
        enabled: !guest,
        retry: false,
    });
    const mutation = useMutation({
        mutationFn: ({
            action,
            extra = {},
        }: {
            action: string;
            extra?: Record<string, unknown>;
        }) =>
            bookingCall<Thread>(guest ? action : `owner_${action}`, {
                id,
                ...(guest ? { access } : {}),
                ...extra,
            }),
        onSuccess: async (data) => {
            cache.setQueryData(queryKey, data);
            setBody('');
            setCompose(false);
            setAcceptReview(false);
            await cache.invalidateQueries({ queryKey: ['bookings'] });
            await cache.invalidateQueries({ queryKey: ['notifications'] });

            await cache.invalidateQueries({ queryKey: ['sessions'] });
        },
    });
    const thread = q.isError ? undefined : q.data;
    const p = thread ? currentProposal(thread) : undefined;
    const active = thread ? canAcceptProposal(thread) : false;
    const send = (action: string, extra?: Record<string, unknown>) =>
        mutation.mutate({ action, extra });
    const decline = () => {
        if (Platform.OS === 'web') {
            if (window.confirm(t('bookings.declineConfirm'))) send('decline');
        } else
            Alert.alert(t('bookings.decline'), t('bookings.declineConfirm'), [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('bookings.decline'),
                    style: 'destructive',
                    onPress: () => send('decline'),
                },
            ]);
    };
    const begin = () => {
        if (!thread) return;
        const r = thread.request;
        setProposal({
            event_title: p?.event_title || r.event_title,
            venue: p?.venue || r.venue,
            city: p?.city || r.city,
            date: p?.date || r.date,
            start_time: p?.start_time || r.start_time,
            end_time: p?.end_time || r.end_time,
            fee: String(p?.fee ?? r.budget),
            currency: p?.currency || r.currency,
            terms: p?.terms || status.data?.settings?.default_terms || '',
            expires_hours: '48',
            hold: false,
        });
        setCompose(true);
    };
    const field = (
        key: keyof typeof proposal,
        label: string,
        multiline = false,
        number = false,
    ) => (
        <BookingField
            label={t(`bookings.${label}`)}
            value={String(proposal[key])}
            onChange={(v) => setProposal({ ...proposal, [key]: v })}
            multiline={multiline}
            number={number}
        />
    );
    const dateLabel = (date: string) =>
        new Date(date + 'T12:00:00').toLocaleDateString(currentLanguage, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    const closed =
        !!thread &&
        ['accepted', 'declined', 'closed'].includes(thread.request.state);
    return (
        <BookingPage
            guest={guest}
            title={thread?.request.event_title || t('bookings.conversation')}
            subtitle={
                guest ? t('bookings.privateConversation') : t('bookings.intro')
            }
        >
            {q.isPending && (
                <BookingText muted>{t('community.loading')}</BookingText>
            )}
            {q.isError && (
                <>
                    <BookingError error={q.error} />
                    <CommunityButton
                        secondary
                        label={t('insights.retry')}
                        onPress={() => void q.refetch()}
                    />
                </>
            )}
            {thread && (
                <>
                    <BookingCard>
                        <BookingText muted>
                            {t(`bookings.states.${thread.request.state}`)}
                        </BookingText>
                        <BookingText large>
                            {thread.request.promoter_name}
                        </BookingText>
                        <BookingText>
                            {dateLabel(thread.request.date)} ·{' '}
                            {thread.request.start_time} –{' '}
                            {thread.request.end_time}
                        </BookingText>
                        <BookingText muted>
                            {thread.request.venue} · {thread.request.city} ·{' '}
                            {thread.request.timezone}
                        </BookingText>
                        <BookingText muted>
                            {t('bookings.budget')}:{' '}
                            {Number(thread.request.budget).toLocaleString(
                                currentLanguage,
                                {
                                    style: 'currency',
                                    currency: thread.request.currency,
                                },
                            )}
                        </BookingText>
                    </BookingCard>
                    {p && (
                        <BookingCard>
                            <BookingText large>
                                {t('bookings.proposalVersion', {
                                    version: p.version,
                                })}
                            </BookingText>
                            <BookingText>{p.event_title}</BookingText>
                            <BookingText>
                                {dateLabel(p.date)} · {p.start_time} –{' '}
                                {p.end_time} · {p.timezone}
                            </BookingText>
                            <BookingText muted>
                                {p.venue} · {p.city}
                            </BookingText>
                            <BookingText large>
                                {Number(p.fee).toLocaleString(currentLanguage, {
                                    style: 'currency',
                                    currency: p.currency,
                                })}
                            </BookingText>
                            <BookingText>
                                {p.terms || t('bookings.noExtraTerms')}
                            </BookingText>
                            <BookingText muted>
                                {t('bookings.expires')}:{' '}
                                {new Date(p.expires_at).toLocaleString(
                                    currentLanguage,
                                )}
                            </BookingText>
                            {p.hold_until && active && (
                                <BookingText muted>
                                    {t('bookings.holdActive')}
                                </BookingText>
                            )}
                            {!active && !closed && (
                                <BookingText muted>
                                    {t('bookings.proposalInactive')}
                                </BookingText>
                            )}
                            {!guest && active && p.hold_until && (
                                <CommunityButton
                                    secondary
                                    label={t('bookings.releaseHold')}
                                    disabled={mutation.isPending}
                                    onPress={() =>
                                        send('release_hold', {
                                            body: t('bookings.holdReleased'),
                                        })
                                    }
                                />
                            )}
                            {guest && active && (
                                <>
                                    {acceptReview ? (
                                        <>
                                            <BookingText>
                                                {t('bookings.acceptConfirm')}
                                            </BookingText>
                                            <CommunityButton
                                                label={t(
                                                    'bookings.confirmAcceptance',
                                                )}
                                                busy={mutation.isPending}
                                                onPress={() =>
                                                    send('accept', {
                                                        proposal_id: p.id,
                                                    })
                                                }
                                            />
                                            <CommunityButton
                                                secondary
                                                label={t('cancel')}
                                                onPress={() =>
                                                    setAcceptReview(false)
                                                }
                                                disabled={mutation.isPending}
                                            />
                                        </>
                                    ) : (
                                        <CommunityButton
                                            label={t('bookings.reviewAccept')}
                                            disabled={mutation.isPending}
                                            onPress={() =>
                                                setAcceptReview(true)
                                            }
                                        />
                                    )}
                                </>
                            )}
                            {thread.proposals.length > 1 &&
                                thread.proposals
                                    .filter((old) => old.id !== p.id)
                                    .map((old) => (
                                        <BookingCard key={old.id}>
                                            <BookingText muted>
                                                {t(
                                                    'bookings.previousProposal',
                                                    { version: old.version },
                                                )}
                                            </BookingText>
                                            <BookingText>
                                                {dateLabel(old.date)} ·{' '}
                                                {old.start_time} –{' '}
                                                {old.end_time} ·{' '}
                                                {Number(old.fee).toLocaleString(
                                                    currentLanguage,
                                                    {
                                                        style: 'currency',
                                                        currency: old.currency,
                                                    },
                                                )}
                                            </BookingText>
                                            <BookingText muted>
                                                {old.venue} · {old.city}
                                            </BookingText>
                                            <BookingText>
                                                {old.terms}
                                            </BookingText>
                                        </BookingCard>
                                    ))}
                        </BookingCard>
                    )}
                    {thread.request.state === 'accepted' && (
                        <BookingCard>
                            <BookingText large>
                                {t('bookings.agreementConfirmed')}
                            </BookingText>
                            <BookingText muted>
                                {t('bookings.agreementHint')}
                            </BookingText>
                            {!guest && thread.request.session_id && (
                                <CommunityButton
                                    label={t('notifications.viewSession')}
                                    onPress={() =>
                                        router.push(
                                            `/session/${thread.request.session_id}`,
                                        )
                                    }
                                />
                            )}
                        </BookingCard>
                    )}
                    <BookingText large>
                        {t('bookings.conversation')}
                    </BookingText>
                    {!thread.messages.length && (
                        <BookingText muted>
                            {t('bookings.noMessages')}
                        </BookingText>
                    )}
                    {thread.messages.map((m) => (
                        <BookingCard key={m.id}>
                            <BookingText muted>
                                {t(
                                    m.sender === 'dj'
                                        ? 'bookings.dj'
                                        : 'bookings.promoter',
                                )}{' '}
                                ·{' '}
                                {new Date(m.created_at).toLocaleString(
                                    currentLanguage,
                                )}
                            </BookingText>
                            <BookingText>{m.body}</BookingText>
                        </BookingCard>
                    ))}
                    {!['declined', 'closed'].includes(thread.request.state) && (
                        <BookingCard>
                            <BookingField
                                multiline
                                label={t('bookings.message')}
                                value={body}
                                onChange={setBody}
                            />
                            <CommunityButton
                                label={t('bookings.sendMessage')}
                                busy={mutation.isPending}
                                disabled={!body.trim()}
                                onPress={() => send('message', { body })}
                            />

                            {guest && active && (
                                <CommunityButton
                                    secondary
                                    label={t('bookings.requestChanges')}
                                    disabled={
                                        !body.trim() || mutation.isPending
                                    }
                                    onPress={() => send('changes', { body })}
                                />
                            )}
                        </BookingCard>
                    )}
                    {!guest && !closed && !compose && (
                        <CommunityButton
                            label={t('bookings.makeProposal')}
                            disabled={mutation.isPending || status.isPending}
                            onPress={() =>
                                status.data?.isPro
                                    ? begin()
                                    : router.push('/paywall?reason=bookings')
                            }
                        />
                    )}
                    {compose && (
                        <BookingCard>
                            <BookingText large>
                                {t('bookings.makeProposal')}
                            </BookingText>
                            {field('event_title', 'event')}
                            {field('venue', 'venue')}
                            {field('city', 'city')}
                            <BookingDate
                                value={proposal.date}
                                onChange={(date) =>
                                    setProposal({ ...proposal, date })
                                }
                            />
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                    {field('start_time', 'start')}
                                </View>
                                <View style={{ flex: 1 }}>
                                    {field('end_time', 'end')}
                                </View>
                            </View>
                            {field('fee', 'fee', false, true)}
                            <BookingCurrency
                                value={proposal.currency}
                                onChange={(currency) =>
                                    setProposal({ ...proposal, currency })
                                }
                            />
                            {field('terms', 'terms', true)}
                            {field(
                                'expires_hours',
                                'deadlineHours',
                                false,
                                true,
                            )}
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 12,
                                }}
                            >
                                <View style={{ flex: 1 }}>
                                    <BookingText>
                                        {t('bookings.holdDate')}
                                    </BookingText>
                                    <BookingText muted>
                                        {t('bookings.holdHint')}
                                    </BookingText>
                                </View>
                                <Switch
                                    accessibilityLabel={t('bookings.holdDate')}
                                    value={proposal.hold}
                                    onValueChange={(hold) =>
                                        setProposal({ ...proposal, hold })
                                    }
                                />
                            </View>
                            <CommunityButton
                                label={t('bookings.sendProposal')}
                                busy={mutation.isPending}
                                disabled={
                                    !validBookingSchedule(proposal) ||
                                    bookingAmount(proposal.fee) === null ||
                                    !proposal.event_title.trim() ||
                                    !proposal.venue.trim() ||
                                    !proposal.city.trim() ||
                                    !/^\d+$/.test(proposal.expires_hours) ||
                                    Number(proposal.expires_hours) < 1 ||
                                    Number(proposal.expires_hours) > 168
                                }
                                onPress={() =>
                                    send('propose', {
                                        ...proposal,
                                        fee: bookingAmount(proposal.fee),
                                        expires_hours: Number(
                                            proposal.expires_hours,
                                        ),
                                    })
                                }
                            />
                            <CommunityButton
                                secondary
                                label={t('cancel')}
                                disabled={mutation.isPending}
                                onPress={() => setCompose(false)}
                            />
                        </BookingCard>
                    )}
                    {!closed && (
                        <CommunityButton
                            secondary
                            label={t('bookings.decline')}
                            disabled={mutation.isPending}
                            onPress={decline}
                        />
                    )}
                    {mutation.isError && (
                        <BookingError error={mutation.error} />
                    )}
                </>
            )}
        </BookingPage>
    );
}
