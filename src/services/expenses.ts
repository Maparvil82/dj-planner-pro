import { supabase } from '../lib/supabase';
import { CreateExpenseInput, Expense } from '../types/expense';

export const expenseService = {
    async getExpense(id: string, userId: string): Promise<Expense | null> {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .maybeSingle();
        if (error) throw error;
        return data;
    },
    async createExpense(
        input: CreateExpenseInput,
        userId: string,
    ): Promise<Expense> {
        const { data, error } = await supabase
            .from('expenses')
            .upsert(
                {
                    ...input,
                    user_id: userId,
                },
                { onConflict: 'id' },
            )
            .select()
            .single();

        if (error) {
            throw new Error(error.message);
        }

        return data;
    },

    async getAllExpenses(userId: string): Promise<Expense[]> {
        const rows: Expense[] = [];
        for (let offset = 0; ; offset += 500) {
            const { data, error } = await supabase
                .from('expenses')
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: false })
                .order('id')
                .range(offset, offset + 499);
            if (error) throw new Error(error.message);
            rows.push(...(data || []));
            if (!data || data.length < 500) break;
        }
        return rows;
    },

    async getExpensesByMonth(
        year: number,
        month: number,
        userId: string,
    ): Promise<Expense[]> {
        const jsMonth = String(month).padStart(2, '0');
        const startPath = `${year}-${jsMonth}-01`;

        const nextMonthYear = month === 12 ? year + 1 : year;
        const nextMonthStr = String(month === 12 ? 1 : month + 1).padStart(
            2,
            '0',
        );
        const endPath = `${nextMonthYear}-${nextMonthStr}-01`;

        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('user_id', userId)
            .gte('date', startPath)
            .lt('date', endPath)
            .order('date', { ascending: true });

        if (error) {
            throw new Error(error.message);
        }

        return data || [];
    },

    async updateExpense(
        expenseId: string,
        input: Partial<CreateExpenseInput>,
    ): Promise<Expense> {
        const { data, error } = await supabase
            .from('expenses')
            .update({
                ...input,
                updated_at: new Date().toISOString(),
            })
            .eq('id', expenseId)
            .select()
            .single();

        if (error) {
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
            throw new Error(error.message);
        }
    },
};
