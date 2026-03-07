import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vaultService } from '../services/vault';
import { useAuthStore } from '../store/useAuthStore';

export const useVaultFoldersQuery = () => {
    const { session, initialized } = useAuthStore();
    const userId = session?.user?.id;

    return useQuery({
        queryKey: ['vault', 'folders', userId],
        queryFn: () => {
            if (!userId) return [];
            return vaultService.getFolders(userId);
        },
        enabled: !!userId && initialized,
    });
};

export const useVaultFoldersByAssociationQuery = (type: 'session' | 'venue', id: string) => {
    const { session, initialized } = useAuthStore();
    const userId = session?.user?.id;

    return useQuery({
        queryKey: ['vault', 'folders', type, id, userId],
        queryFn: () => {
            if (!userId) return [];
            return vaultService.getFoldersByAssociation(userId, type, id);
        },
        enabled: !!userId && initialized && !!id,
    });
};

export const useVaultFilesQuery = (folderId: string) => {
    return useQuery({
        queryKey: ['vault', 'files', folderId],
        queryFn: () => {
            if (!folderId) return [];
            return vaultService.getFiles(folderId);
        },
        enabled: !!folderId,
    });
};

export const useCreateFolderMutation = () => {
    const queryClient = useQueryClient();
    const { session } = useAuthStore();
    const userId = session?.user?.id;

    return useMutation({
        mutationFn: ({ name, type, associatedId }: { name: string; type?: 'session' | 'venue' | 'general'; associatedId?: string }) => {
            if (!userId) throw new Error('Not authenticated');
            return vaultService.createFolder(userId, name, type, associatedId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vault', 'folders'] });
        },
    });
};

export const useUploadFileMutation = () => {
    const queryClient = useQueryClient();
    const { session } = useAuthStore();
    const userId = session?.user?.id;

    return useMutation({
        mutationFn: ({ folderId, name, fileData, contentType, size }: { folderId: string; name: string; fileData: any; contentType: string; size: number }) => {
            if (!userId) throw new Error('Not authenticated');
            return vaultService.uploadFile(userId, folderId, name, fileData, contentType, size);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['vault', 'files', variables.folderId] });
        },
    });
};

export const useDeleteFolderMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (folderId: string) => vaultService.deleteFolder(folderId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vault', 'folders'] });
        },
    });
};

export const useDeleteFileMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ fileId, fileUrl, folderId }: { fileId: string; fileUrl: string; folderId: string }) =>
            vaultService.deleteFile(fileId, fileUrl),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['vault', 'files', variables.folderId] });
        },
    });
};
