import { normalizeCity } from '../utils/cities';
import { supabase } from '../lib/supabase';
import { Venue, CreateVenueInput } from '../types/venue';
import { optimizedImage } from './optimizedImage';
import { storageError } from '../utils/storageLimits';

export const venueService = {
    async uploadVenueImage(
        userId: string,
        imageUri: string,
    ): Promise<string | null> {
        try {
            const bytes = await optimizedImage(imageUri, 1200);
            const filePath = `${userId}/venue_${(await import('expo-crypto')).randomUUID()}.jpg`;
            const contentType = 'image/jpeg';

            // 2. Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('venues')
                .upload(filePath, bytes, {
                    contentType,
                    upsert: true,
                });

            if (uploadError) {
                throw storageError(uploadError);
            }

            // 3. Get public URL
            const { data: publicUrlData } = supabase.storage
                .from('venues')
                .getPublicUrl(filePath);

            return publicUrlData.publicUrl;
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.startsWith('storageSafety.')
            )
                throw error;
            console.error('Upload Venue Image Error:', error);
            return null;
        }
    },
    async getAllVenues(
        userId: string,
        includeArchived = false,
    ): Promise<Venue[]> {
        let query = supabase.from('venues').select('*').eq('user_id', userId);
        if (!includeArchived) query = query.is('archived_at', null);
        const { data, error } = await query.order('name', { ascending: true });

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
        if (!input.city?.trim()) throw new Error('location.cityRequired');
        input = {
            ...input,
            city: normalizeCity(input.city),
            name: input.name.trim(),
        };
        const { data, error } = await supabase
            .from('venues')
            .insert({
                ...input,
                user_id: userId,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating venue:', error);
            throw new Error(error.message);
        }

        return data;
    },

    async updateVenue(
        venueId: string,
        input: Partial<CreateVenueInput>,
    ): Promise<Venue> {
        if (input.city !== undefined)
            input = { ...input, city: normalizeCity(input.city) };
        const { data, error } = await supabase
            .from('venues')
            .update({
                ...input,
                updated_at: new Date().toISOString(),
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
            .update({ archived_at: new Date().toISOString() })
            .eq('id', venueId);

        if (error) {
            console.error('Error deleting venue:', error);
            throw new Error(error.message);
        }
    },
    async deleteVenueImage(imageUrl: string): Promise<void> {
        try {
            // Extract path from public URL
            // Format: .../storage/v1/object/public/venues/[userId]/[filename]
            const parts = imageUrl.split('/public/venues/');
            if (parts.length < 2) return;

            const filePath = parts[1];
            const { error } = await supabase.storage
                .from('venues')
                .remove([filePath]);

            if (error) throw error;
        } catch (error) {
            console.error('Delete Venue Image Error:', error);
        }
    },
};
