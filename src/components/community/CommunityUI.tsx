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
}: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    busy?: boolean;
    secondary?: boolean;
    accessibilityLabel?: string;
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
                minHeight: 46,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: secondary ? c.tint : '#6554df',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: disabled || busy ? 0.5 : 1,
            }}
        >
            {busy ? (
                <ActivityIndicator color={secondary ? c.accent : '#fff'} />
            ) : (
                <Text
                    style={{
                        color: secondary ? c.accent : '#fff',
                        fontSize: 13,
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
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: c.card,
                borderRadius: 26,
                shadowColor: '#202538',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: c.dark ? 0 : 0.05,
                shadowRadius: 12,
                elevation: 2,
                borderWidth: 1,
                borderColor: c.border,
            }}
        >
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`${t('community.viewProfile')}: ${profile.artist_name}`}
                onPress={() => router.push(`/community/${profile.user_id}`)}
            >
                <View
                    style={{
                        aspectRatio: 0.92,
                        margin: 7,
                        marginBottom: 0,
                        borderRadius: 20,
                        overflow: 'hidden',
                        backgroundColor: c.tint,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {profile.avatar_url &&
                    failedImage !== profile.avatar_url ? (
                        <Image
                            source={{ uri: profile.avatar_url }}
                            resizeMode="cover"
                            onError={() => setFailedImage(profile.avatar_url)}
                            style={{ width: '100%', height: '100%' }}
                        />
                    ) : (
                        <Text
                            style={{
                                color: c.accent,
                                fontWeight: '800',
                                fontSize: 38,
                            }}
                        >
                            {profile.artist_name.trim().charAt(0).toUpperCase()}
                        </Text>
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
                            top: 9,
                            right: 9,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            backgroundColor: 'rgba(16,18,28,0.62)',
                            borderRadius: 20,
                            paddingHorizontal: 8,
                            paddingVertical: 5,
                        }}
                    >
                        <CalendarDays size={12} color="#fff" />
                        <Text
                            style={{
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: '700',
                            }}
                        >
                            {sessionCount === undefined ? '—' : sessionCount}
                        </Text>
                    </View>
                </View>
                <View style={{ padding: 13, paddingBottom: 8, gap: 6 }}>
                    <Text
                        numberOfLines={2}
                        style={{
                            color: c.fg,
                            fontSize: 16,
                            lineHeight: 20,
                            fontWeight: '800',
                        }}
                    >
                        {profile.artist_name}
                    </Text>
                    <Text
                        numberOfLines={2}
                        style={{
                            color: c.muted,
                            fontSize: 12,
                            lineHeight: 16,
                        }}
                    >
                        {[profile.city, profile.city_location?.country]
                            .filter(Boolean)
                            .join(' · ')}
                    </Text>
                    <Text
                        numberOfLines={2}
                        style={{
                            color: c.accent,
                            fontSize: 12,
                            lineHeight: 16,
                        }}
                    >
                        {profile.genres}
                    </Text>
                </View>
            </TouchableOpacity>
            <View style={{ padding: 12, paddingTop: 2, marginTop: 'auto' }}>
                {!own ? (
                    <CommunityButton
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
                    <View
                        style={{
                            minHeight: 46,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text style={{ color: c.muted, fontSize: 12 }}>
                            {t('community.myProfile')}
                        </Text>
                    </View>
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
