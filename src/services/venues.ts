import { supabase } from '../lib/supabase';
import { Venue, CreateVenueInput } from '../types/venue';

export const venueService = {
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
