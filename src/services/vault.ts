import { randomUUID } from 'expo-crypto';
import { validateDocument, storageError } from '../utils/storageLimits';
import { supabase } from '../lib/supabase';
import { VaultFolder, VaultFile } from '../types/session';

export const vaultService = {
    async getFolders(userId: string): Promise<VaultFolder[]> {
        const { data, error } = await supabase
            .from('vault_folders')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async getFoldersByAssociation(
        userId: string,
        type: 'session' | 'venue',
        id: string,
    ): Promise<VaultFolder[]> {
        const { data, error } = await supabase
            .from('vault_folders')
            .select('*')
            .eq('user_id', userId)
            .eq('associated_type', type)
            .eq('associated_id', id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async createFolder(
        userId: string,
        name: string,
        type: 'session' | 'venue' | 'general' = 'general',
        associatedId?: string,
    ): Promise<VaultFolder> {
        const { data, error } = await supabase
            .from('vault_folders')
            .insert({
                user_id: userId,
                name,
                associated_type: type,
                associated_id: associatedId || null,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteFolder(folderId: string): Promise<void> {
        // 1. Get all files in the folder to delete from storage
        const files = await this.getFiles(folderId);

        // 2. Delete files from storage
        if (files.length > 0) {
            const storagePaths = files
                .map((file) => {
                    if (file.path) return file.path;
                    const parts = file.url
                        .split('/public/vault/')[1]
                        ?.split('?')[0];
                    return parts ? decodeURIComponent(parts) : null;
                })
                .filter(Boolean) as string[];

            if (storagePaths.length > 0) {
                for (
                    let offset = 0;
                    offset < storagePaths.length;
                    offset += 100
                ) {
                    const { error } = await supabase.storage
                        .from('vault')
                        .remove(storagePaths.slice(offset, offset + 100));
                    if (error) throw error;
                }
            }
        }

        // 3. Delete from DB (ON DELETE CASCADE will handle vault_files records)
        const { error } = await supabase
            .from('vault_folders')
            .delete()
            .eq('id', folderId);

        if (error) throw error;
    },

    async getFiles(folderId: string): Promise<VaultFile[]> {
        const { data, error } = await supabase
            .from('vault_files')
            .select('*')
            .eq('folder_id', folderId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async uploadFile(
        userId: string,
        folderId: string,
        name: string,
        fileData: any,
        contentType: string,
        size: number,
    ): Promise<VaultFile> {
        const actualSize = fileData?.byteLength ?? fileData?.size ?? size;
        validateDocument(contentType, actualSize);
        const filePath = `${userId}/${folderId}/${randomUUID()}`;

        const { error: uploadError } = await supabase.storage
            .from('vault')
            .upload(filePath, fileData, { contentType });

        if (uploadError) throw storageError(uploadError);

        const { data: publicUrlData } = supabase.storage
            .from('vault')
            .getPublicUrl(filePath);

        const { data, error } = await supabase
            .from('vault_files')
            .insert({
                user_id: userId,
                folder_id: folderId,
                name: name,
                url: publicUrlData.publicUrl,
                path: filePath,
                file_type: contentType,
                size: actualSize,
            })
            .select()
            .single();

        if (error) {
            // Keep the insertion error visible; cleanup failure is retried by maintenance.
            try {
                await supabase.storage.from('vault').remove([filePath]);
            } catch {
                /* background maintenance retries */
            }
            throw error;
        }
        return data;
    },

    async getSignedUrl(path: string, url?: string): Promise<string> {
        let storagePath = path;

        // Fallback: If path is missing, try to extract from URL
        if (!storagePath && url) {
            const parts = url.split('/public/vault/')[1]?.split('?')[0];
            if (parts) storagePath = decodeURIComponent(parts);
        }

        if (!storagePath) throw new Error('File path not found');

        const { data, error } = await supabase.storage
            .from('vault')
            .createSignedUrl(storagePath, 3600); // 1 hour

        if (error) throw error;
        return data.signedUrl;
    },

    async deleteFile(
        fileId: string,
        filePath: string,
        fileUrl?: string,
    ): Promise<void> {
        let storagePath = filePath;

        // Fallback: If path is missing, try to extract from URL
        if (!storagePath && fileUrl) {
            const parts = fileUrl.split('/public/vault/')[1]?.split('?')[0];
            if (parts) storagePath = decodeURIComponent(parts);
        }

        // 1. Delete from storage if we have a path
        if (storagePath) {
            const { error } = await supabase.storage
                .from('vault')
                .remove([storagePath]);
            if (error) throw error;
        }

        // 2. Delete from DB
        const { error } = await supabase
            .from('vault_files')
            .delete()
            .eq('id', fileId);

        if (error) throw error;
    },
};
