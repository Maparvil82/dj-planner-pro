import { Text, View } from 'react-native';
import { Ticket, Users } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/useAuthStore';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/communityColors';
import { guestService } from '../../services/guests';
import { entryCounterService } from '../../services/entryCounter';
import type { Session } from '../../types/session';

export function SessionAttendanceBadges({ session }: { session: Session }) {
    const userId = useAuthStore(s => s.session?.user.id);
    const own = !!userId && !session.is_guest && session.user_id === userId;
    // Share the tool queries so admissions and guest edits update the cards too.
    const guests = useQuery({
        queryKey: ['guests', userId, session.id],
        queryFn: () => guestService.list(session.id),
        enabled: own,
    });
    const entries = useQuery({
        queryKey: ['entry-counter', userId, session.id],
        queryFn: () => entryCounterService.count(session.id),
        enabled: own,
    });
    const c = useCommunityColors();
    const { t } = useTranslation();
    const total = guests.data?.reduce((sum, row) => sum + Number(row.total), 0) ?? 0;
    const admitted = guests.data?.reduce((sum, row) => sum + Number(row.admitted), 0) ?? 0;
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
