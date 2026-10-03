import {
    sessionDisplayTitle,
    sessionDisplaySubtitle,
} from '../../utils/sessionNaming';
import { UpcomingSessionCard } from './UpcomingSessionCard';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../i18n/useTranslation';
import type { Session } from '../../types/session';
import { sessionEarnings } from '../../utils/sessionPlanning';
import { SessionStatusBadge } from './SessionStatusBadge';

export function SessionPreviewCard({
    session,
    onPress,
    onLongPress,
    showDjs = false,
    showPoster = false,
}: {
    session: Session;
    onPress: () => void;
    onLongPress?: () => void;
    showDjs?: boolean;
    showPoster?: boolean;
}) {
    const { activeTheme } = useTheme();
    const { t, currentLanguage } = useTranslation();
    const subtitle = sessionDisplaySubtitle(session);
    const dark = activeTheme === 'dark';
    const text = dark ? '#f3f4f8' : '#202538';
    const muted = dark ? '#a8b2c6' : '#6d7588';
    const [year, month, day] = session.date.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const weekday = date.toLocaleDateString(currentLanguage, {
        weekday: 'short',
    });
    const monthName = date.toLocaleDateString(currentLanguage, {
        month: 'short',
    });
    const fee = session.status === 'cancelled' ? 0 : sessionEarnings(session);
    if (showPoster)
        return (
            <UpcomingSessionCard
                session={session}
                onPress={onPress}
                onLongPress={onLongPress}
            />
        );
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${sessionDisplayTitle(session, t)}, ${subtitle}, ${date.toLocaleDateString(currentLanguage)}`}
            activeOpacity={0.8}
            onPress={onPress}
            onLongPress={onLongPress}
            style={{
                overflow: 'hidden',
                borderRadius: 24,
                borderWidth: 1,
                borderColor: dark ? '#252d40' : '#e9ecf3',
                backgroundColor: dark ? '#171d2c' : '#fff',
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
            <View style={{ padding: 18, gap: 16 }}>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                    }}
                >
                    <View
                        style={{
                            width: 64,
                            paddingVertical: 9,
                            borderRadius: 18,
                            alignItems: 'center',
                            backgroundColor: dark ? '#292743' : '#f0edfc',
                            gap: 2,
                        }}
                    >
                        <Text
                            style={{
                                color: dark ? '#bdb0f5' : '#7666df',
                                fontSize: 10,
                                fontWeight: '700',
                                textTransform: 'uppercase',
                            }}
                        >
                            {weekday}
                        </Text>
                        <Text
                            style={{
                                color: text,
                                fontSize: 27,
                                fontWeight: '800',
                                lineHeight: 31,
                            }}
                        >
                            {day}
                        </Text>
                        <Text
                            style={{
                                color: muted,
                                fontSize: 10,
                                textTransform: 'uppercase',
                            }}
                        >
                            {monthName}
                        </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 7,
                            }}
                        >
                            <Text
                                numberOfLines={2}
                                style={{
                                    flex: 1,
                                    color: text,
                                    fontSize: 16,
                                    fontWeight: '700',
                                    lineHeight: 21,
                                }}
                            >
                                {sessionDisplayTitle(session, t)}
                            </Text>
                        </View>
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                            }}
                        >
                            {!!subtitle && (
                                <Text
                                    numberOfLines={1}
                                    style={{
                                        flex: 1,
                                        color: muted,
                                        fontSize: 12,
                                    }}
                                >
                                    {subtitle}
                                </Text>
                            )}
                        </View>
                        <SessionStatusBadge session={session} />
                        {showDjs &&
                        session.is_collective &&
                        session.djs?.length ? (
                            <Text
                                numberOfLines={2}
                                style={{
                                    color: muted,
                                    fontSize: 11,
                                    lineHeight: 15,
                                }}
                            >
                                {session.djs.join(', ')}
                            </Text>
                        ) : null}
                    </View>
                    <ChevronRight
                        size={17}
                        color={dark ? '#657089' : '#afb5c5'}
                    />
                </View>
                <View
                    style={{
                        borderTopWidth: 1,
                        borderTopColor: dark ? '#252d40' : '#f0f1f6',
                        paddingTop: 13,
                        flexDirection: 'row',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10,
                    }}
                >
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <Text
                            style={{
                                color: muted,
                                fontSize: 12,
                                fontWeight: '500',
                            }}
                        >
                            {session.start_time.slice(0, 5)} –{' '}
                            {session.end_time.slice(0, 5)}
                        </Text>
                    </View>
                    {session.is_guest ? (
                        <Text
                            style={{
                                color: muted,
                                fontSize: 11,
                                marginLeft: 'auto',
                            }}
                        >
                            {t('collaboration.guestSession')}
                        </Text>
                    ) : session.earning_type !== 'free' ? (
                        <Text
                            style={{
                                color: text,
                                fontSize: 16,
                                fontWeight: '700',
                                marginLeft: 'auto',
                            }}
                        >
                            {new Intl.NumberFormat(currentLanguage, {
                                maximumFractionDigits: 2,
                            }).format(fee)}{' '}
                            {session.currency || '€'}
                        </Text>
                    ) : null}
                </View>
            </View>
        </TouchableOpacity>
    );
}
