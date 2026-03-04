export interface Expense {
    id: string; // uuid
    user_id: string; // uuid
    amount: number;
    description?: string;
    category?: string;
    date: string; // date 'YYYY-MM-DD'
    created_at: string; // timestamptz
    updated_at: string; // timestamptz
}

export interface CreateExpenseInput {
    amount: number;
    description?: string;
    category?: string;
    date: string;
}
