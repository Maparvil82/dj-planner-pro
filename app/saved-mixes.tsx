import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useSavedMixList } from '../src/hooks/useSavedMixes';
import { useAuthStore } from '../src/store/useAuthStore';
import { useTranslation } from '../src/i18n/useTranslation';
import {
    CommunityButton,
    CommunityMessage,
    useCommunityColors,
} from '../src/components/community/CommunityUI';
import { MixListItem } from '../src/components/community/MixListItem';
import { MixPlayer } from '../src/components/community/MixPlayer';
export default function SavedMixesScreen() {
    const c = useCommunityColors(),
        { t } = useTranslation(),
        router = useRouter();
    const viewer = useAuthStore((state) => state.session?.user.id);
    const hydrated = useAuthStore(
        (state) => state.initialized && state.hasHydrated,
    );
    const mixes = useSavedMixList();
    const [focused, setFocused] = useState(false),
        [active, setActive] = useState<string | null>(null);
    useFocusEffect(
        useCallback(() => {
            setFocused(true);
            if (viewer) void mixes.refetch();
            return () => {
                setFocused(false);
                setActive(null);
            };
        }, [viewer, mixes.refetch]),
    );
    if (!hydrated) return null;
    if (!viewer) return <Redirect href="/(auth)/login" />;
    const rows = mixes.data?.pages.flat() || [];
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 20,
                }}
            >
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('go_back')}
                    onPress={() =>
                        router.canGoBack()
                            ? router.back()
                            : router.replace('/(tabs)/community')
                    }
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: c.card,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <ArrowLeft size={21} color={c.fg} />
                </TouchableOpacity>
                <View style={{ flex: 1, gap: 4 }}>
                    <Text
                        style={{ color: c.fg, fontSize: 23, fontWeight: '800' }}
                    >
                        {t('savedMixes.title')}
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 12 }}>
                        {t('savedMixes.private')}
                    </Text>
                </View>
            </View>
            <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                    padding: 20,
                    paddingTop: 0,
                    paddingBottom: 40,
                    gap: 16,
                    width: '100%',
                    maxWidth: 900,
                    alignSelf: 'center',
                }}
            >
                {mixes.isError && (
                    <CommunityMessage
                        title={t('community.error')}
                        retry={() => {
                            void mixes.refetch();
                        }}
                    />
                )}
                {mixes.isPending ? (
                    <CommunityMessage loading title={t('community.loading')} />
                ) : rows.length ? (
                    rows.map((mix) => (
                        <View
                            key={mix.id}
                            style={{
                                padding: 16,
                                gap: 14,
                                borderWidth: 1,
                                borderColor: c.border,
                                borderRadius: 24,
                                backgroundColor: c.card,
                            }}
                        >
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel={t(
                                    'communityActivity.openDJ',
                                    { name: mix.artist_name },
                                )}
                                onPress={() =>
                                    router.push(`/community/${mix.user_id}`)
                                }
                                style={{
                                    minHeight: 44,
                                    justifyContent: 'center',
                                }}
                            >
                                <Text
                                    style={{
                                        color: c.accent,
                                        fontWeight: '700',
                                        fontSize: 13,
                                    }}
                                >
                                    {mix.artist_name}
                                </Text>
                            </TouchableOpacity>
                            <MixListItem
                                mix={mix}
                                focused={focused}
                                active={focused && active === mix.id}
                                saveState={{ saved: true }}
                                onPress={() =>
                                    setActive(active === mix.id ? null : mix.id)
                                }
                            />
                            {focused && active === mix.id && (
                                <MixPlayer
                                    key={mix.id}
                                    source={mix}
                                    title={mix.title}
                                    autoPlay
                                />
                            )}
                        </View>
                    ))
                ) : (
                    !mixes.isError && (
                        <>
                            <CommunityMessage
                                title={t('savedMixes.empty')}
                                hint={t('savedMixes.emptyHint')}
                            />
                            <CommunityButton
                                secondary
                                label={t('savedMixes.discover')}
                                onPress={() =>
                                    router.replace('/(tabs)/community')
                                }
                            />
                        </>
                    )
                )}
                {!!rows.length && (
                    <Text
                        style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}
                    >
                        {t('savedMixes.availability')}
                    </Text>
                )}
                {mixes.hasNextPage && (
                    <CommunityButton
                        secondary
                        label={t('community.loadMore')}
                        busy={mixes.isFetchingNextPage}
                        onPress={() => {
                            void mixes.fetchNextPage();
                        }}
                    />
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
