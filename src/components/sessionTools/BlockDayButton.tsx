import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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
    compact = false,
}: {
    date: string;
    hasSessions: boolean;
    compact?: boolean;
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
    if (compact) return <View style={{ maxWidth: '45%', gap: 6 }}>
        <Pressable accessibilityRole="button" disabled={busy || days.isLoading || days.isError} onPress={() => void toggle()} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 14, backgroundColor: c.field, opacity: busy || days.isLoading || days.isError ? 0.5 : 1 }}>
            {busy || days.isLoading ? <ActivityIndicator color={c.accent} /> : <Text style={{ color: c.accent, fontSize: 12, fontWeight: '600' }}>{t(blocked ? 'tools.unblockDay' : 'tools.blockDay')}</Text>}
        </Pressable>
        {error || days.isError ? <Text accessibilityRole="alert" style={{ color: '#d44455', fontSize: 12 }}>{t('tools.saveError')}</Text> : null}
    </View>;
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
