export interface Venue {
    id: string; // uuid
    user_id: string; // uuid
    name: string;
    address?: string;
    contact_info?: string;
    notes?: string;
    color?: string;
    created_at: string; // timestamptz
    updated_at: string; // timestamptz
}

export interface CreateVenueInput {
    name: string;
    address?: string;
    contact_info?: string;
    notes?: string;
    color?: string;
}
