import { useState } from 'react';
import {
    Image,
    Modal,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../i18n/useTranslation';
import type { CommunitySession } from '../../services/community';
import type { useCommunitySessionShelf } from '../../hooks/useCommunityQuery';
import { sessionDisplayTitle } from '../../utils/sessionNaming';
import { PosterFrameImage } from '../sessions/PosterFrameImage';
import {
    CommunityButton,
    CommunityMessage,
    useCommunityColors,
} from './CommunityUI';
type Shelf = ReturnType<typeof useCommunitySessionShelf>;
export function CommunitySessionShelves({
    following,
    city,
    rest,
    homeCity,
    filtered,
}: {
    following: Shelf;
    city: Shelf;
    rest: Shelf;
    homeCity: string;
    filtered: boolean;
}) {
    const c = useCommunityColors();
    const { t, currentLanguage } = useTranslation();
    const router = useRouter();
    const [selected, setSelected] = useState<CommunitySession | null>(null);
    const dateLabel = (item: CommunitySession) =>
        new Date(`${item.date}T12:00:00`).toLocaleDateString(currentLanguage, {
            day: 'numeric',
            month: 'short',
        });
    const groups = [
        {
            query: following,
            title: t('sessionShelves.following'),
            square: true,
        },
        {
            query: city,
            title: t('sessionShelves.city', { city: homeCity }),
            square: true,
        },
        { query: rest, title: t('sessionShelves.rest'), square: false },
    ];
    const empty = groups.every(
        (group) =>
            group.query.isSuccess && !group.query.data.pages.flat().length,
    );
    const card = (item: CommunitySession, square: boolean) => (
        <TouchableOpacity
            key={item.session_id}
            accessibilityRole="button"
            accessibilityLabel={`${t('sessionShelves.open')}: ${sessionDisplayTitle(item, t)}`}
            onPress={() => setSelected(item)}
            style={{
                width: square ? 200 : '100%',
                height: square ? 200 : 112,
                borderRadius: 20,
                overflow: 'hidden',
                backgroundColor: c.card,
                borderWidth: square ? 0 : 1,
                borderColor: c.border,
            }}
        >
            {square ? (
                <>
                    <View
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: '#302765',
                        }}
                    >
                        {item.poster_url ? (
                            <PosterFrameImage
                                uri={item.poster_url}
                                x={item.poster_focus_x}
                                y={item.poster_focus_y}
                                aspectRatio={1}
                            />
                        ) : (
                            <LinearGradient
                                colors={['#6554df', '#302765']}
                                style={{ flex: 1 }}
                            />
                        )}
                    </View>
                    <LinearGradient
                        colors={['rgba(0,0,0,0.08)', 'rgba(8,10,22,0.88)']}
                        style={{ position: 'absolute', inset: 0 }}
                    />
                    <View
                        style={{
                            flex: 1,
                            padding: 14,
                            justifyContent: 'space-between',
                        }}
                    >
                        <Text
                            style={{
                                alignSelf: 'flex-start',
                                color: '#fff',
                                backgroundColor: 'rgba(0,0,0,0.4)',
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                paddingVertical: 5,
                                fontSize: 12,
                                fontWeight: '800',
                            }}
                        >
                            {dateLabel(item)}
                        </Text>
                        <View style={{ gap: 4 }}>
                            <Text
                                numberOfLines={2}
                                style={{
                                    color: '#fff',
                                    fontSize: 18,
                                    lineHeight: 22,
                                    fontWeight: '800',
                                }}
                            >
                                {sessionDisplayTitle(item, t)}
                            </Text>
                            <Text
                                numberOfLines={1}
                                style={{ color: '#edeaf8', fontSize: 11 }}
                            >
                                {[item.venue, item.city]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </Text>
                            <Text
                                numberOfLines={1}
                                style={{
                                    color: '#fff',
                                    fontSize: 12,
                                    fontWeight: '600',
                                }}
                            >
                                {item.artist_name}
                            </Text>
                        </View>
                    </View>
                </>
            ) : (
                <View
                    style={{
                        flex: 1,
                        flexDirection: 'row',
                        padding: 12,
                        gap: 12,
                        alignItems: 'center',
                    }}
                >
                    {!!item.poster_url && (
                        <View
                            style={{
                                width: 80,
                                height: 80,
                                borderRadius: 12,
                                overflow: 'hidden',
                            }}
                        >
                            <PosterFrameImage
                                uri={item.poster_url}
                                x={item.poster_focus_x}
                                y={item.poster_focus_y}
                                aspectRatio={1}
                            />
                        </View>
                    )}
                    <View style={{ flex: 1, gap: 4 }}>
                        <Text
                            style={{
                                color: c.accent,
                                fontSize: 11,
                                fontWeight: '800',
                            }}
                        >
                            {dateLabel(item)}
                            {item.start_time
                                ? ` · ${item.start_time.slice(0, 5)}`
                                : ''}
                        </Text>
                        <Text
                            numberOfLines={1}
                            style={{
                                color: c.fg,
                                fontWeight: '800',
                                fontSize: 16,
                            }}
                        >
                            {sessionDisplayTitle(item, t)}
                        </Text>
                        <Text
                            numberOfLines={1}
                            style={{ color: c.muted, fontSize: 12 }}
                        >
                            {[item.venue, item.city]
                                .filter(Boolean)
                                .join(' · ')}
                        </Text>
                        <Text
                            numberOfLines={1}
                            style={{ color: c.fg, fontSize: 11 }}
                        >
                            {item.artist_name}
                        </Text>
                    </View>
                </View>
            )}
        </TouchableOpacity>
    );
    return (
        <View style={{ gap: 24 }}>
            {groups.map(({ query, title, square }) => {
                const items = query.data?.pages.flat() || [];
                if (query.isSuccess && !items.length) return null;
                return (
                    <View key={title} style={{ gap: 12 }}>
                        <Text
                            style={{
                                color: c.fg,
                                fontWeight: '800',
                                fontSize: 19,
                            }}
                        >
                            {title}
                        </Text>
                        {query.isPending ? (
                            <CommunityMessage
                                title={t('community.loading')}
                                loading
                            />
                        ) : query.isError ? (
                            <CommunityMessage
                                title={t('community.error')}
                                retry={() => {
                                    void query.refetch();
                                }}
                            />
                        ) : square ? (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{
                                    gap: 12,
                                    paddingBottom: 4,
                                }}
                            >
                                {items.map((item) => card(item, true))}
                                {query.hasNextPage && (
                                    <View
                                        style={{
                                            width: 100,
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <CommunityButton
                                            secondary
                                            label={t('community.loadMore')}
                                            busy={query.isFetchingNextPage}
                                            onPress={() => {
                                                void query.fetchNextPage();
                                            }}
                                        />
                                    </View>
                                )}
                            </ScrollView>
                        ) : (
                            <View style={{ gap: 10 }}>
                                {items.map((item) => card(item, false))}
                                {query.hasNextPage && (
                                    <CommunityButton
                                        secondary
                                        label={t('community.loadMore')}
                                        busy={query.isFetchingNextPage}
                                        onPress={() => {
                                            void query.fetchNextPage();
                                        }}
                                    />
                                )}
                            </View>
                        )}
                    </View>
                );
            })}
            {empty && (
                <CommunityMessage
                    title={t(
                        filtered
                            ? 'communityFilters.noResults'
                            : 'community.noSessions',
                    )}
                    hint={t(
                        filtered
                            ? 'communityFilters.noResultsHint'
                            : 'community.noSessionsHint',
                    )}
                />
            )}
            <Modal
                visible={!!selected}
                animationType="slide"
                onRequestClose={() => setSelected(null)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
                    <ScrollView
                        contentContainerStyle={{
                            padding: 20,
                            gap: 18,
                            paddingBottom: 40,
                        }}
                    >
                        <CommunityButton
                            compact
                            secondary
                            label={t('profileShare.close')}
                            onPress={() => setSelected(null)}
                        />
                        {selected && (
                            <>
                                {selected.poster_url && (
                                    <Image
                                        accessibilityLabel={sessionDisplayTitle(
                                            selected,
                                            t,
                                        )}
                                        source={{ uri: selected.poster_url }}
                                        resizeMode="contain"
                                        style={{
                                            width: '100%',
                                            height: 360,
                                            borderRadius: 16,
                                            backgroundColor: c.card,
                                        }}
                                    />
                                )}
                                <Text
                                    style={{
                                        color: c.fg,
                                        fontSize: 26,
                                        fontWeight: '800',
                                    }}
                                >
                                    {sessionDisplayTitle(selected, t)}
                                </Text>
                                <Text
                                    style={{
                                        color: c.accent,
                                        fontWeight: '700',
                                    }}
                                >
                                    {new Date(
                                        `${selected.date}T12:00:00`,
                                    ).toLocaleDateString(currentLanguage, {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                    })}{' '}
                                    ·{' '}
                                    {[
                                        selected.start_time?.slice(0, 5),
                                        selected.end_time?.slice(0, 5),
                                    ]
                                        .filter(Boolean)
                                        .join(' – ')}
                                </Text>
                                <Text style={{ color: c.muted }}>
                                    {[selected.venue, selected.city]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </Text>
                                {[
                                    {
                                        user_id: selected.author_id,
                                        artist_name: selected.artist_name,
                                    },
                                    ...(selected.collaborators || []),
                                ].map((person) => (
                                    <CommunityButton
                                        key={person.user_id}
                                        secondary
                                        label={person.artist_name}
                                        onPress={() => {
                                            setSelected(null);
                                            router.push(
                                                `/community/${person.user_id}`,
                                            );
                                        }}
                                    />
                                ))}
                            </>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </View>
    );
}
