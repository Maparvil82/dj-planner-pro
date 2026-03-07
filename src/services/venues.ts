import { supabase } from '../lib/supabase';
import { Venue, CreateVenueInput } from '../types/venue';
import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';

export const venueService = {
    async uploadVenueImage(userId: string, imageUri: string): Promise<string | null> {
        try {
            // 1. Compress & format image
            const manipulatedImage = await ImageManipulator.manipulateAsync(
                imageUri,
                [{ resize: { width: 1200 } }], // Larger than profile but still optimized
                { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            if (!manipulatedImage.base64) {
                throw new Error("Failed to get base64 string from image");
            }

            const filePath = `${userId}/venue_${Date.now()}.jpg`;
            const contentType = 'image/jpeg';

            // 2. Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('venues')
                .upload(filePath, decode(manipulatedImage.base64), {
                    contentType,
                    upsert: true,
                });

            if (uploadError) {
                throw uploadError;
            }

            // 3. Get public URL
            const { data: publicUrlData } = supabase.storage
                .from('venues')
                .getPublicUrl(filePath);

            return publicUrlData.publicUrl;
        } catch (error) {
            console.error('Upload Venue Image Error:', error);
            return null;
        }
    },
    async getAllVenues(userId: string): Promise<Venue[]> {
        const { data, error } = await supabase
            .from('venues')
            .select('*')
            .eq('user_id', userId)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching venues:', error);
            throw new Error(error.message);
        }

        return data || [];
    },

    async getVenueById(venueId: string): Promise<Venue | null> {
        const { data, error } = await supabase
            .from('venues')
            .select('*')
            .eq('id', venueId)
            .single();

        if (error) {
            console.error('Error fetching venue by id:', error);
            throw new Error(error.message);
        }

        return data || null;
    },

    async createVenue(input: CreateVenueInput, userId: string): Promise<Venue> {
        const { data, error } = await supabase
            .from('venues')
            .insert({
                ...input,
                user_id: userId
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating venue:', error);
            throw new Error(error.message);
        }

        return data;
    },

    async updateVenue(venueId: string, input: Partial<CreateVenueInput>): Promise<Venue> {
        const { data, error } = await supabase
            .from('venues')
            .update({
                ...input,
                updated_at: new Date().toISOString()
            })
            .eq('id', venueId)
            .select()
            .single();

        if (error) {
            console.error('Error updating venue:', error);
            throw new Error(error.message);
        }

        return data;
    },

    async deleteVenue(venueId: string): Promise<void> {
        const { error } = await supabase
            .from('venues')
            .delete()
            .eq('id', venueId);

        if (error) {
            console.error('Error deleting venue:', error);
            throw new Error(error.message);
        }
    }
};
