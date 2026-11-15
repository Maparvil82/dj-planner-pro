import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { venueService } from '../services/venues';
import { useAuthStore } from '../store/useAuthStore';
import { CreateVenueInput } from '../types/venue';

export const useVenuesQuery = (includeArchived = false) => {
    const { session, initialized } = useAuthStore();
    const userId = session?.user?.id;

    return useQuery({
        queryKey: ['venues', userId, includeArchived],
        queryFn: () => {
            if (!userId) return [];
            return venueService.getAllVenues(userId, includeArchived);
        },
        enabled: !!userId && initialized,
        staleTime: 1000 * 60 * 10, // 10 minutes cache
    });
};

export const useVenueByIdQuery = (venueId: string | undefined | string[]) => {
    const id = Array.isArray(venueId) ? venueId[0] : venueId;

    const { session, initialized } = useAuthStore();
    const viewer = session?.user.id;
    return useQuery({
        queryKey: ['venue', id, viewer],
        queryFn: () => {
            if (!id) return null;
            return venueService.getVenueById(id);
        },
        enabled: !!id && !!viewer && initialized,
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
            queryClient.invalidateQueries({ queryKey: ['community'] });
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
            queryClient.invalidateQueries({ queryKey: ['session'] });
            queryClient.invalidateQueries({ queryKey: ['collaborations'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};

export const useUpdateVenueMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            venueId,
            input,
        }: {
            venueId: string;
            input: Partial<CreateVenueInput>;
        }) => {
            return venueService.updateVenue(venueId, input);
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['venues'] });
            queryClient.invalidateQueries({ queryKey: ['community'] });
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
            queryClient.invalidateQueries({ queryKey: ['session'] });
            queryClient.invalidateQueries({ queryKey: ['collaborations'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['venue', data.id] });
            // Refresh saved names after changing a place.
            queryClient.invalidateQueries({ queryKey: ['tags'] });
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
            queryClient.invalidateQueries({ queryKey: ['venue'] });
            queryClient.invalidateQueries({ queryKey: ['community'] });
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
            queryClient.invalidateQueries({ queryKey: ['session'] });
            queryClient.invalidateQueries({ queryKey: ['collaborations'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};
