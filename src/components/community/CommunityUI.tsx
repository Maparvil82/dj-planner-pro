import {
    sessionDisplayTitle,
    sessionDisplaySubtitle,
} from '../../utils/sessionNaming';
import { PosterFrameImage } from '../sessions/PosterFrameImage';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ChevronRight, CalendarDays } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../i18n/useTranslation';
import { Avatar } from '../ui/Avatar';
import type {
    CommunityProfile,
    CommunitySession,
} from '../../services/community';
export function useCommunityColors() {
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    return {
        dark,
        bg: dark ? '#0d1220' : '#f5f6fa',
        card: dark ? '#171d2c' : '#fff',
        field: dark ? '#111625' : '#f8f9fd',
        fg: dark ? '#f3f4f8' : '#202538',
        muted: dark ? '#a8b2c6' : '#6d7588',
        border: dark ? '#252d40' : '#e9ecf3',
        accent: dark ? '#bdb0f5' : '#6554df',
        tint: dark ? '#292743' : '#f0edfc',
    };
}
export function CommunityButton({
    label,
    onPress,
    disabled = false,
    busy = false,
    secondary = false,
    accessibilityLabel,
    compact = false,
    outlined = false,
}: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    busy?: boolean;
    secondary?: boolean;
    accessibilityLabel?: string;
    compact?: boolean;
    outlined?: boolean;
}) {
    const c = useCommunityColors();
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || label}
            accessibilityState={{ disabled: disabled || busy, busy }}
            disabled={disabled || busy}
            onPress={onPress}
            style={{
                minHeight: compact ? 44 : 46,
                paddingHorizontal: compact ? 8 : 16,
                paddingVertical: compact ? 8 : 12,
                borderRadius: 14,
                backgroundColor: outlined
                    ? 'transparent'
                    : secondary
                      ? c.tint
                      : '#6554df',
                borderWidth: outlined ? 1 : 0,
                borderColor: c.accent,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: disabled || busy ? 0.5 : 1,
            }}
        >
            {busy ? (
                <ActivityIndicator
                    color={secondary || outlined ? c.accent : '#fff'}
                />
            ) : (
                <Text
                    style={{
                        color: secondary || outlined ? c.accent : '#fff',
                        fontSize: compact ? 12 : 13,
                        fontWeight: '700',
                        textAlign: 'center',
                    }}
                >
                    {label}
                </Text>
            )}
        </TouchableOpacity>
    );
}
export function CommunityMessage({
    title,
    hint,
    loading = false,
    retry,
}: {
    title: string;
    hint?: string;
    loading?: boolean;
    retry?: () => void;
}) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    return (
        <View
            style={{
                padding: 24,
                borderRadius: 24,
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.border,
                alignItems: 'center',
                gap: 12,
            }}
        >
            {loading && <ActivityIndicator color={c.accent} />}
            <Text
                style={{
                    color: c.fg,
                    fontSize: 16,
                    fontWeight: '700',
                    textAlign: 'center',
                }}
            >
                {title}
            </Text>
            {hint && (
                <Text
                    style={{
                        color: c.muted,
                        lineHeight: 20,
                        textAlign: 'center',
                    }}
                >
                    {hint}
                </Text>
            )}
            {retry && (
                <CommunityButton
                    label={t('insights.retry')}
                    onPress={retry}
                    secondary
                />
            )}
        </View>
    );
}
export function CommunityProfileCard({
    profile,
    sessionCount,
    following,
    own,
    busy,
    disabled = false,
    onFollow,
}: {
    profile: CommunityProfile;
    sessionCount?: number;
    following: boolean;
    own: boolean;
    busy: boolean;
    disabled?: boolean;
    onFollow: () => void;
}) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const router = useRouter();
    const [failedImage, setFailedImage] = useState<string | null>(null);
    const [failedCover, setFailedCover] = useState<string | null>(null);
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: c.card,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: c.border,
                overflow: 'hidden',
            }}
        >
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`${t('community.viewProfile')}: ${profile.artist_name}`}
                onPress={() => router.push(`/community/${profile.user_id}`)}
            >
                <View style={{ height: 56, backgroundColor: c.tint }}>
                    <LinearGradient
                        colors={[c.tint, c.dark ? '#463467' : '#dcd5f6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ position: 'absolute', inset: 0 }}
                    />
                    {profile.cover_url && failedCover !== profile.cover_url && (
                        <Image
                            source={{ uri: profile.cover_url }}
                            resizeMode="cover"
                            onError={() => setFailedCover(profile.cover_url)}
                            style={{ width: '100%', height: '100%' }}
                        />
                    )}
                    <View
                        accessible
                        accessibilityLabel={
                            sessionCount === undefined
                                ? t('community.loading')
                                : `${sessionCount} ${t('community.sessions')}`
                        }
                        style={{
                            position: 'absolute',
                            top: 7,
                            right: 7,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: 'rgba(16,18,28,0.62)',
                            borderRadius: 16,
                            paddingHorizontal: 7,
                            paddingVertical: 4,
                        }}
                    >
                        <CalendarDays size={11} color="#fff" />
                        <Text
                            style={{
                                color: '#fff',
                                fontSize: 10,
                                fontWeight: '700',
                            }}
                        >
                            {sessionCount === undefined ? '—' : sessionCount}
                        </Text>
                    </View>
                </View>
                <View
                    style={{
                        alignItems: 'center',
                        paddingHorizontal: 10,
                        gap: 3,
                        paddingBottom: 10,
                    }}
                >
                    <View
                        style={{
                            width: 64,
                            height: 64,
                            marginTop: -32,
                            marginBottom: 5,
                            borderRadius: 32,
                            borderWidth: 3,
                            borderColor: c.card,
                            backgroundColor: c.tint,
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {profile.avatar_url &&
                        failedImage !== profile.avatar_url ? (
                            <Image
                                source={{ uri: profile.avatar_url }}
                                resizeMode="cover"
                                onError={() =>
                                    setFailedImage(profile.avatar_url)
                                }
                                style={{ width: '100%', height: '100%' }}
                            />
                        ) : (
                            <Text
                                style={{
                                    color: c.accent,
                                    fontSize: 24,
                                    fontWeight: '700',
                                }}
                            >
                                {profile.artist_name
                                    .trim()
                                    .charAt(0)
                                    .toUpperCase()}
                            </Text>
                        )}
                    </View>
                    <Text
                        numberOfLines={2}
                        style={{
                            color: c.fg,
                            fontSize: 14,
                            lineHeight: 18,
                            minHeight: 36,
                            fontWeight: '700',
                            textAlign: 'center',
                        }}
                    >
                        {profile.artist_name}
                    </Text>
                    <Text
                        numberOfLines={1}
                        style={{
                            color: c.muted,
                            fontSize: 11,
                            lineHeight: 15,
                            textAlign: 'center',
                        }}
                    >
                        {[profile.city, profile.city_location?.country]
                            .filter(Boolean)
                            .join(' · ')}
                    </Text>
                    <Text
                        numberOfLines={1}
                        style={{
                            color: c.accent,
                            fontSize: 11,
                            lineHeight: 15,
                            textAlign: 'center',
                        }}
                    >
                        {profile.genres}
                    </Text>
                </View>
            </TouchableOpacity>
            <View style={{ padding: 10, paddingTop: 0, marginTop: 'auto' }}>
                {!own ? (
                    <CommunityButton
                        compact
                        outlined={!following}
                        label={t(
                            following
                                ? 'community.unfollow'
                                : 'community.follow',
                        )}
                        accessibilityLabel={`${t(following ? 'community.unfollow' : 'community.follow')} ${profile.artist_name}`}
                        onPress={onFollow}
                        busy={busy}
                        disabled={disabled}
                        secondary={following}
                    />
                ) : (
                    <Text
                        style={{
                            color: c.muted,
                            fontSize: 12,
                            textAlign: 'center',
                            paddingVertical: 14,
                        }}
                    >
                        {t('community.myProfile')}
                    </Text>
                )}
            </View>
        </View>
    );
}

export function CommunitySessionCard({
    item,
    showAuthor = true,
}: {
    item: CommunitySession;
    showAuthor?: boolean;
}) {
    const c = useCommunityColors();
    const { t, currentLanguage } = useTranslation();
    const router = useRouter();
    const subtitle = sessionDisplaySubtitle(item);
    const date = new Date(`${item.date}T12:00:00`);
    const dateLabel = Number.isNaN(date.getTime())
        ? item.date
        : date.toLocaleDateString(currentLanguage, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
          });
    return (
        <View
            style={{
                backgroundColor: c.card,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: c.border,
                overflow: 'hidden',
            }}
        >
            {showAuthor && (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${t('community.viewProfile')}: ${item.artist_name}`}
                    onPress={() => router.push(`/community/${item.author_id}`)}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        padding: 18,
                    }}
                >
                    <Avatar name={item.artist_name} url={item.avatar_url} />
                    <View style={{ flex: 1 }}>
                        <Text
                            style={{
                                color: c.fg,
                                fontWeight: '700',
                                fontSize: 14,
                            }}
                        >
                            {item.artist_name}
                        </Text>
                        <Text
                            style={{
                                color: c.muted,
                                fontSize: 11,
                                marginTop: 3,
                            }}
                        >
                            {t('community.sharedSession')}
                        </Text>
                    </View>
                    <ChevronRight size={17} color={c.muted} />
                </TouchableOpacity>
            )}
            {!!item.poster_url && (
                <PosterFrameImage
                    uri={item.poster_url!}
                    x={item.poster_focus_x}
                    y={item.poster_focus_y}
                />
            )}
            <View
                style={{
                    padding: 18,
                    paddingTop: item.poster_url || !showAuthor ? 18 : 0,
                    gap: 12,
                }}
            >
                <Text
                    style={{
                        color: c.fg,
                        fontSize: 21,
                        fontWeight: '800',
                        letterSpacing: -0.5,
                    }}
                >
                    {sessionDisplayTitle(item, t)}
                </Text>
                {!!subtitle && (
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <Text style={{ color: c.muted, fontSize: 13, flex: 1 }}>
                            {subtitle}
                            {item.title?.trim() && item.city
                                ? ` · ${item.city}`
                                : ''}
                        </Text>
                    </View>
                )}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <Text style={{ color: c.fg, fontSize: 13 }}>
                        {dateLabel}
                    </Text>
                </View>
                {!!item.collaborators?.length && (
                    <View
                        style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 8,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{ color: c.muted, fontSize: 12 }}>
                            {t('collaboration.with')}
                        </Text>
                        {item.collaborators.map((person) => (
                            <TouchableOpacity
                                key={person.user_id}
                                accessibilityRole="button"
                                accessibilityLabel={`${t('community.viewProfile')}: ${person.artist_name}`}
                                onPress={() =>
                                    router.push(`/community/${person.user_id}`)
                                }
                                style={{
                                    paddingVertical: 7,
                                    paddingHorizontal: 10,
                                    borderRadius: 12,
                                    backgroundColor: c.tint,
                                }}
                            >
                                <Text
                                    style={{
                                        color: c.accent,
                                        fontSize: 12,
                                        fontWeight: '600',
                                    }}
                                >
                                    {person.artist_name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
                {!!item.start_time && (
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <Text style={{ color: c.muted, fontSize: 13, flex: 1 }}>
                            {item.start_time}
                            {item.end_time ? ` – ${item.end_time}` : ''}
                            {item.end_time && item.end_time <= item.start_time
                                ? ` · ${t('community.nextDay')}`
                                : ''}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}
