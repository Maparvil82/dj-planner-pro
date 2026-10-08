import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/useAuthStore';
import { useBlockedDays } from '../../hooks/useBlockedDays';
import { sessionTools } from '../../services/sessionTools';
import { CommunityButton, useCommunityColors } from '../community/CommunityUI';
import { useTranslation } from '../../i18n/useTranslation';
import { confirmAction } from '../../utils/confirmAction';
export function BlockDayButton({
    date,
    hasSessions,
}: {
    date: string;
    hasSessions: boolean;
}) {
    const { t } = useTranslation(),
        c = useCommunityColors(),
        user = useAuthStore((s) => s.session?.user.id),
        days = useBlockedDays(),
        client = useQueryClient(),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(false),
        lock = useRef(false),
        blocked = days.data?.includes(date);
    const toggle = async () => {
        if (!user || lock.current || days.isError || days.isLoading) return;
        lock.current = true;
        setBusy(true);
        setError(false);
        try {
            if (
                !blocked &&
                hasSessions &&
                !(await confirmAction(
                    t('tools.blockDay'),
                    t('tools.blockExisting'),
                    t('cancel'),
                    t('tools.blockDay'),
                ))
            )
                return;
            await sessionTools.block(user, date, !blocked);
            await client.invalidateQueries({ queryKey: ['blocked-days'] });
        } catch {
            setError(true);
        } finally {
            setBusy(false);
            lock.current = false;
        }
    };
    return (
        <View style={{ gap: 8, marginBottom: 16 }}>
            {blocked ? (
                <Text style={{ color: c.accent, fontWeight: '700' }}>
                    {t('tools.dayBlocked')}
                </Text>
            ) : null}
            <CommunityButton
                secondary
                label={t(blocked ? 'tools.unblockDay' : 'tools.blockDay')}
                busy={busy || days.isLoading}
                disabled={days.isError}
                onPress={() => void toggle()}
            />
            {error || days.isError ? (
                <>
                    <Text style={{ color: '#d44455' }}>
                        {t('tools.saveError')}
                    </Text>
                    <CommunityButton
                        secondary
                        label={t('insights.retry')}
                        onPress={() => void days.refetch()}
                    />
                </>
            ) : null}
        </View>
    );
}
