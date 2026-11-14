import { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { CommunityActivity } from '../../services/community';
import { useTranslation } from '../../i18n/useTranslation';
import { Avatar } from '../ui/Avatar';
import { CommunitySessionCard, useCommunityColors } from './CommunityUI';
import { MixListItem } from './MixListItem';
import { MixPlayer } from './MixPlayer';
import { useSavedMixFlags } from '../../hooks/useSavedMixes';
export function useCommunityActivityRenderer({
    items,
    enabled,
}: {
    items: CommunityActivity[];
    enabled: boolean;
}) {
    const c = useCommunityColors();
    const { t, currentLanguage, dateLocale } = useTranslation();
    const router = useRouter();
    const [focused, setFocused] = useState(false);
    const [active, setActive] = useState<string | null>(null);
    const saved = useSavedMixFlags(
        items.filter((item) => item.kind === 'mix').map((item) => item.id),
        enabled,
    );
    useFocusEffect(
        useCallback(() => {
            setFocused(true);
            return () => {
                setFocused(false);
                setActive(null);
            };
        }, []),
    );
    useEffect(() => {
        if (!enabled) setActive(null);
    }, [enabled]);
    return (item: CommunityActivity) => {
        if (item.kind === 'session')
            return (
                <CommunitySessionCard
                    key={`session-${item.id}`}
                    item={item.payload}
                    activityLabel={`${t('communityActivity.publishedSession')} · ${new Date(item.published_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}`}
                />
            );
        const mix = item.payload;
        const playing = enabled && focused && active === item.id;
        return (
            <View
                key={`mix-${item.id}`}
                style={{
                    backgroundColor: c.card,
                    borderWidth: c.dark ? 0 : 1,
                    borderColor: c.border,
                    borderRadius: 24,
                    padding: 16,
                    gap: 14,
                }}
            >
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('communityActivity.openDJ', {
                        name: mix.artist_name,
                    })}
                    onPress={() => router.push(`/community/${mix.user_id}`)}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        minHeight: 44,
                    }}
                >
                    <Avatar
                        url={mix.avatar_url}
                        name={mix.artist_name}
                        size="sm"
                    />
                    <View style={{ flex: 1, gap: 3 }}>
                        <Text
                            style={[{
                                color: c.fg,
                                fontWeight: '700',
                                fontSize: 14,
                            }, c.dark && { color: c.cardText }]}
                        >
                            {mix.artist_name}
                        </Text>
                        <Text style={[{ color: c.muted, fontSize: 11 }, c.dark && { color: c.cardText }]}>
                            {t('communityActivity.sharedMix')} ·{' '}
                            {new Date(item.published_at).toLocaleDateString(
                                dateLocale,
                                {
                                    day: 'numeric',
                                    month: 'short',
                                },
                            )}
                        </Text>
                    </View>
                </TouchableOpacity>
                <MixListItem
                    mix={mix}
                    saveState={{
                        saved: !!saved.data?.[mix.id],
                        loading: saved.isPending,
                        error: saved.isError,
                        retry: () => {
                            void saved.refetch();
                        },
                    }}
                    focused={focused}
                    active={playing}
                    onPress={() => setActive(playing ? null : item.id)}
                />
                {playing && (
                    <MixPlayer source={mix} title={mix.title} autoPlay />
                )}
            </View>
        );
    };
}
