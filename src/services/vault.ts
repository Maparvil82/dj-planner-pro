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

    async getFoldersByAssociation(userId: string, type: 'session' | 'venue', id: string): Promise<VaultFolder[]> {
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

    async createFolder(userId: string, name: string, type: 'session' | 'venue' | 'general' = 'general', associatedId?: string): Promise<VaultFolder> {
        const { data, error } = await supabase
            .from('vault_folders')
            .insert({
                user_id: userId,
                name,
                associated_type: type,
                associated_id: associatedId || null
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteFolder(folderId: string): Promise<void> {
        // RLS and ON DELETE CASCADE will handle file records in DB, 
        // but we might need to handle storage cleanup manually or via Edge Functions.
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

    async uploadFile(userId: string, folderId: string, name: string, fileData: any, contentType: string, size: number): Promise<VaultFile> {
        const filePath = `${userId}/${folderId}/${Date.now()}_${name}`;

        const { error: uploadError } = await supabase.storage
            .from('vault')
            .upload(filePath, fileData, { contentType });

        if (uploadError) throw uploadError;

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
                file_type: contentType,
                size: size
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteFile(fileId: string, fileUrl: string): Promise<void> {
        // 1. Delete from storage
        const pathParts = fileUrl.split('/public/vault/')[1]?.split('?')[0];
        if (pathParts) {
            await supabase.storage.from('vault').remove([pathParts]);
        }

        // 2. Delete from DB
        const { error } = await supabase
            .from('vault_files')
            .delete()
            .eq('id', fileId);

        if (error) throw error;
    }
};
