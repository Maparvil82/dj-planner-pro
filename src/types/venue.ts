export interface Venue {
    id: string; // uuid
    user_id: string; // uuid
    name: string;
    address?: string;
    contact_info?: string;
    notes?: string;
    color?: string;
    sound_quality?: number; // 1-5
    experience_rating?: number; // 1-5
    created_at: string; // timestamptz
    updated_at: string; // timestamptz
}

export interface CreateVenueInput {
    name: string;
    address?: string;
    contact_info?: string;
    notes?: string;
    color?: string;
    sound_quality?: number; // 1-5
    experience_rating?: number; // 1-5
}
