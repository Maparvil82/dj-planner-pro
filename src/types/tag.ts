export interface UserTag {
    id: string; // uuid
    user_id: string; // uuid
    type: 'title' | 'venue';
    name: string;
    color: string;
    created_at: string; // timestamptz
}

export interface TagOption {
    name: string;
    color: string;
}
