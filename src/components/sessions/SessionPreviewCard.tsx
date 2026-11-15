import { SessionCardDetails } from './SessionCardDetails';
import { SessionAttendanceBadges } from './SessionAttendanceBadges';
import { SessionExpenseBadge } from './SessionExpenses';
import { SessionTaskBadge } from './SessionTaskBadge';
import { SessionPartialPaymentSummary } from './SessionPartialPaymentSummary';
import { useDarkPalette } from '../../contexts/ThemeContext';
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
import { sessionEarnings, sessionPaymentState } from '../../utils/sessionPlanning';
import { SessionStatusBadge } from './SessionStatusBadge';

export function SessionPreviewCard({
    session,
    onPress,
    onLongPress,
    showDjs = false,
    showPoster = false,
    calendarVariant = false,
    hideDate = false,
}: {
    session: Session;
    onPress: () => void;
    onLongPress?: () => void;
    showDjs?: boolean;
    showPoster?: boolean;
    calendarVariant?: boolean;
    hideDate?: boolean;
}) {
    const darkPalette = useDarkPalette();
    const { activeTheme } = useTheme();
    const { t, dateLocale, formatMoney } = useTranslation();
    const subtitle = sessionDisplaySubtitle(session);
    const dark = activeTheme === 'dark';
    const cancelled = session.status === 'cancelled';
    const text = calendarVariant && cancelled ? (dark ? darkPalette.muted : '#687083') : dark ? darkPalette.text : '#202538';
    const muted = dark ? darkPalette.muted : '#6d7588';
    const [year, month, day] = session.date.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const weekday = date.toLocaleDateString(dateLocale, {
        weekday: 'short',
    });
    const monthName = date.toLocaleDateString(dateLocale, {
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
        <View
            testID={`session-card-${session.id}`}
            style={{
                overflow: 'hidden',
                borderRadius: calendarVariant ? 20 : 24,
                borderWidth: dark ? 0 : 1,
                borderColor: dark ? darkPalette.border : '#e9ecf3',
                backgroundColor: calendarVariant && cancelled ? (dark ? darkPalette.surface : '#f8f9fb') : dark ? darkPalette.surface : '#fff',
            }}
        >
            <View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: calendarVariant ? 3 : 5,
                    backgroundColor: calendarVariant && cancelled ? (dark ? darkPalette.border : '#d7dbe4') : session.color || '#262626',
                }}
            />
            <View style={{ paddingHorizontal: calendarVariant ? 16 : 20, paddingVertical: calendarVariant ? 14 : 18, gap: calendarVariant ? 10 : 16 }}>
                <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${sessionDisplayTitle(session, t)}, ${subtitle}, ${date.toLocaleDateString(dateLocale)}`}
            activeOpacity={0.8}
            onPress={onPress}
            onLongPress={onLongPress}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                    }}
                >
                    {!hideDate && <>
                    <View
                        style={{
                            width: calendarVariant ? 46 : 64,
                            paddingVertical: calendarVariant ? 7 : 9,
                            borderRadius: calendarVariant ? 13 : 18,
                            alignItems: 'center',
                            backgroundColor: calendarVariant ? (dark ? darkPalette.raised : '#f1f2f7') : dark ? darkPalette.tint : '#f0edfc',
                            gap: 2,
                        }}
                    >
                        <Text
                            style={{
                                color: dark ? darkPalette.primary : '#7666df',
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
                                fontSize: calendarVariant ? 22 : 27,
                                fontWeight: calendarVariant ? '600' : '800',
                                lineHeight: calendarVariant ? 26 : 31,
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
                    </>}
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
                                style={[{
                                    flex: 1,
                                    color: text,
                                    fontSize: 16,
                                    fontWeight: '700',
                                    lineHeight: 21,
                                }, dark && { color: darkPalette.onSurface }]}
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
                                    style={[{
                                        flex: 1,
                                        color: muted,
                                        fontSize: 12,
                                    }, dark && { color: darkPalette.onSurface }]}
                                >
                                    {subtitle}
                                </Text>
                            )}
                        </View>
                        {calendarVariant && <Text style={{ color: muted, fontSize: 12, lineHeight: 17 }}>{session.start_time.slice(0, 5)} – {session.end_time.slice(0, 5)}</Text>}
                        <SessionStatusBadge session={session} />
                        {showDjs &&
                        session.is_collective &&
                        session.djs?.length ? (
                            <Text
                                numberOfLines={2}
                                style={[{
                                    color: muted,
                                    fontSize: 11,
                                    lineHeight: 15,
                                }, dark && { color: darkPalette.onSurface }]}
                            >
                                {session.djs.join(', ')}
                            </Text>
                        ) : null}
                    </View>
                    <ChevronRight
                        size={17}
                        color={dark ? darkPalette.muted : '#afb5c5'}
                    />
                </TouchableOpacity>
                <SessionCardDetails sessionId={session.id}>
                <View
                    style={{
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
                        {!calendarVariant && <Text
                            style={[{
                                color: muted,
                                fontSize: 12,
                                fontWeight: '500',
                            }, dark && { color: darkPalette.onSurface }]}
                        >
                            {session.start_time.slice(0, 5)} –{' '}
                            {session.end_time.slice(0, 5)}
                        </Text>}
                    </View>
                    {session.is_guest ? (
                        <Text
                            style={[{
                                color: muted,
                                fontSize: 11,
                                marginLeft: 'auto',
                            }, dark && { color: darkPalette.onSurface }]}
                        >
                            {t('collaboration.guestSession')}
                        </Text>
                    ) : (!calendarVariant || !cancelled) && session.earning_type !== 'free' && sessionPaymentState(session) !== 'partial' ? (
                        <Text
                            style={[{
                                color: text,
                                fontSize: 16,
                                fontWeight: '700',
                                marginLeft: 'auto',
                            }, dark && { color: darkPalette.onSurface }]}
                        >
                            {session.earning_type === 'agreement' &&
                            !session.fee_agreement?.settled
                                ? '—'
                                : formatMoney(fee, session.currency || '€')}
                        </Text>
                    ) : null}
                </View>
                <SessionPartialPaymentSummary session={session} showDivider={false} />
                <SessionExpenseBadge session={session} />
                <SessionTaskBadge session={session} />
            <SessionAttendanceBadges session={session} />
                </SessionCardDetails>
            </View>
        </View>
    );
}
