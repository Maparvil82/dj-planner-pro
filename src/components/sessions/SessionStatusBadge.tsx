import { useEffect, useState } from 'react';
import { Text, View, AppState } from 'react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';
import { sessionPhase } from '../../utils/sessionWorkflow';
import type { Session } from '../../types/session';
export function SessionStatusBadge({ session }: { session: Session }) {
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
                paddingHorizontal: 9,
                paddingVertical: 5,
            }}
        >
            <Text style={{ color, fontSize: 11, fontWeight: '700' }}>
                {t(`workflow.${phase}`)}
            </Text>
        </View>
    );
}
