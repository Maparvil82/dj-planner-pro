import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import {useSessionRangeQuery} from './useSessionScreens';
import { useAuthStore } from '../store/useAuthStore';
import { liveSessions, sessionRange, localDateString } from '../utils/sessionPlanning';

export function useLiveSessions() {
    const userId = useAuthStore(s => s.session?.user.id);
    const focused = useIsFocused();
    const [foreground, setForeground] = useState(AppState.currentState === 'active');
    const [now, setNow] = useState(() => new Date());
    const from=new Date(now);from.setDate(from.getDate()-2);const to=new Date(now);to.setDate(to.getDate()+2);
    const query=useSessionRangeQuery(localDateString(from),localDateString(to));
    useEffect(() => {
        const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
        return () => listener.remove();
    }, []);
    const active = focused && foreground;
    useEffect(() => {if (active) setNow(new Date());}, [active]);
    useEffect(() => {
        if (!active) return;
        let delay = 30000;
        for (const session of query.data || []) {
            if (session.user_id !== userId || session.is_guest || session.status === 'cancelled') continue;
            const range = sessionRange(session);
            for (const boundary of [range.start, range.end]) {
                const remaining = boundary.getTime() - now.getTime();
                if (remaining > 0) delay = Math.min(delay, remaining);
            }
        }
        const timer = setTimeout(() => setNow(new Date()), Math.max(50, delay));
        return () => clearTimeout(timer);
    }, [active, query.data, userId, now]);
    return {...query, active, now, live: liveSessions(query.data || [], userId || '', now)};
}
