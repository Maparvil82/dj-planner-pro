import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expenseService } from '../services/expenses';
import { useAuthStore } from '../store/useAuthStore';
import { CreateExpenseInput } from '../types/expense';

export const useAllExpensesQuery = () => {
    const { session, initialized } = useAuthStore();
    const userId = session?.user?.id;

    return useQuery({
        queryKey: ['expenses', 'all', userId],
        queryFn: () => {
            if (!userId) return [];
            return expenseService.getAllExpenses(userId);
        },
        enabled: !!userId && initialized,
    });
};

export const useExpensesQuery = (year: number, month: number) => {
    const { session, initialized } = useAuthStore();
    const userId = session?.user?.id;

    return useQuery({
        queryKey: ['expenses', year, month, userId],
        queryFn: () => {
            if (!userId) return [];
            return expenseService.getExpensesByMonth(year, month, userId);
        },
        enabled: !!userId && initialized,
    });
};

export const useCreateExpenseMutation = () => {
    const queryClient = useQueryClient();
    const { session } = useAuthStore();
    const userId = session?.user?.id;

    return useMutation({
        mutationFn: (input: CreateExpenseInput) => {
            if (!userId) throw new Error('User not authenticated');
            return expenseService.createExpense(input, userId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        },
    });
};

export const useUpdateExpenseMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ expenseId, input }: { expenseId: string; input: Partial<CreateExpenseInput> }) => {
            return expenseService.updateExpense(expenseId, input);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        },
    });
};

export const useDeleteExpenseMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (expenseId: string) => {
            return expenseService.deleteExpense(expenseId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        },
    });
};
