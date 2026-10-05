import { cityLabel } from '../../src/utils/cities';
import { CommunitySessionShelves } from '../../src/components/community/CommunitySessionShelves';
import { CommunityActivityFeed } from '../../src/components/community/CommunityActivityFeed';
import { CommunityWelcome } from '../../src/components/community/CommunityWelcome';
import { canUseDJProfile } from '../../src/utils/communityProfile';
import { CommunityFiltersBar } from '../../src/components/community/CommunityFiltersBar';
import type { CommunityFilters } from '../../src/services/community';
import { useTabBarScroll } from '../../src/contexts/TabBarVisibilityContext';
import { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tabs, useFocusEffect, useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTranslation } from '../../src/i18n/useTranslation';
import { PageHeader } from '../../src/components/ui/PageHeader';
import {
    CommunityButton,
    CommunityMessage,
    CommunityProfileCard,
    useCommunityColors,
} from '../../src/components/community/CommunityUI';
import {
    useCommunityDiscover,
    useCommunityActivity,
    useCommunitySessionCounts,
    useCommunityFilterOptions,
    useCommunitySessionShelf,
    useCommunityFollowing,
    useCommunityMutation,
    useCommunityProfile,
} from '../../src/hooks/useCommunityQuery';
export default function CommunityScreen() {
    const onTabScroll = useTabBarScroll();
    const c = useCommunityColors();
    const { t } = useTranslation();
    const router = useRouter();
    const userId = useAuthStore((state) => state.session?.user.id);
    const [tab, setTab] = useState<'sessions' | 'following' | 'djs'>('djs');
    const [sessionFilters, setSessionFilters] = useState<CommunityFilters>({
        city: '',
        genre: '',
    });
    const [djFilters, setDjFilters] = useState<CommunityFilters>({
        city: '',
        genre: '',
    });
    const activityView = tab === 'following';
    const listView = tab === 'djs';
    const [refreshing, setRefreshing] = useState(false);
    const own = useCommunityProfile(userId);
    const socialReady = !own.isError && canUseDJProfile(own.data);
    const filterOptions = useCommunityFilterOptions(
        activityView ? 'activity' : tab === 'sessions' ? 'sessions' : 'djs',
        socialReady,
    );
    const [searches, setSearches] = useState({
        sessions: '',
        following: '',
        djs: '',
    });
    const search = searches[tab];
    const [followingFilters, setFollowingFilters] = useState<CommunityFilters>({
        city: '',
        genre: '',
    });
    const [debounced, setDebounced] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(search), 300);
        return () => clearTimeout(timer);
    }, [search]);
    const following = useCommunityFollowing(socialReady);
    const shelfCity =
        sessionFilters.city ||
        cityLabel(own.data?.city || '', own.data?.city_location);
    const shelvesEnabled = socialReady && tab === 'sessions';
    const followedSessions = useCommunitySessionShelf(
        'following',
        shelfCity,
        sessionFilters,
        debounced,
        shelvesEnabled,
    );
    const citySessions = useCommunitySessionShelf(
        'city',
        shelfCity,
        sessionFilters,
        debounced,
        shelvesEnabled,
    );
    const feed = useCommunitySessionShelf(
        'rest',
        shelfCity,
        sessionFilters,
        debounced,
        shelvesEnabled,
    );
    const discover = useCommunityDiscover(
        debounced,
        djFilters,
        socialReady && tab === 'djs',
    );
    const activity = useCommunityActivity(
        debounced,
        followingFilters,
        socialReady && activityView,
    );
    const mutation = useCommunityMutation();
    const active =
        tab === 'sessions' ? feed : tab === 'following' ? activity : discover;
    const activeFilters =
        tab === 'sessions'
            ? sessionFilters
            : tab === 'following'
              ? followingFilters
              : djFilters;
    const setFilters =
        tab === 'sessions'
            ? setSessionFilters
            : tab === 'following'
              ? setFollowingFilters
              : setDjFilters;
    useFocusEffect(
        useCallback(() => {
            void own.refetch();
            if (!socialReady) return;
            void following.refetch();
            void active.refetch();
            if (tab === 'sessions') {
                void followedSessions.refetch();
                void citySessions.refetch();
            }
            void filterOptions.refetch();
        }, [
            socialReady,
            own.refetch,
            following.refetch,
            active.refetch,
            followedSessions.refetch,
            citySessions.refetch,
            tab,
            filterOptions.refetch,
        ]),
    );
    const error =
        mutation.isError || active.isError || own.isError || following.isError;
    const retry = () => {
        mutation.reset();
        if (tab === 'sessions') {
            void followedSessions.refetch();
            void citySessions.refetch();
        }
        void active.refetch();
        void filterOptions.refetch();
        void own.refetch();
        void following.refetch();
    };
    const profiles =
        discover.data?.pages
            .flat()
            .filter((profile) => profile.user_id !== userId) || [];
    const counts = useCommunitySessionCounts(
        profiles.map((profile) => profile.user_id),
        socialReady && listView,
    );
    const refresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            const requests: Promise<unknown>[] = [
                active.refetch(),
                filterOptions.refetch(),
                own.refetch(),
                following.refetch(),
            ];
            if (listView) requests.push(counts.refetch());
            if (tab === 'sessions')
                requests.push(
                    followedSessions.refetch(),
                    citySessions.refetch(),
                );
            await Promise.allSettled(requests);
        } finally {
            setRefreshing(false);
        }
    };
    return (
        <SafeAreaView
            edges={['top']}
            style={{ flex: 1, backgroundColor: c.bg }}
        >
            <Tabs.Screen
                options={{
                    title: t('community.title'),
                    tabBarIcon: ({ color, size }) => (
                        <Users color={color} size={size} />
                    ),
                }}
            />
            {own.isPending || own.isError || !canUseDJProfile(own.data) ? (
                own.isPending ? (
                    <CommunityMessage title={t('community.loading')} loading />
                ) : own.isError ? (
                    <CommunityMessage
                        title={t('community.error')}
                        retry={() => {
                            void own.refetch();
                        }}
                    />
                ) : (
                    <CommunityWelcome />
                )
            ) : (
                <>
                    <PageHeader
                        title={t('community.title')}
                        subtitle={t('community.intro')}
                        action={null}
                    />
                    <ScrollView
                        onScroll={onTabScroll}
                        scrollEventThrottle={16}
                        keyboardShouldPersistTaps="handled"
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => {
                                    void refresh();
                                }}
                                tintColor={c.accent}
                            />
                        }
                        contentContainerStyle={{
                            paddingHorizontal: 20,
                            paddingBottom: 108,
                        }}
                    >
                        <View
                            style={{
                                width: '100%',
                                maxWidth: 900,
                                alignSelf: 'center',
                                gap: 16,
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    padding: 5,
                                    backgroundColor: c.dark
                                        ? '#20273b'
                                        : '#e9eaf3',
                                    borderRadius: 16,
                                    gap: 4,
                                }}
                            >
                                {(
                                    ['djs', 'sessions', 'following'] as const
                                ).map((value) => (
                                    <TouchableOpacity
                                        key={value}
                                        accessibilityRole="button"
                                        accessibilityState={{
                                            selected: tab === value,
                                        }}
                                        onPress={() => {
                                            setTab(value);
                                            setDebounced(searches[value]);
                                        }}
                                        style={{
                                            flex: 1,
                                            borderRadius: 12,
                                            paddingVertical: 12,
                                            alignItems: 'center',
                                            backgroundColor:
                                                tab === value
                                                    ? c.card
                                                    : 'transparent',
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color:
                                                    tab === value
                                                        ? c.accent
                                                        : c.muted,
                                                fontSize: 12,
                                                fontWeight: '700',
                                            }}
                                        >
                                            {t(`community.${value}`)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <CommunityFiltersBar
                                value={activeFilters}
                                onChange={setFilters}
                                mode={
                                    activityView
                                        ? 'activity'
                                        : listView
                                          ? 'djs'
                                          : 'sessions'
                                }
                                options={filterOptions.data}
                                loading={filterOptions.isPending}
                                error={filterOptions.isError}
                                retry={() => {
                                    void filterOptions.refetch();
                                }}
                                search={search}
                                onSearch={(text) =>
                                    setSearches({ ...searches, [tab]: text })
                                }
                                placeholder={t(
                                    activityView
                                        ? 'communityActivity.search'
                                        : tab === 'sessions'
                                          ? 'community.searchSessions'
                                          : 'community.search',
                                )}
                            />
                            {error && (
                                <CommunityMessage
                                    title={t('community.error')}
                                    retry={retry}
                                />
                            )}
                            {active.isPending ? (
                                <CommunityMessage
                                    title={t('community.loading')}
                                    loading
                                />
                            ) : activityView ? (
                                activity.data?.pages.flat().length ? (
                                    <CommunityActivityFeed
                                        items={activity.data.pages.flat()}
                                    />
                                ) : (
                                    !activity.isError && (
                                        <CommunityMessage
                                            title={t(
                                                activeFilters.city ||
                                                    activeFilters.genre ||
                                                    search.trim()
                                                    ? 'communityFilters.noResults'
                                                    : 'communityActivity.empty',
                                            )}
                                            hint={t(
                                                activeFilters.city ||
                                                    activeFilters.genre ||
                                                    search.trim()
                                                    ? 'communityFilters.noResultsHint'
                                                    : 'communityActivity.emptyHint',
                                            )}
                                        />
                                    )
                                )
                            ) : listView ? (
                                profiles.length ? (
                                    <View style={{ gap: 12 }}>
                                        {Array.from(
                                            {
                                                length: Math.ceil(
                                                    profiles.length / 2,
                                                ),
                                            },
                                            (_, row) => (
                                                <View
                                                    key={row}
                                                    style={{
                                                        flexDirection: 'row',
                                                        gap: 12,
                                                    }}
                                                >
                                                    {profiles
                                                        .slice(
                                                            row * 2,
                                                            row * 2 + 2,
                                                        )
                                                        .map((profile) => (
                                                            <CommunityProfileCard
                                                                sessionCount={
                                                                    counts
                                                                        .data?.[
                                                                        profile
                                                                            .user_id
                                                                    ]
                                                                }
                                                                key={
                                                                    profile.user_id
                                                                }
                                                                profile={
                                                                    profile
                                                                }
                                                                own={
                                                                    profile.user_id ===
                                                                    userId
                                                                }
                                                                following={
                                                                    following.data?.includes(
                                                                        profile.user_id,
                                                                    ) || false
                                                                }
                                                                busy={
                                                                    mutation.isPending &&
                                                                    mutation
                                                                        .variables
                                                                        ?.kind ===
                                                                        'follow' &&
                                                                    mutation
                                                                        .variables
                                                                        .target ===
                                                                        profile.user_id
                                                                }
                                                                disabled={
                                                                    mutation.isPending ||
                                                                    following.isPending ||
                                                                    following.isError ||
                                                                    own.isPending ||
                                                                    own.isError
                                                                }
                                                                onFollow={() => {
                                                                    if (
                                                                        !following.data?.includes(
                                                                            profile.user_id,
                                                                        ) &&
                                                                        !canUseDJProfile(
                                                                            own.data,
                                                                        )
                                                                    )
                                                                        router.push(
                                                                            '/edit-dj-profile?edit=1',
                                                                        );
                                                                    else
                                                                        mutation.mutate(
                                                                            {
                                                                                kind: 'follow',
                                                                                target: profile.user_id,
                                                                                enabled:
                                                                                    !following.data?.includes(
                                                                                        profile.user_id,
                                                                                    ),
                                                                            },
                                                                        );
                                                                }}
                                                            />
                                                        ))}
                                                    {profiles.slice(
                                                        row * 2,
                                                        row * 2 + 2,
                                                    ).length === 1 && (
                                                        <View
                                                            style={{ flex: 1 }}
                                                        />
                                                    )}
                                                </View>
                                            ),
                                        )}
                                    </View>
                                ) : (
                                    !active.isError && (
                                        <CommunityMessage
                                            title={t(
                                                activeFilters.city ||
                                                    activeFilters.genre ||
                                                    search.trim()
                                                    ? 'communityFilters.noResults'
                                                    : 'community.noDjs',
                                            )}
                                            hint={t(
                                                activeFilters.city ||
                                                    activeFilters.genre ||
                                                    search.trim()
                                                    ? 'communityFilters.noResultsHint'
                                                    : 'community.noDjsHint',
                                            )}
                                        />
                                    )
                                )
                            ) : (
                                <CommunitySessionShelves
                                    following={followedSessions}
                                    city={citySessions}
                                    rest={feed}
                                    homeCity={shelfCity}
                                    filtered={
                                        !!(
                                            sessionFilters.city ||
                                            sessionFilters.genre ||
                                            search.trim()
                                        )
                                    }
                                />
                            )}
                            {tab === 'following' &&
                                !activity.data?.pages.flat().length &&
                                !search.trim() &&
                                !followingFilters.city &&
                                !followingFilters.genre &&
                                !active.isPending &&
                                !active.isError && (
                                    <CommunityButton
                                        label={t('community.discoverDjs')}
                                        secondary
                                        onPress={() => {
                                            setTab('djs');
                                            setDebounced(searches.djs);
                                        }}
                                    />
                                )}
                            {tab !== 'sessions' && active.hasNextPage && (
                                <CommunityButton
                                    label={t('community.loadMore')}
                                    secondary
                                    busy={active.isFetchingNextPage}
                                    onPress={() => {
                                        void active.fetchNextPage();
                                    }}
                                />
                            )}
                        </View>
                    </ScrollView>
                </>
            )}
        </SafeAreaView>
    );
}
