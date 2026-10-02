import { View, Text, TouchableOpacity } from 'react-native';
import { Clock3, ChevronRight, MapPin, Users } from 'lucide-react-native';
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
}: {
    session: Session;
    onPress: () => void;
    onLongPress?: () => void;
    showDjs?: boolean;
}) {
    const { activeTheme } = useTheme();
    const { currentLanguage } = useTranslation();
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
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${session.title}, ${session.venue}, ${date.toLocaleDateString(currentLanguage)}`}
            activeOpacity={0.8}
            onPress={onPress}
            onLongPress={onLongPress}
            style={{
                padding: 18,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: dark ? '#252d40' : '#e9ecf3',
                backgroundColor: dark ? '#171d2c' : '#fff',
                gap: 16,
            }}
        >
            <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
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
                        <View
                            style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: session.color || '#8270e4',
                            }}
                        />
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
                            {session.title}
                        </Text>
                    </View>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                        }}
                    >
                        <MapPin size={12} color={muted} />
                        <Text
                            numberOfLines={1}
                            style={{ flex: 1, color: muted, fontSize: 12 }}
                        >
                            {session.venue}
                        </Text>
                    </View>
                    <SessionStatusBadge session={session} />
                    {showDjs && session.is_collective && session.djs?.length ? (
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
                <ChevronRight size={17} color={dark ? '#657089' : '#afb5c5'} />
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
                    <Clock3 size={14} color={muted} />
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
                    {session.is_collective ? (
                        <Users size={14} color={muted} />
                    ) : null}
                </View>
                {session.earning_type !== 'free' ? (
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
        </TouchableOpacity>
    );
}
