export interface Expense {
    id: string; // uuid
    user_id: string; // uuid
    amount: number;
    session_id?: string | null;
    currency?: string;
    receipt_path?: string | null;
    included_in_agreement?: boolean;
    description?: string;
    category?: string;
    date: string; // date 'YYYY-MM-DD'
    created_at: string; // timestamptz
    updated_at: string; // timestamptz
}

export interface CreateExpenseInput {
    id?: string;
    amount: number;
    session_id?: string | null;
    currency?: string;
    receipt_path?: string | null;
    included_in_agreement?: boolean;
    description?: string;
    category?: string;
    date: string;
}
