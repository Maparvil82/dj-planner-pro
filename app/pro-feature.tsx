import { Redirect, useLocalSearchParams } from 'expo-router';
import { proEducationFeature } from '../src/config/proEducation';

// Preserve old links while the purchase flow now opens the paywall directly.
export default function ProFeatureScreen() {
    const params = useLocalSearchParams<{ feature?: string | string[]; sessionId?: string | string[] }>();
    const feature = proEducationFeature(params.feature);
    const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
    if (!feature) return <Redirect href="/pro" />;
    return <Redirect href={{ pathname: '/paywall', params: { reason: feature, ...(sessionId ? { sessionId } : {}) } }} />;
}
