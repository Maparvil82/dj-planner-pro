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
    useCommunityFeed,
    useCommunityFollowing,
    useCommunityMutation,
    useCommunityProfile,
} from '../../src/hooks/useCommunityQuery';
export default function CommunityScreen() {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const router = useRouter();
    const userId = useAuthStore((state) => state.session?.user.id);
    const [tab, setTab] = useState<'sessions' | 'following' | 'djs'>(
        'sessions',
    );
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(search), 300);
        return () => clearTimeout(timer);
    }, [search]);
    const own = useCommunityProfile(userId);
    const following = useCommunityFollowing();
    const feed = useCommunityFeed(tab === 'following');
    const discover = useCommunityDiscover(debounced);
    const mutation = useCommunityMutation();
    useFocusEffect(
        useCallback(() => {
            void own.refetch();
            void following.refetch();
            void feed.refetch();
            void discover.refetch();
        }, [own.refetch, following.refetch, feed.refetch, discover.refetch]),
    );
    const active = tab === 'djs' ? discover : feed;
    const error =
        mutation.isError || active.isError || own.isError || following.isError;
    const retry = () => {
        mutation.reset();
        void active.refetch();
        void own.refetch();
        void following.refetch();
    };
    const profiles = discover.data?.pages.flat() || [];
    const sessions = feed.data?.pages.flat() || [];
    const refresh = () => {
        void active.refetch();
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
            <PageHeader
                title={t('community.title')}
                subtitle={t('community.intro')}
                action={null}
            />
            <ScrollView
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
                    paddingBottom: 28,
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
                    {!own.isPending &&
                        !own.isError &&
                        !own.data?.is_visible && (
                            <View
                                style={{
                                    padding: 20,
                                    borderRadius: 24,
                                    backgroundColor: c.tint,
                                    gap: 12,
                                }}
                            >

                                <Text
                                    style={{
                                        color: c.fg,
                                        fontSize: 19,
                                        fontWeight: '800',
                                    }}
                                >
                                    {t('community.joinTitle')}
                                </Text>
                                <Text
                                    style={{
                                        color: c.muted,
                                        lineHeight: 20,
                                        fontSize: 13,
                                    }}
                                >
                                    {t('community.joinHint')}
                                </Text>
                                <CommunityButton
                                    label={t('community.createProfile')}
                                    onPress={() =>
                                        router.push('/(tabs)/profile?edit=1')
                                    }
                                />
                            </View>
                        )}
                    <View
                        style={{
                            flexDirection: 'row',
                            padding: 5,
                            backgroundColor: c.dark ? '#20273b' : '#e9eaf3',
                            borderRadius: 16,
                            gap: 4,
                        }}
                    >
                        {(['sessions', 'following', 'djs'] as const).map(
                            (value) => (
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
                            ),
                        )}
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
                                        mutation.variables?.kind === 'follow' &&
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
                                            !own.data?.is_visible
                                        )
                                            router.push(
                                                '/(tabs)/profile?edit=1',
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
                                    title={t('community.noDjs')}
                                    hint={t('community.noDjsHint')}
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
                                    tab === 'following'
                                        ? 'community.noFollowingSessions'
                                        : 'community.noSessions',
                                )}
                                hint={t(
                                    tab === 'following'
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
        </SafeAreaView>
    );
}
