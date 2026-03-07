import { UserProfile } from "../services/profile";

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
    status?: 'pending' | 'confirmed' | 'cancelled';
    poster_url?: string | null;
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
    status?: 'pending' | 'confirmed' | 'cancelled';
    poster_url?: string | null;
}

export interface VaultFolder {
    id: string;
    user_id: string;
    name: string;
    associated_type: 'session' | 'venue' | 'general';
    associated_id?: string | null;
    created_at: string;
    updated_at: string;
}

export interface VaultFile {
    id: string;
    user_id: string;
    folder_id: string;
    name: string;
    url: string;
    file_type?: string | null;
    size?: number | null;
    created_at: string;
}
