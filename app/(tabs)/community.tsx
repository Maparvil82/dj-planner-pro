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
    TextInput,
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
    CommunitySessionCard,
    useCommunityColors,
} from '../../src/components/community/CommunityUI';
import {
    useCommunityDiscover,
    useCommunityFilterOptions,
    useCommunityFeed,
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
    const [tab, setTab] = useState<'sessions' | 'following' | 'djs'>(
        'sessions',
    );
    const [sessionFilters, setSessionFilters] = useState<CommunityFilters>({
        city: '',
        genre: '',
    });
    const [djFilters, setDjFilters] = useState<CommunityFilters>({
        city: '',
        genre: '',
    });
    const own = useCommunityProfile(userId);
    const socialReady = !own.isError && canUseDJProfile(own.data);
    const filterOptions = useCommunityFilterOptions(
        tab === 'djs' ? 'djs' : 'sessions',
        socialReady,
    );
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(search), 300);
        return () => clearTimeout(timer);
    }, [search]);
    const following = useCommunityFollowing(socialReady);
    const feed = useCommunityFeed(
        tab === 'following',
        null,
        tab === 'sessions' ? sessionFilters : undefined,
        socialReady,
    );
    const discover = useCommunityDiscover(debounced, djFilters, socialReady);
    const mutation = useCommunityMutation();
    useFocusEffect(
        useCallback(() => {
            void own.refetch();
            if (!socialReady) return;
            void following.refetch();
            void feed.refetch();
            void discover.refetch();
            void filterOptions.refetch();
        }, [
            socialReady,
            own.refetch,
            following.refetch,
            feed.refetch,
            discover.refetch,
            filterOptions.refetch,
        ]),
    );
    const active = tab === 'djs' ? discover : feed;
    const error =
        mutation.isError || active.isError || own.isError || following.isError;
    const retry = () => {
        mutation.reset();
        void active.refetch();
        void filterOptions.refetch();
        void own.refetch();
        void following.refetch();
    };
    const profiles = discover.data?.pages.flat() || [];
    const sessions = feed.data?.pages.flat() || [];
    const refresh = () => {
        void active.refetch();
        void filterOptions.refetch();
        void own.refetch();
        void following.refetch();
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
                                refreshing={active.isRefetching}
                                onRefresh={refresh}
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
                                    ['sessions', 'following', 'djs'] as const
                                ).map((value) => (
                                    <TouchableOpacity
                                        key={value}
                                        accessibilityRole="button"
                                        accessibilityState={{
                                            selected: tab === value,
                                        }}
                                        onPress={() => setTab(value)}
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
                            {tab === 'djs' && (
                                <TextInput
                                    accessibilityLabel={t('community.search')}
                                    placeholder={t('community.search')}
                                    value={search}
                                    onChangeText={setSearch}
                                    placeholderTextColor={c.muted}
                                    style={{
                                        color: c.fg,
                                        backgroundColor: c.card,
                                        borderRadius: 16,
                                        borderWidth: 1,
                                        borderColor: c.border,
                                        padding: 15,
                                        minHeight: 50,
                                    }}
                                />
                            )}
                            {tab !== 'following' && (
                                <CommunityFiltersBar
                                    value={
                                        tab === 'djs'
                                            ? djFilters
                                            : sessionFilters
                                    }
                                    onChange={
                                        tab === 'djs'
                                            ? setDjFilters
                                            : setSessionFilters
                                    }
                                    mode={tab === 'djs' ? 'djs' : 'sessions'}
                                    options={filterOptions.data}
                                    loading={filterOptions.isPending}
                                    error={filterOptions.isError}
                                    retry={() => {
                                        void filterOptions.refetch();
                                    }}
                                />
                            )}
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
                            ) : tab === 'djs' ? (
                                profiles.length ? (
                                    profiles.map((profile) => (
                                        <CommunityProfileCard
                                            key={profile.user_id}
                                            profile={profile}
                                            own={profile.user_id === userId}
                                            following={
                                                following.data?.includes(
                                                    profile.user_id,
                                                ) || false
                                            }
                                            busy={
                                                mutation.isPending &&
                                                mutation.variables?.kind ===
                                                    'follow' &&
                                                mutation.variables.target ===
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
                                                    !canUseDJProfile(own.data)
                                                )
                                                    router.push(
                                                        '/profile?edit=1',
                                                    );
                                                else
                                                    mutation.mutate({
                                                        kind: 'follow',
                                                        target: profile.user_id,
                                                        enabled:
                                                            !following.data?.includes(
                                                                profile.user_id,
                                                            ),
                                                    });
                                            }}
                                        />
                                    ))
                                ) : (
                                    !active.isError && (
                                        <CommunityMessage
                                            title={t(
                                                djFilters.city ||
                                                    djFilters.genre
                                                    ? 'communityFilters.noResults'
                                                    : 'community.noDjs',
                                            )}
                                            hint={t(
                                                djFilters.city ||
                                                    djFilters.genre
                                                    ? 'communityFilters.noResultsHint'
                                                    : 'community.noDjsHint',
                                            )}
                                        />
                                    )
                                )
                            ) : sessions.length ? (
                                sessions.map((item) => (
                                    <CommunitySessionCard
                                        key={item.session_id}
                                        item={item}
                                    />
                                ))
                            ) : (
                                !active.isError && (
                                    <CommunityMessage
                                        title={t(
                                            tab === 'sessions' &&
                                                (sessionFilters.city ||
                                                    sessionFilters.genre)
                                                ? 'communityFilters.noResults'
                                                : tab === 'following'
                                                  ? 'community.noFollowingSessions'
                                                  : 'community.noSessions',
                                        )}
                                        hint={t(
                                            tab === 'sessions' &&
                                                (sessionFilters.city ||
                                                    sessionFilters.genre)
                                                ? 'communityFilters.noResultsHint'
                                                : tab === 'following'
                                                  ? 'community.noFollowingHint'
                                                  : 'community.noSessionsHint',
                                        )}
                                    />
                                )
                            )}
                            {tab === 'following' && !sessions.length && (
                                <CommunityButton
                                    label={t('community.discoverDjs')}
                                    secondary
                                    onPress={() => setTab('djs')}
                                />
                            )}
                            {active.hasNextPage && (
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
