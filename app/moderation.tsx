import { useScrollHeader } from '../src/hooks/useScrollHeader';
import { ScrollHeaderContainer } from '../src/components/ui/ScrollHeaderContainer';
import { StorageImage as Image } from '../src/components/ui/StorageImage';
import { useAuthStore } from '../src/store/useAuthStore';
import { useState } from 'react';
import {
    useInfiniteQuery,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import {
    FlatList,
    Linking,
    Pressable,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    safetyService,
    type CommunityReport,
} from '../src/services/communitySafety';
import {
    useCommunitySafetyStatus,
    useInvalidateCommunitySafety,
} from '../src/hooks/useCommunitySafety';
import { useTranslation } from '../src/i18n/useTranslation';
import {
    CommunityButton,
    CommunityMessage,
    useCommunityColors,
} from '../src/components/community/CommunityUI';
function ReportRow({
    report,
    onReview,
    busy,
}: {
    report: CommunityReport;
    busy: boolean;
    onReview: (
        outcome: 'dismiss' | 'remove' | 'suspend' | 'restore',
        note: string,
    ) => void;
}) {
    const c = useCommunityColors(),
        { t, dateLocale } = useTranslation(),
        [note, setNote] = useState('');
    const media = ['avatar_url', 'cover_url', 'poster_url']
        .map((key) => report.snapshot[key])
        .filter(
            (url): url is string =>
                typeof url === 'string' && /^https:\/\//.test(url),
        );
    return (
        <View
            style={{
                padding: 18,
                borderRadius: 20,
                backgroundColor: c.card,
                gap: 12,
            }}
        >
            <Text style={[{ color: c.accent, fontWeight: '700' }, c.dark && { color: c.cardText }]}>
                {t(`safety.reasons.${report.reason}`)} ·{' '}
                {t(`safety.kinds.${report.kind}`)}
            </Text>
            <Text style={[{ color: c.fg, fontWeight: '800', fontSize: 18 }, c.dark && { color: c.cardText }]}>
                {report.snapshot.name || report.snapshot.title || report.id}
            </Text>
            <Text style={[{ color: c.muted, fontSize: 12 }, c.dark && { color: c.cardText }]}>
                {new Date(report.created_at).toLocaleString(dateLocale)}
            </Text>
            {[
                report.snapshot.bio,
                report.snapshot.venue,
                report.details,
                report.review_note,
            ]
                .filter(Boolean)
                .map((value, index) => (
                    <Text key={index} style={[{ color: c.fg, lineHeight: 21 }, c.dark && { color: c.cardText }]}>
                        {value}
                    </Text>
                ))}
            {media.map((url, index) => (
                <Image
                    key={index}
                    source={{ uri: url }}
                    resizeMode="contain"
                    style={{
                        width: '100%',
                        height: 220,
                        backgroundColor: c.field,
                        borderRadius: 12,
                    }}
                />
            ))}
            {!!report.snapshot.source_url && (
                <Pressable
                    accessibilityRole="link"
                    onPress={() => {
                        const url = report.snapshot.source_url;
                        if (
                            url &&
                            /^https:\/(\/www\.mixcloud\.com\/|\/soundcloud\.com\/)/.test(
                                url,
                            )
                        )
                            void Linking.openURL(url);
                    }}
                    style={{ padding: 12 }}
                >
                    <Text style={[{ color: c.accent }, c.dark && { color: c.cardText }]}>
                        {t('profileMixes.listen')}
                    </Text>
                </Pressable>
            )}
            <TextInput
                accessibilityLabel={t('safety.reviewNote')}
                placeholder={t('safety.reviewNote')}
                placeholderTextColor={c.muted}
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={1000}
                editable={!busy}
                style={{
                    padding: 14,
                    minHeight: 80,
                    borderRadius: 12,
                    backgroundColor: c.field,
                    color: c.fg,
                }}
            />
            <View style={{ gap: 10 }}>
                {(report.status === 'open'
                    ? (['dismiss', 'remove', 'suspend'] as const)
                    : (['restore'] as const)
                ).map((outcome) => (
                    <CommunityButton
                        key={outcome}
                        label={t(`safety.actions.${outcome}`)}
                        secondary={outcome === 'dismiss'}
                        busy={busy}
                        disabled={note.trim().length < 3}
                        onPress={() => onReview(outcome, note.trim())}
                    />
                ))}
            </View>
        </View>
    );
}
export default function ModerationScreen() {
    const { progress: headerProgress, onScroll: onHeaderScroll, onScrollBeginDrag: onHeaderScrollBeginDrag } = useScrollHeader('hide');
    const c = useCommunityColors(),
        { t } = useTranslation(),
        router = useRouter(),
        status = useCommunitySafetyStatus(),
        client = useQueryClient(),
        invalidate = useInvalidateCommunitySafety();
    const viewer = useAuthStore((s) => s.session?.user.id);
    const [tab, setTab] = useState<'open' | 'closed'>('open');
    const queue = useInfiniteQuery({
        queryKey: ['community-safety', 'queue', viewer, tab],
        enabled: status.data?.moderator === true,
        initialPageParam: 0,
        queryFn: ({ pageParam }) => safetyService.queue(tab, pageParam),
        getNextPageParam: (last, pages) =>
            last.length === 20 ? pages.length * 20 : undefined,
    });
    const review = useMutation({
        mutationFn: ({
            id,
            outcome,
            note,
        }: {
            id: string;
            outcome: 'dismiss' | 'remove' | 'suspend' | 'restore';
            note: string;
        }) => safetyService.review(id, outcome, note),
        onSuccess: async () => {
            await client.invalidateQueries({
                queryKey: ['community-safety', 'queue'],
            });
            await invalidate();
        },
    });
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
            <ScrollHeaderContainer progress={headerProgress} hasIcons={false}>
<View style={{ padding: 24, gap: 14 }}>
                <CommunityButton
                    label={t('djPage.back')}
                    secondary
                    compact
                    onPress={() =>
                        router.canGoBack()
                            ? router.back()
                            : router.replace('/(tabs)/community')
                    }
                />
                <Text style={{ color: c.fg, fontSize: 26, fontWeight: '800' }}>
                    {t('safety.moderation')}
                </Text>
            </View>
</ScrollHeaderContainer>
            {status.isPending ? (
                <CommunityMessage title={t('community.loading')} loading />
            ) : status.isError ? (
                <CommunityMessage
                    title={t('safety.error')}
                    retry={() => void status.refetch()}
                />
            ) : !status.data.moderator ? (
                <CommunityMessage title={t('safety.staffOnly')} />
            ) : (
                <>
                    <View
                        style={{
                            flexDirection: 'row',
                            gap: 12,
                            paddingHorizontal: 24,
                            paddingBottom: 14,
                        }}
                    >
                        {(['open', 'closed'] as const).map((value) => (
                            <CommunityButton
                                key={value}
                                label={t(`safety.${value}`)}
                                secondary={tab !== value}
                                compact
                                onPress={() => setTab(value)}
                            />
                        ))}
                    </View>
                    <FlatList scrollEventThrottle={16} onScrollBeginDrag={onHeaderScrollBeginDrag} onTouchStart={onHeaderScrollBeginDrag} onScroll={onHeaderScroll}
                        data={queue.data?.pages.flat() || []}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{
                            padding: 24,
                            paddingTop: 0,
                            gap: 16,
                        }}
                        refreshing={queue.isRefetching}
                        onRefresh={() => void queue.refetch()}
                        renderItem={({ item }) => (
                            <ReportRow
                                report={item}
                                busy={review.isPending}
                                onReview={(outcome, note) =>
                                    review.mutate({
                                        id: item.id,
                                        outcome,
                                        note,
                                    })
                                }
                            />
                        )}
                        ListEmptyComponent={
                            <CommunityMessage
                                title={t(
                                    queue.isPending
                                        ? 'community.loading'
                                        : queue.isError
                                          ? 'safety.error'
                                          : 'safety.noReports',
                                )}
                                loading={queue.isPending}
                                retry={
                                    queue.isError
                                        ? () => void queue.refetch()
                                        : undefined
                                }
                            />
                        }
                        ListFooterComponent={
                            <>
                                {review.isError && (
                                    <Text style={{ color: '#c44960' }}>
                                        {t('safety.error')}
                                    </Text>
                                )}
                                {queue.hasNextPage && (
                                    <CommunityButton
                                        label={t('community.loadMore')}
                                        secondary
                                        busy={queue.isFetchingNextPage}
                                        onPress={() =>
                                            void queue.fetchNextPage()
                                        }
                                    />
                                )}
                            </>
                        }
                    />
                </>
            )}
        </SafeAreaView>
    );
}
