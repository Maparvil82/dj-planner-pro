import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Headphones,
    Instagram,
    Cloud,
    ArrowUpRight,
} from 'lucide-react-native';
import type { CommunityProfile } from '../../services/community';
import { useTranslation } from '../../i18n/useTranslation';
import { DJ_PLATFORMS, normalizeDJLink } from '../../utils/communityLinks';
import { cityLabel } from '../../utils/cities';
import { useCommunityColors } from './CommunityUI';
import type { ReactNode } from 'react';

export function DJProfileHero({
    person,
    action,
    sessionCount,
}: {
    person: CommunityProfile;
    action: ReactNode;
    sessionCount?: number;
}) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const [failedCover, setFailedCover] = useState<string | null>(null);
    const cover = person.cover_url || person.avatar_url;
    const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
    const genres = person.genres
        .split(/[,·;|]/)
        .map((value) => value.trim())
        .filter(Boolean);
    return (
        <View style={{ backgroundColor: c.bg }}>
            <View
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 285,
                    backgroundColor: '#302765',
                }}
            >
                <LinearGradient
                    colors={['#302765', '#6554df', '#906aad']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ position: 'absolute', inset: 0 }}
                />
                {cover && failedCover !== cover && (
                    <Image
                        source={{ uri: cover }}
                        onError={() => setFailedCover(cover)}
                        accessibilityLabel={t('djPage.cover')}
                        resizeMode="cover"
                        style={{ width: '100%', height: '100%' }}
                    />
                )}
                <LinearGradient
                    colors={['rgba(0,0,0,0.22)', 'transparent', c.bg]}
                    locations={[0, 0.3, 1]}
                    style={{ position: 'absolute', inset: 0 }}
                />
            </View>
            <View
                style={{
                    paddingTop: 180,
                    paddingHorizontal: 20,
                    paddingBottom: 12,
                    gap: 12,
                }}
            >
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    <View
                        style={{
                            width: 76,
                            height: 76,
                            borderRadius: 38,
                            backgroundColor: c.tint,
                            borderWidth: 2,
                            borderColor: c.card,
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {person.avatar_url &&
                        failedAvatar !== person.avatar_url ? (
                            <Image
                                source={{ uri: person.avatar_url }}
                                onError={() =>
                                    setFailedAvatar(person.avatar_url)
                                }
                                resizeMode="cover"
                                style={{ width: '100%', height: '100%' }}
                            />
                        ) : (
                            <Text
                                style={{
                                    color: c.accent,
                                    fontSize: 30,
                                    fontWeight: '700',
                                }}
                            >
                                {person.artist_name
                                    .trim()
                                    .charAt(0)
                                    .toUpperCase()}
                            </Text>
                        )}
                    </View>
                    <View style={{ flex: 1, gap: 5 }}>
                        <Text
                            style={{
                                color: c.fg,
                                fontSize: 30,
                                lineHeight: 35,
                                fontWeight: '800',
                                letterSpacing: -0.8,
                            }}
                        >
                            {person.artist_name}
                        </Text>
                        <Text
                            style={{
                                color: c.muted,
                                fontSize: 12,
                                lineHeight: 17,
                            }}
                        >
                            {cityLabel(person.city, person.city_location)}
                        </Text>
                    </View>
                </View>
                {sessionCount !== undefined && sessionCount > 0 && (
                    <Text style={{ color: c.muted, fontSize: 12 }}>
                        {sessionCount}{' '}
                        {t(
                            sessionCount === 1
                                ? 'djPage.publishedSession'
                                : 'djPage.publishedSessions',
                        )}
                    </Text>
                )}
                {action}
                {!!genres.length && (
                    <View
                        style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 6,
                        }}
                    >
                        {genres.map((genre, index) => (
                            <View
                                key={`${genre}-${index}`}
                                style={{
                                    backgroundColor: c.tint,
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 18,
                                }}
                            >
                                <Text style={{ color: c.accent, fontSize: 11 }}>
                                    {genre}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
}

export function DJProfileDetails({ person }: { person: CommunityProfile }) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const [linkError, setLinkError] = useState(false);
    if (
        !person.bio &&
        !DJ_PLATFORMS.some((platform) => person[`${platform}_url`])
    )
        return null;
    return (
        <View style={{ gap: 18 }}>
            {!!person.bio && (
                <View
                    style={{
                        gap: 8,
                    }}
                >
                    <Text
                        style={{ color: c.fg, fontSize: 18, fontWeight: '800' }}
                    >
                        {t('djPage.about')}
                    </Text>
                    <Text
                        style={{ color: c.muted, fontSize: 14, lineHeight: 22 }}
                    >
                        {person.bio}
                    </Text>
                </View>
            )}
            {DJ_PLATFORMS.some((platform) => person[`${platform}_url`]) && (
                <View style={{ gap: 12 }}>
                    <Text
                        style={{
                            color: c.fg,
                            fontSize: 18,
                            fontWeight: '800',
                            paddingHorizontal: 4,
                        }}
                    >
                        {t('djPage.connect')}
                    </Text>
                    <View
                        style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 10,
                        }}
                    >
                        {DJ_PLATFORMS.map((platform) => {
                            let url: string;
                            try {
                                url = normalizeDJLink(
                                    person[`${platform}_url`] || '',
                                    platform,
                                );
                            } catch {
                                return null;
                            }
                            if (!url) return null;
                            const label =
                                platform === 'mixcloud'
                                    ? 'Mixcloud'
                                    : platform === 'soundcloud'
                                      ? 'SoundCloud'
                                      : 'Instagram';
                            const Icon =
                                platform === 'instagram'
                                    ? Instagram
                                    : platform === 'mixcloud'
                                      ? Headphones
                                      : Cloud;
                            return (
                                <TouchableOpacity
                                    key={platform}
                                    accessibilityRole="link"
                                    accessibilityLabel={t('djPage.openLink', {
                                        platform: label,
                                    })}
                                    onPress={async () => {
                                        setLinkError(false);
                                        try {
                                            await Linking.openURL(url);
                                        } catch {
                                            setLinkError(true);
                                        }
                                    }}
                                    style={{
                                        flexGrow: 1,
                                        flexBasis: 135,
                                        minHeight: 72,
                                        backgroundColor: c.card,
                                        borderColor: c.border,
                                        borderWidth: 1,
                                        borderRadius: 20,
                                        padding: 15,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 10,
                                    }}
                                >
                                    <Icon size={21} color={c.accent} />
                                    <Text
                                        style={{
                                            flex: 1,
                                            color: c.fg,
                                            fontSize: 13,
                                            fontWeight: '700',
                                        }}
                                    >
                                        {label}
                                    </Text>
                                    <ArrowUpRight size={16} color={c.muted} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    {linkError && (
                        <Text
                            accessibilityRole="alert"
                            style={{ color: c.muted, fontSize: 13 }}
                        >
                            {t('djPage.linkError')}
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
}
