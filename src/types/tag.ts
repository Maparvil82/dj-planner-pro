export interface UserTag {
    id: string; // uuid
    user_id: string; // uuid
    type: 'title' | 'venue' | 'dj';
    name: string;
    color: string;
    created_at: string; // timestamptz
}

export interface TagOption {
    name: string;
    color: string;
}
