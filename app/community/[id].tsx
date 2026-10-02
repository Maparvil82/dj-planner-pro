import { useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Redirect,
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTranslation } from '../../src/i18n/useTranslation';
import { Avatar } from '../../src/components/ui/Avatar';
import { SessionFormHeader } from '../../src/components/sessions/SessionFormLayout';
import {
    CommunityButton,
    CommunityMessage,
    CommunitySessionCard,
    useCommunityColors,
} from '../../src/components/community/CommunityUI';
import {
    useCommunityFeed,
    useCommunityFollowing,
    useCommunityMutation,
    useCommunityProfile,
} from '../../src/hooks/useCommunityQuery';
export default function CommunityProfileScreen() {
    const params = useLocalSearchParams<{ id: string }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const c = useCommunityColors();
    const { t } = useTranslation();
    const router = useRouter();
    const userId = useAuthStore((state) => state.session?.user.id);
    const own = userId === id;
    const profile = useCommunityProfile(id);
    const viewer = useCommunityProfile(userId);
    const following = useCommunityFollowing();
    const feed = useCommunityFeed(false, id);
    const mutation = useCommunityMutation();
    const isFollowing = following.data?.includes(id) || false;
    const refresh = useCallback(() => {
        void profile.refetch();
        void viewer.refetch();
        void feed.refetch();
        void following.refetch();
    }, [profile.refetch, viewer.refetch, feed.refetch, following.refetch]);
    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh]),
    );
    if (!userId) return <Redirect href="/(auth)/login" />;
    const person = profile.data;
    return (
        <SafeAreaView
            edges={['top', 'bottom']}
            style={{ flex: 1, backgroundColor: c.bg }}
        >
            <SessionFormHeader
                title={t(own ? 'community.myProfile' : 'community.djProfile')}
                subtitle={person?.artist_name || t('community.title')}
                onClose={() => router.back()}
            />
            <ScrollView
                refreshControl={
                    <RefreshControl
                        refreshing={profile.isRefetching || feed.isRefetching}
                        onRefresh={refresh}
                        tintColor={c.accent}
                    />
                }
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingBottom: 28,
                }}
            >
                <View
                    style={{
                        maxWidth: 900,
                        width: '100%',
                        alignSelf: 'center',
                        gap: 16,
                    }}
                >
                    {profile.isPending ? (
                        <CommunityMessage
                            title={t('community.loading')}
                            loading
                        />
                    ) : profile.isError ? (
                        <CommunityMessage
                            title={t('community.error')}
                            retry={refresh}
                        />
                    ) : !person ? (
                        <CommunityMessage
                            title={t('community.unavailable')}
                            hint={t('community.unavailableHint')}
                        />
                    ) : (
                        <>
                            <View
                                style={{
                                    padding: 22,
                                    borderRadius: 24,
                                    backgroundColor: c.card,
                                    borderColor: c.border,
                                    borderWidth: 1,
                                    gap: 15,
                                }}
                            >
                                <Avatar
                                    name={person.artist_name}
                                    url={person.avatar_url}
                                    size="lg"
                                />
                                <Text
                                    style={{
                                        color: c.fg,
                                        fontSize: 27,
                                        fontWeight: '800',
                                        letterSpacing: -0.6,
                                    }}
                                >
                                    {person.artist_name}
                                </Text>
                                {!!person.city && (
                                    <Text
                                        style={{ color: c.muted, fontSize: 14 }}
                                    >
                                        {person.city}
                                    </Text>
                                )}
                                {!!person.genres && (
                                    <Text
                                        style={{
                                            color: c.accent,
                                            fontSize: 13,
                                        }}
                                    >
                                        {person.genres}
                                    </Text>
                                )}
                                {!!person.bio && (
                                    <Text
                                        style={{
                                            color: c.muted,
                                            fontSize: 14,
                                            lineHeight: 22,
                                        }}
                                    >
                                        {person.bio}
                                    </Text>
                                )}
                                {own ? (
                                    <CommunityButton
                                        label={t('community.editProfile')}
                                        onPress={() =>
                                            router.push(
                                                '/community/edit-profile',
                                            )
                                        }
                                        secondary
                                    />
                                ) : (
                                    <CommunityButton
                                        label={t(
                                            isFollowing
                                                ? 'community.unfollow'
                                                : 'community.follow',
                                        )}
                                        busy={
                                            mutation.isPending ||
                                            following.isPending
                                        }
                                        disabled={
                                            following.isError ||
                                            viewer.isError ||
                                            viewer.isPending
                                        }
                                        secondary={isFollowing}
                                        onPress={() => {
                                            if (!isFollowing && !viewer.data?.is_visible)
                                                router.push(
                                                    '/community/edit-profile',
                                                );
                                            else
                                                mutation.mutate({
                                                    kind: 'follow',
                                                    target: id,
                                                    enabled: !isFollowing,
                                                });
                                        }}
                                    />
                                )}
                                {own && !person.is_visible && (
                                    <Text
                                        style={{
                                            color: c.muted,
                                            fontSize: 12,
                                            lineHeight: 19,
                                        }}
                                    >
                                        {t('community.hiddenHint')}
                                    </Text>
                                )}
                            </View>
                            {(mutation.isError ||
                                following.isError ||
                                viewer.isError) && (
                                <CommunityMessage
                                    title={t('community.error')}
                                    retry={() => {
                                        mutation.reset();
                                        refresh();
                                    }}
                                />
                            )}
                            <Text
                                style={{
                                    color: c.fg,
                                    fontWeight: '800',
                                    fontSize: 18,
                                    paddingHorizontal: 4,
                                }}
                            >
                                {t('community.sessions')}
                            </Text>
                            {feed.isPending ? (
                                <CommunityMessage
                                    title={t('community.loading')}
                                    loading
                                />
                            ) : feed.isError ? (
                                <CommunityMessage
                                    title={t('community.error')}
                                    retry={() => {
                                        void feed.refetch();
                                    }}
                                />
                            ) : feed.data?.pages.flat().length ? (
                                feed.data.pages
                                    .flat()
                                    .map((item) => (
                                        <CommunitySessionCard
                                            key={item.session_id}
                                            item={item}
                                        />
                                    ))
                            ) : (
                                <CommunityMessage
                                    title={t('community.noProfileSessions')}
                                    hint={t(
                                        own
                                            ? 'community.shareFromSession'
                                            : 'community.noProfileSessionsHint',
                                    )}
                                />
                            )}
                            {feed.hasNextPage && (
                                <CommunityButton
                                    label={t('community.loadMore')}
                                    secondary
                                    busy={feed.isFetchingNextPage}
                                    onPress={() => {
                                        void feed.fetchNextPage();
                                    }}
                                />
                            )}
                        </>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
