export interface UserTag {
    id: string; // uuid
    user_id: string; // uuid
    type: 'title' | 'venue';
    name: string;
    created_at: string; // timestamptz
}
