import { Stack } from 'expo-router';

export default function ModalsLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen
                name="add-session"
                options={{
                    headerShown: true, // Show header for this specific modal
                    presentation: 'modal',
                }}
            />
        </Stack>
    );
}