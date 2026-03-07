export interface Venue {
    id: string; // uuid
    user_id: string; // uuid
    name: string;
    address?: string;
    city?: string;
    contact_info?: string;
    notes?: string;
    color?: string;
    sound_quality?: number; // 1-5
    experience_rating?: number; // 1-5
    capacity?: number;
    equipment?: Array<{ name: string; quantity: number }>;
    images?: string[];
    created_at: string; // timestamptz
    updated_at: string; // timestamptz
}

export interface CreateVenueInput {
    name: string;
    address?: string;
    city?: string;
    contact_info?: string;
    notes?: string;
    color?: string;
    sound_quality?: number; // 1-5
    experience_rating?: number; // 1-5
    capacity?: number;
    equipment?: Array<{ name: string; quantity: number }>;
    images?: string[];
}

export interface PickedImage {
    uri: string;
    width: number;
    height: number;
    base64?: string;
    type?: 'image' | 'video';
}
