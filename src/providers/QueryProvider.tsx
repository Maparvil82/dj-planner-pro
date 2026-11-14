import { captureOperationFailure, queryOperation } from '../monitoring';
import {
    focusManager,
    QueryClient,
    QueryCache,
    MutationCache,
    QueryClientProvider,
} from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => captureOperationFailure(queryOperation(query.queryKey), error) }),
    mutationCache: new MutationCache({ onError: error => captureOperationFailure('mutation.other', error) }),
    defaultOptions: {
        queries: {
            retry: 2,
            staleTime: 30000,
            refetchOnWindowFocus: true,
        },
    },
});

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
    useEffect(() => useAuthStore.subscribe((state, previous) => {
        if (state.user?.id !== previous.user?.id) {
            void queryClient.cancelQueries();
            queryClient.clear();
        }
    }), []);
    useEffect(() => {
        if (Platform.OS === 'web') return;
        focusManager.setFocused(AppState.currentState === 'active');
        const listener = AppState.addEventListener('change', (state) => {
            focusManager.setFocused(state === 'active');
        });
        return () => {
            listener.remove();
            focusManager.setFocused(undefined);
        };
    }, []);
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
};
