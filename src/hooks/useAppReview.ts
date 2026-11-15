import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Session } from '../types/session';
import { sessionRange } from '../utils/sessionPlanning';
import { recordReviewUse, requestReviewIfEligible } from '../services/appReview';

export function useAppReview(userId: string | undefined, sessions: Session[] | undefined, blocked: boolean, totalCreated?: number) {
    useFocusEffect(useCallback(() => {
        if (!userId) return;
        let active = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const check = () => {
            clearTimeout(timer);
            void recordReviewUse(userId);
            if (blocked || !sessions) return;
            const own = sessions.filter(s => s.user_id === userId && !s.is_guest && s.status !== 'cancelled');
            const count = totalCreated ?? new Set(own.map(s => s.parent_session_id || s.id)).size;
            const safe = () => {
                const now = new Date();
                return active && AppState.currentState === 'active' && !sessions.some(s => {
                    if (s.status === 'cancelled') return false;
                    const range = sessionRange(s);
                    return range.start <= now && range.end >= now;
                });
            };
            timer = setTimeout(() => { void requestReviewIfEligible(userId, count, safe); }, 2000);
        };
        check();
        const listener = AppState.addEventListener('change', state => {
            if (state === 'active') check();
            else clearTimeout(timer);
        });
        return () => { active = false; clearTimeout(timer); listener.remove(); };
    }, [userId, sessions, blocked, totalCreated]));
}
