import { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useCommunityPosters } from '../../hooks/useCommunityQuery';
import type { CommunitySession } from '../../services/community';
import { useTranslation } from '../../i18n/useTranslation';
import { sessionDisplayTitle } from '../../utils/sessionNaming';
import { CommunityButton, useCommunityColors } from './CommunityUI';
export function ProfilePosters({ userId }: { userId: string }) {
    const c = useCommunityColors();
    const { t, currentLanguage } = useTranslation();
    const insets = useSafeAreaInsets();
    const query = useCommunityPosters(userId);
    const [selected, setSelected] = useState<CommunitySession | null>(null);
    const [failed, setFailed] = useState<Record<string, boolean>>({});
    const rows = query.data?.pages.flat() || [];
    if (query.isSuccess && !rows.length) return null;
    return (
        <View style={{ gap: 12 }}>
            <Text style={{ color: c.fg, fontSize: 21, fontWeight: '800' }}>
                {t('profilePosters.title')}
            </Text>
            {query.isPending ? (
                <ActivityIndicator color={c.accent} />
            ) : query.isError ? (
                <CommunityButton
                    secondary
                    label={t('insights.retry')}
                    onPress={() => {
                        void query.refetch();
                    }}
                />
            ) : !rows.length ? (
                <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>
                    {t('profilePosters.empty')}
                </Text>
            ) : (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
                    onScroll={(event) => {
                        const {
                            contentOffset,
                            layoutMeasurement,
                            contentSize,
                        } = event.nativeEvent;
                        if (
                            contentOffset.x + layoutMeasurement.width >
                                contentSize.width - 200 &&
                            query.hasNextPage &&
                            !query.isFetchingNextPage
                        )
                            void query.fetchNextPage();
                    }}
                    scrollEventThrottle={100}
                >
                    {rows.map((item) => (
                        <TouchableOpacity
                            key={item.session_id}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('profilePosters.open')}: ${sessionDisplayTitle(item, t)}`}
                            onPress={() => setSelected(item)}
                            style={{ width: 142, gap: 7 }}
                        >
                            <View
                                style={{
                                    width: 142,
                                    height: 190,
                                    borderRadius: 16,
                                    backgroundColor: c.card,
                                    overflow: 'hidden',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                            >
                                {failed[item.session_id] ? (
                                    <Text
                                        style={{ color: c.muted, padding: 12 }}
                                    >
                                        {sessionDisplayTitle(item, t)}
                                    </Text>
                                ) : (
                                    <Image
                                        source={{ uri: item.poster_url! }}
                                        resizeMode="contain"
                                        onError={() =>
                                            setFailed((previous) => ({
                                                ...previous,
                                                [item.session_id]: true,
                                            }))
                                        }
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                        }}
                                    />
                                )}
                            </View>
                            <Text
                                numberOfLines={1}
                                style={{
                                    color: c.fg,
                                    fontSize: 12,
                                    fontWeight: '700',
                                }}
                            >
                                {sessionDisplayTitle(item, t)}
                            </Text>
                            <Text style={{ color: c.muted, fontSize: 11 }}>
                                {new Date(
                                    `${item.date}T12:00:00`,
                                ).toLocaleDateString(currentLanguage, {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                })}
                            </Text>
                        </TouchableOpacity>
                    ))}
                    {query.hasNextPage && (
                        <View style={{ width: 100, justifyContent: 'center' }}>
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
            )}
            <Modal
                visible={!!selected}
                transparent
                animationType="fade"
                onRequestClose={() => setSelected(null)}
            >
                <View
                    accessibilityViewIsModal
                    style={{
                        flex: 1,
                        backgroundColor: '#0d1220',
                        paddingTop: insets.top + 12,
                        paddingBottom: insets.bottom + 20,
                        paddingHorizontal: 20,
                        gap: 14,
                    }}
                >
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                        }}
                    >
                        <Text
                            numberOfLines={2}
                            style={{
                                flex: 1,
                                color: '#fff',
                                fontSize: 18,
                                fontWeight: '700',
                            }}
                        >
                            {selected ? sessionDisplayTitle(selected, t) : ''}
                        </Text>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={t('profileShare.close')}
                            onPress={() => setSelected(null)}
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 22,
                                backgroundColor: '#252d40',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <X color="#fff" size={20} />
                        </TouchableOpacity>
                    </View>
                    {selected && (
                        <Image
                            source={{ uri: selected.poster_url! }}
                            resizeMode="contain"
                            style={{ flex: 1, width: '100%' }}
                        />
                    )}
                    <Text style={{ color: '#a8b2c6', fontSize: 13 }}>
                        {[selected?.venue, selected?.city]
                            .filter(Boolean)
                            .join(' · ')}
                    </Text>
                </View>
            </Modal>
        </View>
    );
}
