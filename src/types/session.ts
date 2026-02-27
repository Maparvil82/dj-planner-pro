export interface Session {
    id: string; // uuid
    user_id: string; // uuid
    date: string; // date 'YYYY-MM-DD'
    title: string;
    venue: string;
    start_time: string; // e.g., '22:00'
    end_time: string; // e.g., '04:00'
    created_at: string; // timestamptz
    updated_at: string; // timestamptz
}

export interface CreateSessionInput {
    date: string;
    title: string;
    venue: string;
    start_time: string;
    end_time: string;
}
