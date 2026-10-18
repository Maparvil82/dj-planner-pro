import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { accountDeletion } from '../../services/accountDeletion';
import { useAuthStore } from '../../store/useAuthStore';
export function AccountDeletionGate() {
    const id = useAuthStore((s) => s.session?.user.id);
    const pathname = usePathname(),
        router = useRouter(),
        navigation = useRootNavigationState();
    const status = useQuery({
        queryKey: ['account-deletion', id],
        queryFn: accountDeletion.pending,
        enabled: !!id,
        staleTime: 30000,
    });
    useEffect(() => {
        if (navigation?.key && status.data && pathname !== '/delete-account' && pathname !== '/door')
            router.replace('/delete-account');
    }, [navigation?.key, status.data, pathname, router]);
    return null;
}
