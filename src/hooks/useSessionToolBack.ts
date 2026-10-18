import { useCallback } from 'react';
import { Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export function useSessionToolBack() {
    const router = useRouter();
    const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
    const id = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
    return useCallback(() => {
        Keyboard.dismiss();
        if (id) {
            // Pop to the existing detail, or replace the tool if it was opened
            // directly and that detail is missing from the navigation stack.
            router.dismissTo({ pathname: '/session/[id]', params: { id } });
        } else if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/home');
        }
    }, [id, router]);
}
