import { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { CommunityActivity } from '../../services/community';
import { useTranslation } from '../../i18n/useTranslation';
import { Avatar } from '../ui/Avatar';
import { CommunitySessionCard, useCommunityColors } from './CommunityUI';
import { MixListItem } from './MixListItem';
import { MixPlayer } from './MixPlayer';
export function CommunityActivityFeed({
    items,
}: {
    items: CommunityActivity[];
}) {
    const c = useCommunityColors();
    const { t, currentLanguage } = useTranslation();
    const router = useRouter();
    const [focused, setFocused] = useState(false);
    const [active, setActive] = useState<string | null>(null);
    useFocusEffect(
        useCallback(() => {
            setFocused(true);
            return () => {
                setFocused(false);
                setActive(null);
            };
        }, []),
    );
    return (
        <View style={{ gap: 16 }}>
            {items.map((item) => {
                if (item.kind === 'session')
                    return (
                        <CommunitySessionCard
                            key={`session-${item.id}`}
                            item={item.payload}
                        />
                    );
                const mix = item.payload;
                const playing = focused && active === item.id;
                return (
                    <View
                        key={`mix-${item.id}`}
                        style={{
                            backgroundColor: c.card,
                            borderWidth: 1,
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
                            onPress={() =>
                                router.push(`/community/${mix.user_id}`)
                            }
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
                                    style={{
                                        color: c.fg,
                                        fontWeight: '700',
                                        fontSize: 14,
                                    }}
                                >
                                    {mix.artist_name}
                                </Text>
                                <Text style={{ color: c.muted, fontSize: 11 }}>
                                    {t('communityActivity.sharedMix')} ·{' '}
                                    {new Date(
                                        item.published_at,
                                    ).toLocaleDateString(currentLanguage, {
                                        day: 'numeric',
                                        month: 'short',
                                    })}
                                </Text>
                            </View>
                        </TouchableOpacity>
                        <MixListItem
                            mix={mix}
                            focused={focused}
                            active={playing}
                            onPress={() => setActive(playing ? null : item.id)}
                        />
                        {playing && (
                            <MixPlayer
                                source={mix}
                                title={mix.title}
                                autoPlay
                            />
                        )}
                    </View>
                );
            })}
        </View>
    );
}
