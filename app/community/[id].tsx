import { ProfileMixes } from '../../src/components/community/ProfileMixes';
import { canUseDJProfile } from '../../src/utils/communityProfile';
import { useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Redirect,
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTranslation } from '../../src/i18n/useTranslation';
import { ArrowLeft } from 'lucide-react-native';
import { DJProfileHero } from '../../src/components/community/DJProfileHero';
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
    const params = useLocalSearchParams<{ id: string; preview?: string }>();
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
    if (own && params.preview !== '1') return <Redirect href="/profile" />;
    const person = profile.data;
    return (
        <SafeAreaView
            edges={['top', 'bottom']}
            style={{ flex: 1, backgroundColor: c.bg }}
        >
            <View
                style={{
                    paddingHorizontal: 20,
                    paddingVertical: 12,
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
                        backgroundColor: c.card,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <ArrowLeft size={21} color={c.fg} />
                </TouchableOpacity>
                <Text
                    style={{
                        color: c.fg,
                        fontSize: 15,
                        fontWeight: '700',
                        flex: 1,
                    }}
                >
                    {t(
                        own
                            ? 'unifiedProfile.previewTitle'
                            : 'community.djProfile',
                    )}
                </Text>
            </View>
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
                            <DJProfileHero
                                person={person}
                                action={
                                    own ? (
                                        <CommunityButton
                                            label={t('community.editProfile')}
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
                                                        enabled: !isFollowing,
                                                    });
                                            }}
                                        />
                                    )
                                }
                            />
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
                            <ProfileMixes userId={id} />
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
