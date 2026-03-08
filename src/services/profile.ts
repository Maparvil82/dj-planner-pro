import { supabase } from '../lib/supabase';
import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';

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

    async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
        const { data, error } = await supabase
            .from('users_profile')
            .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
            .select()
            .single();

        if (error) {
            console.error('Error updating profile:', error);
            return null;
        }
        return data;
    },

    async uploadAvatar(userId: string, imageUri: string): Promise<string | null> {
        try {
            // 1. Compress & format image
            const manipulatedImage = await ImageManipulator.manipulateAsync(
                imageUri,
                [{ resize: { width: 400 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            if (!manipulatedImage.base64) {
                throw new Error("Failed to get base64 string from image");
            }

            const filePath = `${userId}/${Date.now()}.jpg`;
            const contentType = 'image/jpeg';

            // 2. Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, decode(manipulatedImage.base64), {
                    contentType,
                    upsert: true,
                });

            if (uploadError) {
                throw uploadError;
            }

            // 3. Get public URL
            const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const avatarUrl = publicUrlData.publicUrl;

            // 4. Update profile DB record
            const { error: dbError } = await supabase
                .from('users_profile')
                .upsert({ id: userId, avatar_url: avatarUrl, updated_at: new Date().toISOString() });

            if (dbError) throw dbError;

            return avatarUrl;
        } catch (error) {
            console.error('Upload Avatar Error:', error);
            return null;
        }
    },

    async deleteAccount(userId: string): Promise<boolean> {
        try {
            // 1. Call the SECURITY DEFINER function to delete the user from auth.users
            // and all their data (cascades or manual cleanup in SQL)
            const { error } = await supabase.rpc('delete_user_data');

            if (error) throw error;

            return true;
        } catch (error) {
            console.error('Delete Account Error:', error);
            return false;
        }
    }
};
