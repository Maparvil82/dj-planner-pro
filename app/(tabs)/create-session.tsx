import { Redirect } from 'expo-router';

// The central tab button opens the existing form above the tab navigator.
export default function CreateSessionShortcut() {
    return <Redirect href="/add-session" />;
}
