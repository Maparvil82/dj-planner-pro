import { Redirect } from 'expo-router';

// Preserve existing links while all editing now lives in the account profile.
export default function EditCommunityProfile() {
    return <Redirect href="/edit-dj-profile?edit=1" />;
}
