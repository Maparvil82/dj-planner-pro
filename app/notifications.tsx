import { useScrollHeader } from '../src/hooks/useScrollHeader';
import { FEATURES } from '../src/config/features';
import { sessionDisplayTitle } from '../src/utils/sessionNaming';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';
import {
    useSessionInvitations,
    useInvitationReply,
} from '../src/hooks/useCollaborations';
import {
    useNotifications,
    useMarkNotificationsRead,
} from '../src/hooks/useNotifications';
import { SessionFormHeader } from '../src/components/sessions/SessionFormLayout';
import {
    CommunityButton,
    CommunityMessage,
    CommunitySessionCard,
    useCommunityColors,
} from '../src/components/community/CommunityUI';
import { useTranslation } from '../src/i18n/useTranslation';
export default function NotificationsScreen() {
    const { progress: headerProgress, onScroll: onHeaderScroll, onScrollBeginDrag: onHeaderScrollBeginDrag } = useScrollHeader('compact');
    const c = useCommunityColors();
    const { t, currentLanguage, dateLocale } = useTranslation();
    const router = useRouter();
    const userId = useAuthStore((state) => state.session?.user.id);
    const inbox = useSessionInvitations();
    const reply = useInvitationReply();
    const notifications = useNotifications();
    const markRead = useMarkNotificationsRead();
    if (!userId) return <Redirect href="/(auth)/login" />;
    const rows = (notifications.data?.pages.flat() || []).filter(
        (item) => FEATURES.bookings || !item.kind.startsWith('booking_'),
    );
    const refresh = () => {
        void notifications.refetch();
        void inbox.refetch();
    };
    return (
        <SafeAreaView
            edges={['top', 'bottom']}
            style={{ flex: 1, backgroundColor: c.bg }}
        >
            <SessionFormHeader progress={headerProgress}
                title={t('notifications.title')}
                subtitle={t('notifications.intro')}
                onClose={() =>
                    router.canGoBack()
                        ? router.back()
                        : router.replace('/(tabs)/home')
                }
            />
            <FlatList scrollEventThrottle={16} onScrollBeginDrag={onHeaderScrollBeginDrag} onTouchStart={onHeaderScrollBeginDrag} onScroll={onHeaderScroll}
                data={rows}
                keyExtractor={(item) => item.id}
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                windowSize={5}
                renderItem={({ item }) => {
                    const invitation = inbox.data?.find(
                        (invitation) =>
                            invitation.session_id === item.session_id,
                    );
                    const waiting =
                        ['session_invitation', 'session_update'].includes(
                            item.kind,
                        ) && invitation?.status === 'invited';
                    return (
                        <View
                            key={item.id}
                            style={{
                                backgroundColor: c.card,
                                borderWidth: c.dark ? 0 : 1,
                                borderColor: !item.read_at
                                    ? c.accent
                                    : c.border,
                                borderRadius: 24,
                                padding: 18,
                                gap: 12,
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    gap: 10,
                                    alignItems: 'center',
                                }}
                            >
                                <Text
                                    style={[{
                                        color: c.fg,
                                        fontWeight: '700',
                                        fontSize: 15,
                                        lineHeight: 21,
                                        flex: 1,
                                    }, c.dark && { color: c.cardText }]}
                                >
                                    {t(
                                        `notifications.${item.kind}${item.kind === 'invitation_response' ? '_' + item.response : ''}`,
                                        {
                                            name: item.actor_name,
                                            title: sessionDisplayTitle(
                                                invitation?.session || {
                                                    title: item.session_title,
                                                },
                                                t,
                                            ),
                                        },
                                    )}
                                </Text>
                                {!item.read_at && (
                                    <View
                                        accessibilityLabel={t(
                                            'notifications.unread',
                                        )}
                                        style={{
                                            width: 7,
                                            height: 7,
                                            borderRadius: 4,
                                            backgroundColor: c.accent,
                                        }}
                                    />
                                )}
                            </View>
                            <Text style={[{ color: c.muted, fontSize: 11 }, c.dark && { color: c.cardText }]}>
                                {new Date(item.created_at).toLocaleDateString(
                                    dateLocale,
                                    {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    },
                                )}
                            </Text>
                            {item.booking_id ? (
                                <CommunityButton
                                    label={t('bookings.openConversation')}
                                    secondary
                                    onPress={() => {
                                        markRead.mutate(item.id);
                                        router.push(
                                            `/bookings/${item.booking_id}`,
                                        );
                                    }}
                                />
                            ) : waiting && invitation ? (
                                <>
                                    <CommunitySessionCard
                                        showAuthor={false}
                                        item={{
                                            session_id: invitation.session_id,
                                            author_id: invitation.inviter_id,
                                            artist_name: invitation.owner_name,
                                            avatar_url: null,
                                            title: invitation.session.title,
                                            venue: invitation.session.venue,
                                            city: '',
                                            date: invitation.session.date,
                                            start_time:
                                                invitation.session.start_time,
                                            end_time:
                                                invitation.session.end_time,
                                            poster_focus_x:
                                                invitation.session
                                                    .poster_focus_x,
                                            poster_focus_y:
                                                invitation.session
                                                    .poster_focus_y,
                                            poster_url:
                                                invitation.session.poster_url ||
                                                null,
                                            shared_at: invitation.created_at,
                                        }}
                                    />
                                    <Text
                                        style={[{
                                            color: c.muted,
                                            fontSize: 12,
                                            lineHeight: 18,
                                        }, c.dark && { color: c.cardText }]}
                                    >
                                        {t('collaboration.consent')}
                                    </Text>
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            gap: 10,
                                        }}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <CommunityButton
                                                label={t(
                                                    'collaboration.decline',
                                                )}
                                                secondary
                                                disabled={
                                                    reply.isPending ||
                                                    markRead.isPending
                                                }
                                                onPress={() =>
                                                    reply.mutate(
                                                        {
                                                            sessionId:
                                                                invitation.session_id,
                                                            status: 'declined',
                                                        },
                                                        {
                                                            onSuccess: () =>
                                                                markRead.mutate(
                                                                    item.id,
                                                                ),
                                                        },
                                                    )
                                                }
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <CommunityButton
                                                label={t(
                                                    'collaboration.accept',
                                                )}
                                                busy={
                                                    reply.isPending &&
                                                    reply.variables
                                                        ?.sessionId ===
                                                        invitation.session_id
                                                }
                                                disabled={
                                                    reply.isPending ||
                                                    markRead.isPending ||
                                                    invitation.session
                                                        .status === 'cancelled'
                                                }
                                                onPress={() =>
                                                    reply.mutate(
                                                        {
                                                            sessionId:
                                                                invitation.session_id,
                                                            status: 'accepted',
                                                        },
                                                        {
                                                            onSuccess: () =>
                                                                markRead.mutate(
                                                                    item.id,
                                                                ),
                                                        },
                                                    )
                                                }
                                            />
                                        </View>
                                    </View>
                                </>
                            ) : [
                                  'follow',
                                  'shared_session',
                                  'invitation_response',
                              ].includes(item.kind) ||
                              invitation?.status === 'accepted' ? (
                                <CommunityButton
                                    label={t(
                                        item.kind === 'follow' ||
                                            item.kind === 'shared_session'
                                            ? 'community.viewProfile'
                                            : 'notifications.viewSession',
                                    )}
                                    secondary
                                    disabled={
                                        inbox.isPending &&
                                        [
                                            'session_invitation',
                                            'session_update',
                                        ].includes(item.kind)
                                    }
                                    onPress={() => {
                                        markRead.mutate(item.id);
                                        if (
                                            item.kind === 'follow' ||
                                            item.kind === 'shared_session'
                                        )
                                            router.push(
                                                `/community/${item.actor_id}`,
                                            );
                                        else if (
                                            item.session_id &&
                                            (item.kind ===
                                                'invitation_response' ||
                                                invitation?.status ===
                                                    'accepted')
                                        )
                                            router.push(
                                                `/session/${item.session_id}`,
                                            );
                                        else refresh();
                                    }}
                                />
                            ) : !item.read_at ? (
                                <CommunityButton
                                    label={t('notifications.markRead')}
                                    secondary
                                    busy={markRead.isPending}
                                    onPress={() => markRead.mutate(item.id)}
                                />
                            ) : null}
                            {!waiting && invitation?.status === 'declined' && (
                                <Text
                                    style={[{
                                        color: c.muted,
                                        fontSize: 12,
                                    }, c.dark && { color: c.cardText }]}
                                >
                                    {t('collaboration.declined')}
                                </Text>
                            )}
                        </View>
                    );
                }}

                ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
                ListFooterComponent={
                    <View style={{ marginTop: 16 }}>
                        {notifications.hasNextPage && (
                            <CommunityButton
                                label={t('community.loadMore')}
                                secondary
                                busy={notifications.isFetchingNextPage}
                                onPress={() => {
                                    void notifications.fetchNextPage();
                                }}
                            />
                        )}
                    </View>
                }
                ListHeaderComponent={
                    <View
                        style={{
                            width: '100%',
                            maxWidth: 900,
                            alignSelf: 'center',
                            gap: 16,
                        }}
                    >
                        {(notifications.isError ||
                            markRead.isError ||
                            inbox.isError ||
                            reply.isError) && (
                            <CommunityMessage
                                title={t('notifications.error')}
                                retry={() => {
                                    reply.reset();
                                    markRead.reset();
                                    refresh();
                                }}
                            />
                        )}
                        {!!rows.length && (
                            <CommunityButton
                                label={t('notifications.markAll')}
                                secondary
                                busy={markRead.isPending}
                                onPress={() => markRead.mutate(undefined)}
                            />
                        )}
                        {notifications.isPending ? (
                            <CommunityMessage
                                title={t('community.loading')}
                                loading
                            />
                        ) : !rows.length ? (
                            <CommunityMessage
                                title={t('notifications.empty')}
                                hint={t('notifications.emptyHint')}
                            />
                        ) : null}
                    </View>
                }
                refreshControl={
                    <RefreshControl
                        refreshing={
                            notifications.isRefetching || inbox.isRefetching
                        }
                        onRefresh={refresh}
                        tintColor={c.accent}
                    />
                }
                style={{ width: '100%', maxWidth: 940, alignSelf: 'center' }}
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingBottom: 30,
                }}
            />
        </SafeAreaView>
    );
}
