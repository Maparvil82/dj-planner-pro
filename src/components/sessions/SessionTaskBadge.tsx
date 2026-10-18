import { Text, View } from 'react-native';
import { ListChecks } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/useAuthStore';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/communityColors';
import { sessionTools } from '../../services/sessionTools';
import type { Session } from '../../types/session';

export function SessionTaskBadge({ session }: { session: Session }) {
    const userId = useAuthStore(s => s.session?.user.id);
    const own = !!userId && !session.is_guest && session.user_id === userId;
    const summary = useQuery({
        queryKey: ['session-tasks', 'summaries', userId],
        queryFn: () => sessionTools.taskSummaries(userId!),
        enabled: own,
    });
    const c = useCommunityColors();
    const { t } = useTranslation();
    const counts = summary.data?.[session.id];
    if (!own || summary.isError || !counts || counts.completed + counts.pending === 0) return null;
    const label = t('tools.taskSummary', { ...counts });
    return <View testID="session-task-badge" accessibilityLabel={label} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, backgroundColor: c.tint, paddingHorizontal: 10, paddingVertical: 8, maxWidth: '100%' }}>
        <ListChecks size={15} color={c.accent} />
        <Text style={{ color: c.dark ? c.cardText : c.accent, fontSize: 11, lineHeight: 16, fontWeight: '700', flexShrink: 1 }}>{label}</Text>
    </View>;
}
