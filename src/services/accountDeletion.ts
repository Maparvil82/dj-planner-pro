import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
const key = (id: string) => `account-deletion-receipt:${id}`;
export const accountDeletion = {
    async pending(): Promise<boolean> {
        const { data, error } = await supabase.rpc('account_deletion_pending');
        if (error) throw error;
        return data === true;
    },
    async request(input: Record<string, unknown>) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 35000);
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
                {
                    method: 'POST',
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json',
                        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
                        ...(session?.access_token
                            ? {
                                  Authorization: `Bearer ${session.access_token}`,
                              }
                            : {}),
                    },
                    body: JSON.stringify(input),
                },
            );
            const result = await response.json();
            if (!response.ok) throw new Error('accountDeletion.error');
            return result as {
                receipt?: string;
                complete: boolean;
                removed?: number;
            };
        } finally {
            clearTimeout(timeout);
        }
    },
    async remove(
        userId: string,
        onProgress?: (removed: number) => void,
    ): Promise<void> {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (session?.user.id !== userId)
            throw new Error('accountDeletion.error');
        let receipt = await AsyncStorage.getItem(key(userId));
        let removed = 0;
        try {
            if (
                receipt &&
                (await this.request({ action: 'receipt', receipt })).complete
            ) {
                await AsyncStorage.removeItem(key(userId));
                return;
            }
            const start = await this.request({
                action: 'start',
                confirm: true,
            });
            if (!start.receipt) throw new Error('accountDeletion.error');
            receipt = start.receipt;
            // Persist before the destructive phase, so a lost response after Auth
            // deletion can be resolved without attempting another account delete.
            await AsyncStorage.setItem(key(userId), receipt);
            for (let attempt = 0; attempt < 1000; attempt++) {
                const result = await this.request({
                    action: 'delete',
                    confirm: true,
                });
                removed += result.removed || 0;
                onProgress?.(removed);
                if (result.complete) {
                    await AsyncStorage.removeItem(key(userId));
                    return;
                }
                if (!result.removed) throw new Error('accountDeletion.error');
            }
            throw new Error('accountDeletion.error');
        } catch {
            if (receipt) {
                try {
                    if (
                        (await this.request({ action: 'receipt', receipt }))
                            .complete
                    ) {
                        await AsyncStorage.removeItem(key(userId));
                        return;
                    }
                } catch {
                    /* Keep the receipt and let the user retry. */
                }
            }
            throw new Error('accountDeletion.error');
        }
    },
};
