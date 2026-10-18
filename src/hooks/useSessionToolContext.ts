import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useAllSessionsQuery, useSessionByIdQuery } from './useSessionsQuery';

/** A route carrying a session never enters the global session chooser. */
export function useSessionToolContext() {
    const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
    const routeId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
    const [chosenId, setSessionId] = useState('');
    const isSessionBound = !!routeId;
    const all = useAllSessionsQuery(!isSessionBound);
    const direct = useSessionByIdQuery(routeId);
    const source = isSessionBound ? direct : all;
    return {
        sessionId: routeId || chosenId,
        setSessionId,
        isSessionBound,
        sessions: {
            data: isSessionBound ? (direct.data ? [direct.data] : []) : all.data,
            isLoading: source.isLoading,
            isPending: source.isPending,
            isError: source.isError,
            refetch: source.refetch,
        },
    };
}
