import { FEATURES } from '../../src/config/features';
import { useState } from 'react';
import { View, Switch, Platform, Share } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTranslation } from '../../src/i18n/useTranslation';
import {
    bookingCall,
    listBookings,
    BookingStatus,
    BookingSettings,
} from '../../src/services/bookings';
import {
    BookingPage,
    BookingCard,
    BookingText,
    BookingField,
    BookingError,
} from '../../src/components/bookings/BookingUI';
import {
    CommunityButton,
    useCommunityColors,
} from '../../src/components/community/CommunityUI';
export default function BookingsScreen() {
    return FEATURES.bookings ? (
        <BookingsScreenContent />
    ) : (
        <Redirect href="/(tabs)/home" />
    );
}

function BookingsScreenContent() {
    const { t, currentLanguage } = useTranslation();
    const router = useRouter();
    const c = useCommunityColors();
    const client = useQueryClient();
    const user = useAuthStore((s) => s.user);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<BookingSettings>({
        slug: '',
        enabled: false,
        timezone:
            Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid',
        default_terms: '',
    });
    const status = useQuery({
        queryKey: ['booking-status', user?.id],
        queryFn: () => bookingCall<BookingStatus>('owner_status'),
        enabled: !!user,
        retry: false,
    });
    const requests = useInfiniteQuery({
        queryKey: ['bookings', user?.id],
        initialPageParam: 0,
        queryFn: ({ pageParam }) => listBookings(user!.id, pageParam),
        enabled: !!user && !!status.data,
        getNextPageParam: (last, pages) =>
            last.length === 20 ? pages.length * 20 : undefined,
        retry: false,
        refetchInterval: 30000,
    });
    const save = useMutation({
        mutationFn: () => bookingCall('owner_settings', { ...draft }),
        onSuccess: async () => {
            setEditing(false);
            await client.invalidateQueries({ queryKey: ['booking-status'] });
        },
    });
    const [shareError, setShareError] = useState<Error | null>(null);
    if (!user) return <Redirect href="/(auth)/login" />;
    const data = status.data;
    const rows = requests.data?.pages.flat() || [];
    const link =
        data?.webOrigin && data.settings
            ? `${data.webOrigin}/book/${data.settings.slug}`
            : null;
    const share = async () => {
        if (!link) return;
        try {
            if (Platform.OS === 'web')
                await navigator.clipboard.writeText(link);
            else await Share.share({ message: link });
        } catch {
            setShareError(new Error('bookings.errors.share_failed'));
        }
    };
    return (
        <BookingPage title={t('bookings.title')} subtitle={t('bookings.intro')}>
            <BookingCard>
                <BookingText large>{t('bookings.hero')}</BookingText>
                <BookingText muted>{t('bookings.heroHint')}</BookingText>
                <CommunityButton
                    label={t('bookings.preview')}
                    secondary
                    onPress={() => router.push('/book/preview?preview=1')}
                />
                {data?.serviceReady && !data.isPro && (
                    <CommunityButton
                        label={t('bookings.unlock')}
                        onPress={() => router.push('/paywall?reason=bookings')}
                    />
                )}
            </BookingCard>
            {status.isPending ? (
                <BookingText muted>{t('community.loading')}</BookingText>
            ) : status.isError ? (
                <>
                    <BookingCard>
                        <BookingText large>
                            {t('bookings.setupPending')}
                        </BookingText>
                        <BookingText muted>
                            {t('bookings.setupPendingHint')}
                        </BookingText>
                    </BookingCard>
                    <CommunityButton
                        secondary
                        label={t('insights.retry')}
                        onPress={() => void status.refetch()}
                    />
                </>
            ) : null}
            {data && !data.serviceReady && (
                <BookingCard>
                    <BookingText large>
                        {t('bookings.setupPending')}
                    </BookingText>
                    <BookingText muted>
                        {t('bookings.setupPendingHint')}
                    </BookingText>
                </BookingCard>
            )}
            {data && (
                <BookingCard>
                    <BookingText large>{t('bookings.yourLink')}</BookingText>
                    {data.settings && (
                        <BookingText muted>
                            {data.settings.enabled && link
                                ? link
                                : t('bookings.linkOff')}
                        </BookingText>
                    )}
                    {!editing ? (
                        <>
                            <CommunityButton
                                label={t(
                                    data.settings
                                        ? 'bookings.editSettings'
                                        : 'bookings.configure',
                                )}
                                secondary
                                onPress={() => {
                                    setDraft(data.settings || draft);
                                    setEditing(true);
                                }}
                            />
                            {data.settings?.enabled && link && (
                                <CommunityButton
                                    label={t('bookings.shareLink')}
                                    onPress={() => void share()}
                                />
                            )}
                        </>
                    ) : (
                        <>
                            <BookingField
                                label={t('bookings.slug')}
                                value={draft.slug}
                                maxLength={40}
                                placeholder="dj-manuel"
                                onChange={(slug) =>
                                    setDraft({
                                        ...draft,
                                        slug: slug
                                            .toLowerCase()
                                            .replace(/[^a-z0-9-]/g, ''),
                                    })
                                }
                            />
                            <BookingField
                                label={t('bookings.timezone')}
                                value={draft.timezone}
                                maxLength={80}
                                placeholder="Europe/Madrid"
                                onChange={(timezone) =>
                                    setDraft({ ...draft, timezone })
                                }
                            />
                            <BookingField
                                label={t('bookings.defaultTerms')}
                                value={draft.default_terms}
                                onChange={(default_terms) =>
                                    setDraft({ ...draft, default_terms })
                                }
                                multiline
                            />
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 10,
                                }}
                            >
                                <View style={{ flex: 1 }}>
                                    <BookingText>
                                        {t('bookings.enableLink')}
                                    </BookingText>
                                </View>
                                <Switch
                                    accessibilityLabel={t(
                                        'bookings.enableLink',
                                    )}
                                    value={draft.enabled}
                                    disabled={
                                        !data.serviceReady ||
                                        !data.isPro ||
                                        !data.profile?.is_visible
                                    }
                                    onValueChange={(enabled) =>
                                        setDraft({ ...draft, enabled })
                                    }
                                />
                            </View>
                            {!data.profile?.is_visible && (
                                <BookingText muted>
                                    {t('bookings.publicProfileHint')}
                                </BookingText>
                            )}
                            {save.isError && (
                                <BookingError error={save.error} />
                            )}
                            <CommunityButton
                                label={t('save_changes')}
                                disabled={
                                    !/^[a-z0-9][a-z0-9-]{2,39}$/.test(
                                        draft.slug,
                                    )
                                }
                                busy={save.isPending}
                                onPress={() => save.mutate()}
                            />
                            <CommunityButton
                                label={t('cancel')}
                                secondary
                                disabled={save.isPending}
                                onPress={() => setEditing(false)}
                            />
                        </>
                    )}
                    {shareError && <BookingError error={shareError} />}
                </BookingCard>
            )}
            {data && (
                <>
                    <BookingText large>{t('bookings.inbox')}</BookingText>
                    {requests.isError ? (
                        <BookingError error={requests.error} />
                    ) : requests.isPending ? (
                        <BookingText muted>
                            {t('community.loading')}
                        </BookingText>
                    ) : !rows.length ? (
                        <BookingCard>
                            <BookingText>{t('bookings.empty')}</BookingText>
                            <BookingText muted>
                                {t('bookings.emptyHint')}
                            </BookingText>
                        </BookingCard>
                    ) : (
                        rows.map((r) => (
                            <BookingCard key={r.id}>
                                <BookingText muted>
                                    {t(`bookings.states.${r.state}`)} ·{' '}
                                    {new Date(
                                        r.date + 'T12:00:00',
                                    ).toLocaleDateString(currentLanguage)}
                                </BookingText>
                                <BookingText large>{r.event_title}</BookingText>
                                <BookingText>
                                    {r.promoter_name} · {r.venue} · {r.city}
                                </BookingText>
                                <BookingText muted>
                                    {r.start_time} – {r.end_time} ·{' '}
                                    {Number(r.budget).toLocaleString(
                                        currentLanguage,
                                        {
                                            style: 'currency',
                                            currency: r.currency,
                                        },
                                    )}
                                </BookingText>
                                <CommunityButton
                                    secondary
                                    label={t('bookings.openConversation')}
                                    onPress={() =>
                                        router.push(`/bookings/${r.id}`)
                                    }
                                />
                            </BookingCard>
                        ))
                    )}
                    {requests.hasNextPage && (
                        <CommunityButton
                            secondary
                            label={t('bookings.loadMore')}
                            busy={requests.isFetchingNextPage}
                            onPress={() => void requests.fetchNextPage()}
                        />
                    )}
                </>
            )}
        </BookingPage>
    );
}
