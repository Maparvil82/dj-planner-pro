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
import { useCommunityColors } from './CommunityUI';
import type { ReactNode } from 'react';

export function DJProfileHero({
    person,
    action,
}: {
    person: CommunityProfile;
    action: ReactNode;
}) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const [failedCover, setFailedCover] = useState<string | null>(null);
    const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
    const [linkError, setLinkError] = useState(false);
    const genres = person.genres
        .split(/[,·;|]/)
        .map((value) => value.trim())
        .filter(Boolean);
    return (
        <View style={{ gap: 18 }}>
            <View
                style={{
                    backgroundColor: c.card,
                    borderRadius: 28,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: c.border,
                }}
            >
                <View style={{ height: 220, backgroundColor: '#241d4a' }}>
                    <LinearGradient
                        colors={['#302765', '#6554df', '#c07fa6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ position: 'absolute', inset: 0 }}
                    />
                    {person.cover_url && failedCover !== person.cover_url ? (
                        <Image
                            source={{ uri: person.cover_url }}
                            onError={() => setFailedCover(person.cover_url)}
                            accessibilityLabel={t('djPage.cover')}
                            resizeMode="cover"
                            style={{ width: '100%', height: '100%' }}
                        />
                    ) : null}
                    <LinearGradient
                        colors={['transparent', 'rgba(13,18,32,0.55)']}
                        style={{ position: 'absolute', inset: 0 }}
                    />
                    <View
                        style={{
                            position: 'absolute',
                            top: 18,
                            left: 18,
                            backgroundColor: 'rgba(13,18,32,0.45)',
                            borderRadius: 20,
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                        }}
                    >
                        <Text
                            style={{
                                color: '#fff',
                                fontWeight: '700',
                                fontSize: 11,
                                letterSpacing: 1.4,
                            }}
                        >
                            DJ PLANNER PRO
                        </Text>
                    </View>
                </View>
                <View style={{ padding: 22, paddingTop: 0, gap: 16 }}>
                    <View
                        style={{
                            marginTop: -46,
                            width: 96,
                            height: 96,
                            borderRadius: 30,
                            borderWidth: 5,
                            borderColor: c.card,
                            backgroundColor: c.tint,
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
                                    fontSize: 32,
                                    fontWeight: '800',
                                    color: c.accent,
                                }}
                            >
                                {person.artist_name
                                    .trim()
                                    .charAt(0)
                                    .toUpperCase()}
                            </Text>
                        )}
                    </View>
                    <View style={{ gap: 9 }}>
                        <Text
                            style={{
                                color: c.fg,
                                fontSize: 32,
                                fontWeight: '800',
                                letterSpacing: -1,
                            }}
                        >
                            {person.artist_name}
                        </Text>
                        {!!person.city && (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    gap: 6,
                                    alignItems: 'center',
                                }}
                            >
                                <Text
                                    style={{
                                        color: c.muted,
                                        fontSize: 14,
                                        flex: 1,
                                    }}
                                >
                                    {person.city}
                                </Text>
                            </View>
                        )}
                    </View>
                    {genres.length > 0 && (
                        <View
                            style={{
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                gap: 7,
                            }}
                        >
                            {genres.map((genre, index) => (
                                <View
                                    key={`${genre}-${index}`}
                                    style={{
                                        backgroundColor: c.tint,
                                        paddingHorizontal: 12,
                                        paddingVertical: 7,
                                        borderRadius: 20,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: c.accent,
                                            fontSize: 12,
                                            fontWeight: '600',
                                        }}
                                    >
                                        {genre}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                    {action}
                </View>
            </View>
            {!!person.bio && (
                <View
                    style={{
                        borderRadius: 24,
                        backgroundColor: c.card,
                        padding: 22,
                        gap: 12,
                        borderWidth: 1,
                        borderColor: c.border,
                    }}
                >
                    <Text
                        style={{ color: c.fg, fontSize: 18, fontWeight: '800' }}
                    >
                        {t('djPage.about')}
                    </Text>
                    <Text
                        style={{ color: c.muted, fontSize: 15, lineHeight: 24 }}
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
