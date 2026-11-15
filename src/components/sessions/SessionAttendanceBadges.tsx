import { Text, View } from 'react-native';
import { Ticket, Users } from 'lucide-react-native';
import { useSessionAttendance } from '../../hooks/useSessionAttendance';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/communityColors';
import type { Session } from '../../types/session';

export function SessionAttendanceBadges({ session }: { session: Session }) {
    const { own, guests, entries, total, admitted } = useSessionAttendance(session);
    const c = useCommunityColors();
    const { t } = useTranslation();
    const guestLabel = t('tools.guestSummary', { total, admitted });
    const entryLabel = t('tools.accessSummary', { count: entries.data ?? 0 });
    const style = { alignSelf: 'flex-start' as const, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7, borderRadius: 12, backgroundColor: c.tint, paddingHorizontal: 10, paddingVertical: 8, maxWidth: '100%' as const };
    const textStyle = { color: c.dark ? c.cardText : c.accent, fontSize: 11, lineHeight: 16, fontWeight: '700' as const, flexShrink: 1 };
    if (!own) return null;
    return <>
        {!guests.isError && total > 0 ? <View testID="session-guest-badge" accessibilityLabel={guestLabel} style={style}>
            <Users size={15} color={c.accent} />
            <Text style={textStyle}>{guestLabel}</Text>
        </View> : null}
        {!entries.isError && (entries.data ?? 0) > 0 ? <View testID="session-access-badge" accessibilityLabel={entryLabel} style={style}>
            <Ticket size={15} color={c.accent} />
            <Text style={textStyle}>{entryLabel}</Text>
        </View> : null}
    </>;
}
