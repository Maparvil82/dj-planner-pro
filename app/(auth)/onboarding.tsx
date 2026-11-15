import { Redirect } from 'expo-router';
// Keep old deep links working without the previous multi-step onboarding.
export default function LegacyOnboarding() {
    return <Redirect href="/(auth)/welcome" />;
}
