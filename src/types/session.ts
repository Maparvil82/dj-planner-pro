export interface Session {
    id: string; // uuid
    user_id: string; // uuid
    date: string; // date 'YYYY-MM-DD'
    title: string;
    venue: string;
    start_time: string; // e.g., '22:00'
    end_time: string; // e.g., '04:00'
    color: string;
    is_collective: boolean;
    djs: string[];
    earning_type: 'free' | 'hourly' | 'fixed';
    earning_amount: number;
    currency: string;
    recurrence_type?: 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'yearly';
    recurrence_end_date?: string; // YYYY-MM-DD
    parent_session_id?: string;
    venue_id?: string; // uuid
    created_at: string; // timestamptz
    updated_at: string; // timestamptz
}

export interface CreateSessionInput {
    date: string;
    title: string;
    venue: string;
    start_time: string;
    end_time: string;
    color?: string;
    is_collective?: boolean;
    djs?: string[];
    earning_type?: 'free' | 'hourly' | 'fixed';
    earning_amount?: number;
    currency?: string;
    recurrence_type?: 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'yearly';
    recurrence_end_date?: string; // YYYY-MM-DD
    parent_session_id?: string;
    venue_id?: string; // uuid
}
