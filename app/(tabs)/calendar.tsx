import { Redirect } from 'expo-router';

// Preserve preview links; calendar and history now share a single screen.
export default function CalendarScreen() {
    return <Redirect href="/history" />;
}
