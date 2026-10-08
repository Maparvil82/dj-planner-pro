import { supabase } from '../lib/supabase';
import type { SessionUsage } from '../utils/sessionLimit';

export async function getSessionUsage(): Promise<SessionUsage> {
    const { data, error } = await supabase.rpc('get_session_usage');
    if (error || !data) throw new Error('billing.usageError');
    return data as SessionUsage;
}
// RevenueCat status is fetched by our server for the authenticated Supabase ID.
// No client-provided boolean can grant unlimited sessions.
export async function syncSubscriptionAccess(): Promise<SessionUsage> {
    const { data, error } = await supabase.functions.invoke(
        'subscription-access',
    );
    if (error || !data || data.error)
        throw new Error('billing.verificationError');
    return data as SessionUsage;
}
