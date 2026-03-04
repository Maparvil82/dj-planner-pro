import { supabase } from '../lib/supabase';
import { CreateExpenseInput, Expense } from '../types/expense';

export const expenseService = {
    async createExpense(input: CreateExpenseInput, userId: string): Promise<Expense> {
        const { data, error } = await supabase
            .from('expenses')
            .insert({
                ...input,
                user_id: userId
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating expense:', error);
            throw new Error(error.message);
        }

        return data;
    },

    async getAllExpenses(userId: string): Promise<Expense[]> {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching all expenses:', error);
            throw new Error(error.message);
        }

        return data || [];
    },

    async getExpensesByMonth(year: number, month: number, userId: string): Promise<Expense[]> {
        const jsMonth = String(month).padStart(2, '0');
        const startPath = `${year}-${jsMonth}-01`;

        const nextMonthYear = month === 12 ? year + 1 : year;
        const nextMonthStr = String(month === 12 ? 1 : month + 1).padStart(2, '0');
        const endPath = `${nextMonthYear}-${nextMonthStr}-01`;

        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('user_id', userId)
            .gte('date', startPath)
            .lt('date', endPath)
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching expenses:', error);
            throw new Error(error.message);
        }

        return data || [];
    },

    async updateExpense(expenseId: string, input: Partial<CreateExpenseInput>): Promise<Expense> {
        const { data, error } = await supabase
            .from('expenses')
            .update({
                ...input,
                updated_at: new Date().toISOString()
            })
            .eq('id', expenseId)
            .select()
            .single();

        if (error) {
            console.error('Error updating expense:', error);
            throw new Error(error.message);
        }

        return data;
    },

    async deleteExpense(expenseId: string): Promise<void> {
        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', expenseId);

        if (error) {
            console.error('Error deleting expense:', error);
            throw new Error(error.message);
        }
    }
};
