import { supabase } from '../lib/supabase';
import { optimizedImage } from './optimizedImage';
import { storageError } from '../utils/storageLimits';

export interface UserProfile {
    id: string;
    avatar_url: string | null;
    artist_name: string | null;
    updated_at: string;
}

export const profileService = {
    async getProfile(userId: string): Promise<UserProfile | null> {
        const { data, error } = await supabase
            .from('users_profile')
            .select('*')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching profile:', error);
            return null;
        }
        return data;
    },

    async updateProfile(
        userId: string,
        updates: Partial<UserProfile>,
    ): Promise<UserProfile | null> {
        const { data, error } = await supabase
            .from('users_profile')
            .upsert({
                id: userId,
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('Error updating profile:', error);
            return null;
        }
        return data;
    },

    async uploadProfilePhoto(
        userId: string,
        imageUri: string,
    ): Promise<string> {
        const bytes = await optimizedImage(imageUri, 400);
        const path = `${userId}/avatar-${(await import('expo-crypto')).randomUUID()}.jpg`;
        const { error } = await supabase.storage
            .from('avatars')
            .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
        if (error) throw storageError(error);
        return supabase.storage.from('avatars').getPublicUrl(path).data
            .publicUrl;
    },

    async uploadCover(userId: string, imageUri: string): Promise<string> {
        const bytes = await optimizedImage(imageUri, 1600);
        const path = `${userId}/cover-${(await import('expo-crypto')).randomUUID()}.jpg`;
        const { error } = await supabase.storage
            .from('avatars')
            .upload(path, bytes, {
                contentType: 'image/jpeg',
                upsert: false,
            });
        if (error) throw storageError(error);
        return supabase.storage.from('avatars').getPublicUrl(path).data
            .publicUrl;
    },

    async uploadAvatar(
        userId: string,
        imageUri: string,
    ): Promise<string | null> {
        try {
            const bytes = await optimizedImage(imageUri, 400);
            const filePath = `${userId}/${(await import('expo-crypto')).randomUUID()}.jpg`;
            const contentType = 'image/jpeg';

            // 2. Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, bytes, {
                    contentType,
                    upsert: true,
                });

            if (uploadError) {
                throw storageError(uploadError);
            }

            // 3. Get public URL
            const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const avatarUrl = publicUrlData.publicUrl;

            // 4. Update profile DB record
            const { error: dbError } = await supabase
                .from('users_profile')
                .upsert({
                    id: userId,
                    avatar_url: avatarUrl,
                    updated_at: new Date().toISOString(),
                });

            if (dbError) throw dbError;

            return avatarUrl;
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.startsWith('storageSafety.')
            )
                throw error;
            console.error('Upload Avatar Error:', error);
            return null;
        }
    },

    async deleteAccount(userId: string): Promise<boolean> {
        const { accountDeletion } = await import('./accountDeletion');
        await accountDeletion.remove(userId);
        return true;
    },
};
