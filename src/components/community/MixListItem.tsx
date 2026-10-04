import { useState } from 'react';
import {
    Image,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Play, X } from 'lucide-react-native';
import type { ProfileMix } from '../../services/profileMixes';
import { fetchMixMetadata, mixDuration } from '../../services/mixMetadata';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from './CommunityUI';

export function MixListItem({
    mix,
    active,
    focused,
    onPress,
}: {
    mix: ProfileMix;
    active: boolean;
    focused: boolean;
    onPress: () => void;
}) {
    const c = useCommunityColors();
    const { t, currentLanguage } = useTranslation();
    const { width } = useWindowDimensions();
    const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
    const metadata = useQuery({
        queryKey: ['mix-metadata', mix.platform, mix.source_url],
        queryFn: ({ signal }) => fetchMixMetadata(mix, signal),
        enabled: focused,
        staleTime: 60 * 60 * 1000,
        retry: false,
    });
    const data = metadata.data;
    const artwork = data?.artwork;
    const size = width < 360 ? 84 : 104;
    const platform = mix.platform === 'mixcloud' ? 'Mixcloud' : 'SoundCloud';
    const stats = [
        data?.duration != null ? mixDuration(data.duration) : null,
        data?.plays != null
            ? `${data.plays.toLocaleString(currentLanguage)} ${t('profileMixes.plays')}`
            : null,
    ]
        .filter(Boolean)
        .join(' · ');
    return (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View
                style={{
                    width: size,
                    height: size,
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: c.tint,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {artwork && failedArtwork !== artwork ? (
                    <Image
                        source={{ uri: artwork }}
                        resizeMode="cover"
                        onError={() => setFailedArtwork(artwork)}
                        style={{ width: '100%', height: '100%' }}
                        accessibilityLabel={mix.title}
                    />
                ) : (
                    <Text
                        style={{
                            color: c.accent,
                            fontSize: 28,
                            fontWeight: '700',
                        }}
                    >
                        {mix.title.trim().charAt(0).toUpperCase()}
                    </Text>
                )}
            </View>
            <View style={{ flex: 1, gap: 6 }}>
                <Text
                    numberOfLines={1}
                    style={{ fontSize: 11, color: c.muted }}
                >
                    {data?.author || platform}
                </Text>
                <Text
                    numberOfLines={2}
                    style={{
                        color: c.fg,
                        fontSize: 15,
                        lineHeight: 20,
                        fontWeight: '700',
                    }}
                >
                    {mix.title}
                </Text>
                {!!data?.genres.length && (
                    <View
                        style={{
                            flexDirection: 'row',
                            gap: 4,
                            flexWrap: 'wrap',
                        }}
                    >
                        {data.genres.slice(0, 2).map((genre, index) => (
                            <View
                                key={`${genre}-${index}`}
                                style={{
                                    backgroundColor: c.field,
                                    borderRadius: 12,
                                    paddingHorizontal: 7,
                                    paddingVertical: 3,
                                    maxWidth: '100%',
                                }}
                            >
                                <Text
                                    numberOfLines={1}
                                    style={{ color: c.muted, fontSize: 10 }}
                                >
                                    {genre}
                                </Text>
                            </View>
                        ))}
                        {data.genres.length > 2 && (
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 11,
                                    paddingVertical: 3,
                                }}
                            >
                                +{data.genres.length - 2}
                            </Text>
                        )}
                    </View>
                )}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                    }}
                >
                    <View style={{ flex: 1, gap: 3 }}>
                        <Text
                            style={{
                                color: c.muted,
                                fontSize: 10,
                                lineHeight: 14,
                            }}
                        >
                            {stats || platform}
                        </Text>
                        {!!stats && (
                            <Text style={{ color: c.accent, fontSize: 10 }}>
                                {platform}
                            </Text>
                        )}
                    </View>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={t(
                            active
                                ? 'profileMixes.closePlayer'
                                : 'profileMixes.listen',
                        )}
                        accessibilityState={{ expanded: active }}
                        onPress={onPress}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: active ? c.tint : '#6554df',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {active ? (
                            <X size={19} color={c.accent} />
                        ) : (
                            <Play size={18} fill="#fff" color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
