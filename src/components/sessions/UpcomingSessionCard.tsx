import {
    sessionDisplayTitle,
    sessionDisplaySubtitle,
} from '../../utils/sessionNaming';
import { useState } from 'react';
import {
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../i18n/useTranslation';
import type { Session } from '../../types/session';
import { sessionEarnings } from '../../utils/sessionPlanning';
import { PosterThumbnail } from './PosterThumbnail';
import { SessionStatusBadge } from './SessionStatusBadge';

export function UpcomingSessionCard({
    session,
    onPress,
    onLongPress,
}: {
    session: Session;
    onPress: () => void;
    onLongPress?: () => void;
}) {
    const [failedPosterUri, setFailedPosterUri] = useState<string | null>(null);
    const showPoster =
        !!session.poster_url && session.poster_url !== failedPosterUri;
    const { activeTheme } = useTheme();
    const { t, currentLanguage } = useTranslation();
    const subtitle = sessionDisplaySubtitle(session);
    const { fontScale } = useWindowDimensions();
    const cardHeight = Math.round(128 * Math.max(1, fontScale));
    const dark = activeTheme === 'dark';
    const fg = dark ? '#f3f4f8' : '#202538';
    const muted = dark ? '#a8b2c6' : '#6d7588';
    const [year, month, day] = session.date.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const fee = session.status === 'cancelled' ? 0 : sessionEarnings(session);
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${sessionDisplayTitle(session, t)}, ${subtitle}, ${date.toLocaleDateString(currentLanguage)}, ${session.start_time.slice(0, 5)}–${session.end_time.slice(0, 5)}`}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.8}
            style={{
                height: cardHeight,
                overflow: 'hidden',
                padding: 12,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: dark ? '#252d40' : '#e9ecf3',
                backgroundColor: dark ? '#171d2c' : '#fff',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
            }}
        >
            <View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 5,
                    backgroundColor: session.color || '#262626',
                }}
            />
            {showPoster && (
                <PosterThumbnail
                    uri={session.poster_url}
                    color={session.color}
                    width={76.5}
                    height={cardHeight - 26}
                    onError={() =>
                        setFailedPosterUri(session.poster_url || null)
                    }
                />
            )}
            <View
                style={{
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    justifyContent: 'center',
                    gap: 5,
                }}
            >
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                    }}
                >
                    <Text
                        numberOfLines={1}
                        style={{
                            flexShrink: 1,
                            color: dark ? '#bdb0f5' : '#6554df',
                            fontSize: 11,
                            lineHeight: 14,
                            fontWeight: '800',
                            letterSpacing: 0.2,
                            textTransform: 'uppercase',
                        }}
                    >
                        {date.toLocaleDateString(currentLanguage, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                        })}
                    </Text>
                    <SessionStatusBadge session={session} compact showOngoing />
                </View>
                <View style={{ gap: 2 }}>
                    <Text
                        numberOfLines={2}
                        style={{
                            color: fg,
                            fontSize: 15,
                            lineHeight: 19,
                            fontWeight: '700',
                            letterSpacing: -0.2,
                        }}
                    >
                        {sessionDisplayTitle(session, t)}
                    </Text>
                    {!!subtitle && (
                        <Text
                            numberOfLines={1}
                            style={{
                                color: muted,
                                fontSize: 11,
                                lineHeight: 15,
                            }}
                        >
                            {subtitle}
                        </Text>
                    )}
                </View>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                    }}
                >
                    <Text
                        numberOfLines={1}
                        style={{
                            color: muted,
                            fontSize: 10,
                            lineHeight: 14,
                            flexShrink: 0,
                        }}
                    >
                        {session.start_time.slice(0, 5)} –{' '}
                        {session.end_time.slice(0, 5)}
                    </Text>
                    {session.is_guest ? (
                        <Text
                            numberOfLines={1}
                            style={{
                                color: muted,
                                fontSize: 10,
                                lineHeight: 14,
                                flexShrink: 1,
                            }}
                        >
                            {t('collaboration.guestSession')}
                        </Text>
                    ) : session.earning_type !== 'free' ? (
                        <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                            style={{
                                color: fg,
                                fontSize: 14,
                                lineHeight: 17,
                                fontWeight: '700',
                                flexShrink: 1,
                            }}
                        >
                            {session.earning_type === 'agreement' &&
                            !session.fee_agreement?.settled
                                ? '—'
                                : new Intl.NumberFormat(currentLanguage, {
                                      maximumFractionDigits: 2,
                                  }).format(fee)}{' '}
                            {session.earning_type === 'agreement' &&
                            !session.fee_agreement?.settled
                                ? ''
                                : session.currency || '€'}
                        </Text>
                    ) : null}
                </View>
            </View>
        </TouchableOpacity>
    );
}
