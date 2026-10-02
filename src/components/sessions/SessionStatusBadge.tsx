import { useEffect, useState } from 'react';
import { Text, View, AppState } from 'react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { sessionPhase } from '../../utils/sessionWorkflow';
import type { Session } from '../../types/session';
export function SessionStatusBadge({ session }: { session: Session }) {
    const { t } = useTranslation();
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
            ? '#ae7619'
            : phase === 'cancelled'
              ? '#c35671'
              : phase === 'ongoing'
                ? '#088b79'
                : '#8270d5';
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
