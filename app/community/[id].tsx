import { ProfileShareSheet } from '../../src/components/community/ProfileShareSheet';
import { ProfileMixes } from '../../src/components/community/ProfileMixes';
import { canUseDJProfile } from '../../src/utils/communityProfile';
import { useCallback, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
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
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTranslation } from '../../src/i18n/useTranslation';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Share2 } from 'lucide-react-native';
import {
    DJProfileHero,
    DJProfileDetails,
} from '../../src/components/community/DJProfileHero';
import {
    CommunityButton,
    CommunityMessage,
    CommunitySessionCard,
    useCommunityColors,
} from '../../src/components/community/CommunityUI';
import {
    useCommunitySessionCounts,
    useCommunityFeed,
    useCommunityFollowing,
    useCommunityMutation,
    useCommunityProfile,
} from '../../src/hooks/useCommunityQuery';
export default function CommunityProfileScreen() {
    const params = useLocalSearchParams<{ id: string; preview?: string }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const c = useCommunityColors();
    const insets = useSafeAreaInsets();
    const [scrolled, setScrolled] = useState(false);
    const [sharing, setSharing] = useState(false);
    const { t } = useTranslation();
    const router = useRouter();
    const userId = useAuthStore((state) => state.session?.user.id);
    const authReady = useAuthStore(
        (state) => state.hasHydrated && state.initialized,
    );
    const own = userId === id;
    const profile = useCommunityProfile(id);
    const viewer = useCommunityProfile(userId);
    const following = useCommunityFollowing();
    const feed = useCommunityFeed(false, id);
    const counts = useCommunitySessionCounts(id ? [id] : []);
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
    if (!authReady) return null;
    if (!userId)
        return (
            <Redirect
                href={{ pathname: '/(auth)/login', params: { dj: id } }}
            />
        );
    if (own && params.preview !== '1') return <Redirect href="/profile" />;
    const person = profile.data;
    return (
        <SafeAreaView
            edges={['bottom']}
            style={{ flex: 1, backgroundColor: c.bg }}
        >
            <StatusBar
                style={
                    scrolled || !person ? (c.dark ? 'light' : 'dark') : 'light'
                }
            />
            <View
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    paddingHorizontal: 20,
                    paddingTop: insets.top + 10,
                    paddingBottom: 10,
                    backgroundColor: scrolled || !person ? c.bg : 'transparent',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                }}
            >
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('djPage.back')}
                    onPress={() =>
                        router.canGoBack()
                            ? router.back()
                            : router.replace('/(tabs)/community')
                    }
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 15,
                        backgroundColor:
                            scrolled || !person
                                ? c.card
                                : 'rgba(13,18,32,0.45)',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <ArrowLeft
                        size={21}
                        color={scrolled || !person ? c.fg : '#fff'}
                    />
                </TouchableOpacity>
                <Text
                    style={{
                        color: c.fg,
                        opacity: scrolled || !person ? 1 : 0,
                        fontSize: 15,
                        fontWeight: '700',
                        flex: 1,
                    }}
                >
                    {scrolled && person
                        ? person.artist_name
                        : t(
                              own
                                  ? 'unifiedProfile.previewTitle'
                                  : 'community.djProfile',
                          )}
                </Text>
                {person?.is_visible && (
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={t('profileShare.title')}
                        onPress={() => setSharing(true)}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: scrolled
                                ? c.card
                                : 'rgba(13,18,32,0.45)',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Share2 size={20} color={scrolled ? c.fg : '#fff'} />
                    </TouchableOpacity>
                )}
            </View>
            {person?.is_visible && (
                <ProfileShareSheet
                    person={person}
                    visible={sharing}
                    onClose={() => setSharing(false)}
                />
            )}
            <ScrollView
                onScroll={(event) => {
                    const next = event.nativeEvent.contentOffset.y > 170;
                    setScrolled((previous) =>
                        previous === next ? previous : next,
                    );
                }}
                scrollEventThrottle={16}
                refreshControl={
                    <RefreshControl
                        refreshing={profile.isRefetching || feed.isRefetching}
                        onRefresh={refresh}
                        tintColor={c.accent}
                    />
                }
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingTop: !person ? insets.top + 76 : 0,
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
                            <View style={{ marginHorizontal: -20 }}>
                                <DJProfileHero
                                    person={person}
                                    sessionCount={counts.data?.[id]}
                                    action={
                                        own ? (
                                            <CommunityButton
                                                label={t(
                                                    'community.editProfile',
                                                )}
                                                onPress={() =>
                                                    router.push(
                                                        '/edit-dj-profile?edit=1',
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
                                                    profile.isRefetching ||
                                                    following.isError ||
                                                    viewer.isError ||
                                                    viewer.isPending
                                                }
                                                secondary={isFollowing}
                                                onPress={() => {
                                                    if (
                                                        !isFollowing &&
                                                        !canUseDJProfile(
                                                            viewer.data,
                                                        )
                                                    )
                                                        router.push(
                                                            '/edit-dj-profile?edit=1',
                                                        );
                                                    else
                                                        mutation.mutate({
                                                            kind: 'follow',
                                                            target: id,
                                                            enabled:
                                                                !isFollowing,
                                                        });
                                                }}
                                            />
                                        )
                                    }
                                />
                            </View>
                            {own && !person.is_visible && (
                                <CommunityMessage
                                    title={t('unifiedProfile.private')}
                                    hint={t('community.hiddenHint')}
                                />
                            )}
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
                            <DJProfileDetails person={person} />
                            <ProfileMixes
                                userId={id}
                                bare
                                hideWhenEmpty
                                previewLimit={5}
                                onViewAll={() =>
                                    router.push(`/community/mixes/${id}`)
                                }
                            />
                            {!!feed.data?.pages.flat().length && (
                                <Text
                                    style={{
                                        color: c.fg,
                                        fontWeight: '800',
                                        fontSize: 18,
                                        paddingHorizontal: 4,
                                    }}
                                >
                                    {t('djPage.publishedSessions')}
                                </Text>
                            )}
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
                                            showAuthor={item.author_id !== id}
                                        />
                                    ))
                            ) : own ? (
                                <CommunityMessage
                                    title={t('community.noProfileSessions')}
                                    hint={t(
                                        own
                                            ? 'community.shareFromSession'
                                            : 'community.noProfileSessionsHint',
                                    )}
                                />
                            ) : null}
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
