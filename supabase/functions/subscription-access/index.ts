import { createClient } from 'npm:@supabase/supabase-js@2.98.0';
const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const response = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json' },
    });
Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return response({});
    if (req.method !== 'POST')
        return response({ error: 'Method not allowed' }, 405);
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer '))
        return response({ error: 'Not authenticated' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false },
    });
    const {
        data: { user },
        error: authError,
    } = await client.auth.getUser(authorization.slice(7));
    if (authError || !user)
        return response({ error: 'Not authenticated' }, 401);
    try {
        // The same public SDK key as the iOS app can read Customer Info via v1.
        // A private API key may optionally be supplied through server secrets.
        const key =
            Deno.env.get('REVENUECAT_API_KEY') ||
            'appl_txIQHoyExsJQrrCekQjlfhNEOMs';
        const rc = await fetch(
            `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
            {
                headers: { Authorization: `Bearer ${key}` },
                signal: AbortSignal.timeout(10000),
            },
        );
        if (!rc.ok)
            return response(
                { error: 'Subscription verification unavailable' },
                503,
            );
        const info = await rc.json();
        if (!info.subscriber?.entitlements)
            return response({ error: 'Invalid subscription response' }, 503);
        const entitlement = info.subscriber.entitlements['DJ Planner Pro'];
        const now = Date.now();
        const expiry = entitlement
            ? Math.max(
                  entitlement.expires_date === null
                      ? Infinity
                      : Date.parse(entitlement.expires_date),
                  entitlement.grace_period_expires_date
                      ? Date.parse(entitlement.grace_period_expires_date)
                      : 0,
              )
            : 0;
        const validUntil = new Date(
            expiry > now ? Math.min(expiry, now + 5 * 60 * 1000) : now,
        ).toISOString();
        const admin = createClient(
            url,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
            { auth: { persistSession: false } },
        );
        const { error } = await admin.rpc('sync_subscription_access', {
            account_id: user.id,
            valid_until: validUntil,
        });
        if (error)
            return response(
                { error: 'Subscription synchronization unavailable' },
                503,
            );
        const { data, error: usageError } =
            await client.rpc('get_session_usage');
        if (usageError) return response({ error: 'Usage unavailable' }, 503);
        return response(data);
    } catch {
        return response(
            { error: 'Subscription verification unavailable' },
            503,
        );
    }
});
