import { useEffect, useState } from 'react';
import { Text, View, AppState } from 'react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';
import { sessionPhase } from '../../utils/sessionWorkflow';
import type { Session } from '../../types/session';
export function SessionStatusBadge({
    session,
    compact = false,
}: {
    session: Session;
    compact?: boolean;
}) {
    const { t } = useTranslation();
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        const listener = AppState.addEventListener('change', (state) => {
            if (state === 'active') setNow(new Date());
        });
        return () => {
            clearInterval(timer);
            listener.remove();
        };
    }, []);
    const phase = sessionPhase(session, now);
    const color =
        phase === 'pending'
            ? dark
                ? '#e6b85c'
                : '#956414'
            : phase === 'cancelled'
              ? dark
                  ? '#f19ab1'
                  : '#c35671'
              : phase === 'ongoing'
                ? dark
                    ? '#66d4c0'
                    : '#088b79'
                : dark
                  ? '#b5a8f7'
                  : '#7666cf';
    return (
        <View
            style={{
                alignSelf: 'flex-start',
                backgroundColor: `${color}15`,
                borderRadius: 9,
                paddingHorizontal: compact ? 6 : 9,
                paddingVertical: compact ? 4 : 5,
                flexShrink: compact ? 1 : 0,
            }}
        >
            <Text
                numberOfLines={compact ? 1 : undefined}
                style={{
                    color,
                    fontSize: compact ? 10 : 11,
                    lineHeight: compact ? 12 : undefined,
                    fontWeight: '700',
                }}
            >
                {t(`workflow.${phase}`)}
            </Text>
        </View>
    );
}
