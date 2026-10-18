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
        return getSessionUsage(); // Server-clock trial and short paid cache remain authoritative.
    return data as SessionUsage;
}

export async function startProTrial(): Promise<SessionUsage> {
    const { data, error } = await supabase.rpc('start_pro_trial');
    if (error || !data) throw new Error(error?.message?.startsWith('trial.') ? error.message : 'trial.activationError');
    return data as SessionUsage;
}

export async function getCurrentAccess(): Promise<SessionUsage> {
    const usage = await getSessionUsage();
    if (usage.trial?.status === 'active' || usage.paidPro) return usage;
    return syncSubscriptionAccess();
}
