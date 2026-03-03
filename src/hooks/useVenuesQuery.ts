import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { venueService } from '../services/venues';
import { useAuthStore } from '../store/useAuthStore';
import { CreateVenueInput } from '../types/venue';

export const useVenuesQuery = () => {
    const { session, initialized } = useAuthStore();
    const userId = session?.user?.id;

    return useQuery({
        queryKey: ['venues', userId],
        queryFn: () => {
            if (!userId) return [];
            return venueService.getAllVenues(userId);
        },
        enabled: !!userId && initialized,
        staleTime: 1000 * 60 * 10, // 10 minutes cache
    });
};

export const useVenueByIdQuery = (venueId: string | undefined | string[]) => {
    const id = Array.isArray(venueId) ? venueId[0] : venueId;

    return useQuery({
        queryKey: ['venue', id],
        queryFn: () => {
            if (!id) return null;
            return venueService.getVenueById(id);
        },
        enabled: !!id,
    });
};

export const useCreateVenueMutation = () => {
    const queryClient = useQueryClient();
    const { session } = useAuthStore();
    const userId = session?.user?.id;

    return useMutation({
        mutationFn: (input: CreateVenueInput) => {
            if (!userId) throw new Error('User not authenticated');
            return venueService.createVenue(input, userId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['venues'] });
        },
    });
};

export const useUpdateVenueMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ venueId, input }: { venueId: string; input: Partial<CreateVenueInput> }) => {
            return venueService.updateVenue(venueId, input);
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['venues'] });
            queryClient.invalidateQueries({ queryKey: ['venue', data.id] });
        },
    });
};

export const useDeleteVenueMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (venueId: string) => {
            return venueService.deleteVenue(venueId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['venues'] });
        },
    });
};
