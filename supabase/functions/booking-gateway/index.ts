import { createClient } from 'npm:@supabase/supabase-js@2.98.0';
const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
        status,
        headers: {
            ...cors,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer',
        },
    });
const sha = async (value: string) =>
    Array.from(
        new Uint8Array(
            await crypto.subtle.digest(
                'SHA-256',
                new TextEncoder().encode(value),
            ),
        ),
    )
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('');
const token = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('');
const publicErrors = new Set([
    'not_authenticated',
    'pro_required',
    'service_not_ready',
    'public_profile_required',
    'slug_taken',
    'invalid_input',
    'invalid_message',
    'invalid_timezone',
    'invalid_date',
    'invalid_deadline',
    'request_not_found',
    'request_closed',
    'link_unavailable',
    'access_expired',
    'email_unverified',
    'proposal_changed',
    'proposal_expired',
    'schedule_conflict',
    'booking_hold_conflict',
    'session_limit_reached',
]);
const safeError = (value: string) =>
    publicErrors.has(value) ? value : 'invalid_input';
const uuid = (v: unknown) =>
    typeof v === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const text = (v: unknown, max: number, required = true) =>
    typeof v === 'string' &&
    v.trim().length <= max &&
    (!required || !!v.trim());
const clock = (v: unknown) =>
    typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const date = (v: unknown) =>
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
const money = (v: unknown) =>
    typeof v === 'number' &&
    Number.isFinite(v) &&
    v >= 0 &&
    v <= 99999999.99 &&
    Math.abs(Math.round(v * 100) - v * 100) < 0.00001;
const schedule = (b: any) =>
    text(b.event_title, 120) &&
    text(b.venue, 160) &&
    text(b.city, 120) &&
    date(b.date) &&
    clock(b.start_time) &&
    clock(b.end_time) &&
    b.start_time !== b.end_time &&
    ['EUR', 'USD', 'GBP'].includes(b.currency);
Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return reply({});
    if (req.method !== 'POST') return reply({ error: 'invalid_action' }, 405);
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(
        url,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { persistSession: false } },
    );
    const web = Deno.env.get('BOOKING_WEB_ORIGIN') || '';
    let validOrigin = false;
    try {
        const parsed = new URL(web);
        validOrigin =
            parsed.protocol === 'https:' &&
            parsed.origin === web &&
            !parsed.username &&
            !parsed.password;
    } catch {
        /* Missing or malformed origin keeps publishing disabled. */
    }
    const ready =
        !!Deno.env.get('RESEND_API_KEY') &&
        !!Deno.env.get('BOOKING_MAIL_FROM') &&
        validOrigin;
    try {
        const raw = await req.text();
        if (raw.length > 16000) return reply({ error: 'invalid_input' }, 413);
        const { action, input = {} } = JSON.parse(raw);
        if (typeof action !== 'string')
            return reply({ error: 'invalid_action' }, 400);
        const auth = req.headers.get('Authorization') || '';
        const supportedActions = [
            'profile',
            'request',
            'verify',
            'read',
            'message',
            'changes',
            'accept',
            'decline',
            'deliver',
            'owner_status',
            'owner_settings',
            'owner_read',
            'owner_message',
            'owner_propose',
            'owner_decline',
            'owner_close',
            'owner_release_hold',
        ];
        if (!supportedActions.includes(action))
            return reply({ error: 'invalid_input' }, 400);
        const ownerAction = action.startsWith('owner_');
        let userId: string | undefined;
        let client: any;
        if (ownerAction) {
            if (!auth.startsWith('Bearer '))
                return reply({ error: 'not_authenticated' }, 401);
            client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
                global: { headers: { Authorization: auth } },
                auth: { persistSession: false },
            });
            const {
                data: { user },
                error,
            } = await client.auth.getUser(auth.slice(7));
            if (error || !user)
                return reply({ error: 'not_authenticated' }, 401);
            userId = user.id;
        }
        const limitKey = ownerAction
            ? `owner:${userId}`
            : await sha(
                  `visitor:${req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'}:${action}`,
              );
        const { data: allowed, error: limitError } = await admin.rpc(
            'booking_rate_limit',
            {
                key: limitKey,
                max_attempts: ownerAction
                    ? 120
                    : action === 'request'
                      ? 10
                      : 120,
            },
        );
        if (limitError) return reply({ error: 'temporarily_unavailable' }, 503);
        if (!allowed) return reply({ error: 'rate_limit' }, 429);
        const pro = async (id: string) => {
            const { data: cached } = await admin.rpc('booking_cached_access', {
                owner_id: id,
            });
            if (cached && Date.parse(cached.checked_at) > Date.now() - 240000)
                return Date.parse(cached.pro_until) > Date.now();
            const rc = await fetch(
                `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`,
                {
                    headers: {
                        Authorization: `Bearer ${Deno.env.get('REVENUECAT_API_KEY') || 'appl_txIQHoyExsJQrrCekQjlfhNEOMs'}`,
                    },
                    signal: AbortSignal.timeout(10000),
                },
            );
            if (!rc.ok) throw new Error('temporarily_unavailable');
            const info = await rc.json();
            if (!info.subscriber?.entitlements)
                throw new Error('temporarily_unavailable');
            const e = info.subscriber.entitlements['DJ Planner Pro'];
            const expires = e
                ? Math.max(
                      e.expires_date === null
                          ? Infinity
                          : Date.parse(e.expires_date),
                      e.grace_period_expires_date
                          ? Date.parse(e.grace_period_expires_date)
                          : 0,
                  )
                : 0;
            const active = expires > Date.now();
            const { error } = await admin.rpc('sync_subscription_access', {
                account_id: id,
                valid_until: new Date(
                    active
                        ? Math.min(expires, Date.now() + 300000)
                        : Date.now(),
                ).toISOString(),
            });
            if (error) throw new Error('temporarily_unavailable');
            return active;
        };
        // Private schemas are not exposed to the Data API: use service-only RPCs below.
        const deliver = async (requestId?: string) => {
            if (!ready) return false;
            const { data: item, error } = await admin.rpc(
                'booking_email_claim',
                { request_id: requestId || null },
            );
            if (error || !item) return false;
            const { data: r } = await admin
                .from('booking_requests')
                .select('*')
                .eq('id', item.request_id)
                .single();
            if (!r) {
                await admin.rpc('booking_email_finish', {
                    email_id: item.id,
                    delivered: false,
                });
                return false;
            }
            const fresh = token();
            const { data: access, error: a } = await admin.rpc(
                'booking_delivery_token',
                {
                    email_id: item.id,
                    new_token: fresh,
                    new_hash: await sha(fresh),
                },
            );
            if (a) {
                await admin.rpc('booking_email_finish', {
                    email_id: item.id,
                    delivered: false,
                });
                return false;
            }
            const target = `${web}/booking/${r.id}#access=${access}`;
            const lang = ['es', 'en', 'de', 'fr', 'it', 'pt', 'ja'].includes(
                r.language,
            )
                ? r.language
                : 'en';
            const copy: Record<string, string[]> = {
                es: [
                    'Verifica tu consulta',
                    'Hay novedades en tu contratación',
                    'Abre este enlace privado para verificar tu correo y consultar o responder a tu contratación. No necesitas instalar la app.',
                ],
                en: [
                    'Verify your enquiry',
                    'Your booking has an update',
                    'Open this private link to verify your email and view or reply to your booking. You do not need to install the app.',
                ],
                de: [
                    'Anfrage bestätigen',
                    'Neuigkeiten zu deiner Buchung',
                    'Öffne diesen privaten Link, um deine E-Mail zu bestätigen und deine Buchung anzusehen oder zu beantworten. Du brauchst keine App.',
                ],
                fr: [
                    'Vérifiez votre demande',
                    'Votre demande a été mise à jour',
                    'Ouvrez ce lien privé pour vérifier votre e-mail et consulter votre demande ou y répondre. Aucune application nécessaire.',
                ],
                it: [
                    'Verifica la richiesta',
                    'Novità sulla tua richiesta',
                    'Apri questo link privato per verificare l’email e visualizzare la richiesta o rispondere. Non serve installare l’app.',
                ],
                pt: [
                    'Verifica o teu pedido',
                    'Há novidades no teu pedido',
                    'Abre este link privado para verificar o email e consultar ou responder ao pedido. Não precisas de instalar a app.',
                ],
                ja: [
                    'お問い合わせの確認',
                    'お問い合わせが更新されました',
                    'この専用リンクでメールアドレスを確認し、依頼を表示または返信できます。アプリのインストールは不要です。',
                ],
            };
            let sent = false;
            try {
                const mail = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
                        'Content-Type': 'application/json',
                        'Idempotency-Key': item.id,
                    },
                    body: JSON.stringify({
                        from: Deno.env.get('BOOKING_MAIL_FROM'),
                        to: [r.promoter_email],
                        subject: `DJ Planner Pro · ${copy[lang][item.payload.kind === 'verify' ? 0 : 1]}`,
                        text: `${copy[lang][2]}\n\n${target}\n\nDJ Planner Pro`,
                    }),
                    signal: AbortSignal.timeout(15000),
                });
                sent = mail.ok;
            } catch {
                sent = false;
            }
            await admin.rpc('booking_email_finish', {
                email_id: item.id,
                delivered: sent,
            });
            return sent;
        };
        if (action === 'deliver') {
            if (auth !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`)
                return reply({ error: 'not_authenticated' }, 401);
            return reply({ delivered: await deliver() });
        }
        if (action === 'owner_status') {
            await admin.rpc('booking_set_ready', { ready });
            const [{ data: settings, error }, { data: profile }] =
                await Promise.all([
                    client
                        .from('booking_links')
                        .select('*')
                        .eq('owner_id', userId)
                        .maybeSingle(),
                    client
                        .from('community_profiles')
                        .select('*')
                        .eq('user_id', userId)
                        .maybeSingle(),
                ]);
            if (error) return reply({ error: 'temporarily_unavailable' }, 503);
            return reply({
                settings,
                profile,
                isPro: await pro(userId!),
                serviceReady: ready,
                webOrigin: ready ? web : null,
            });
        }
        if (action === 'owner_settings') {
            if (
                !text(input.slug, 40) ||
                !/^[a-z0-9][a-z0-9-]{2,39}$/.test(input.slug) ||
                !text(input.default_terms, 3000, false) ||
                !text(input.timezone, 80) ||
                typeof input.enabled !== 'boolean'
            )
                return reply({ error: 'invalid_input' }, 400);
            if (input.enabled && !ready)
                return reply({ error: 'service_not_ready' }, 503);
            if (input.enabled && !(await pro(userId!)))
                return reply({ error: 'pro_required' }, 403);
            await admin.rpc('booking_set_ready', { ready });
            const { data, error } = await client.rpc('booking_dj_action', {
                action: 'settings',
                input,
            });
            if (error)
                return reply(
                    {
                        error:
                            error.code === '23505'
                                ? 'slug_taken'
                                : error.message,
                    },
                    400,
                );
            return reply(data);
        }
        if (ownerAction) {
            const a = action.slice(6);
            if (
                ![
                    'read',
                    'message',
                    'propose',
                    'decline',
                    'close',
                    'release_hold',
                ].includes(a) ||
                !uuid(input.id)
            )
                return reply({ error: 'invalid_input' }, 400);
            if (
                ['message', 'release_hold'].includes(a) &&
                !text(input.body, 3000)
            )
                return reply({ error: 'invalid_message' }, 400);
            if (
                a === 'propose' &&
                (!schedule(input) ||
                    !money(input.fee) ||
                    !text(input.terms, 3000, false) ||
                    !Number.isInteger(input.expires_hours) ||
                    input.expires_hours < 1 ||
                    input.expires_hours > 168 ||
                    typeof input.hold !== 'boolean')
            )
                return reply({ error: 'invalid_input' }, 400);
            if (a === 'propose' && !(await pro(userId!)))
                return reply({ error: 'pro_required' }, 403);
            const { data, error } = await client.rpc('booking_dj_action', {
                action: a,
                input,
            });
            if (error) return reply({ error: safeError(error.message) }, 400);
            // The mutation has committed. A mail failure must not cause the DJ to repeat it.
            if (a !== 'read') {
                try {
                    await deliver(input.id);
                } catch {
                    /* The outbox worker retries. */
                }
            }
            return reply(data);
        }
        if (action === 'profile') {
            if (!text(input.slug, 40))
                return reply({ error: 'link_unavailable' }, 404);
            const { data: l } = await admin
                .from('booking_links')
                .select('owner_id,timezone')
                .eq('slug', input.slug)
                .eq('enabled', true)
                .maybeSingle();
            if (!l || !ready) return reply({ error: 'link_unavailable' }, 404);
            const { data: profile } = await admin
                .from('community_profiles')
                .select(
                    'artist_name,city,bio,genres,avatar_url,cover_url,mixcloud_url,soundcloud_url,instagram_url',
                )
                .eq('user_id', l.owner_id)
                .eq('is_visible', true)
                .maybeSingle();
            if (!profile || !(await pro(l.owner_id)))
                return reply({ error: 'link_unavailable' }, 404);
            const { data: shares } = await admin
                .from('community_session_shares')
                .select('session_id')
                .eq('user_id', l.owner_id)
                .limit(6);
            const { data: sessions } = shares?.length
                ? await admin
                      .from('sessions')
                      .select(
                          'id,title,venue,date,start_time,end_time,poster_url',
                      )
                      .eq('user_id', l.owner_id)
                      .eq('status', 'confirmed')
                      .in(
                          'id',
                          shares.map((s) => s.session_id),
                      )
                      .order('date', { ascending: false })
                : { data: [] };
            return reply({
                profile,
                sessions: sessions || [],
                timezone: l.timezone,
            });
        }
        if (action === 'request') {
            const { data: globalAllowed } = await admin.rpc(
                'booking_rate_limit',
                { key: 'global:requests', max_attempts: 100 },
            );
            if (!globalAllowed) return reply({ error: 'rate_limit' }, 429);
            if (!ready) return reply({ error: 'service_not_ready' }, 503);
            if (
                !schedule(input) ||
                !money(input.budget) ||
                !text(input.promoter_name, 80) ||
                !text(input.promoter_email, 254) ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.promoter_email) ||
                !text(input.body, 3000, false) ||
                !uuid(input.submission_key) ||
                !['es', 'en', 'de', 'fr', 'it', 'pt', 'ja'].includes(
                    input.language,
                )
            )
                return reply({ error: 'invalid_input' }, 400);
            const { data: l } = await admin
                .from('booking_links')
                .select('owner_id')
                .eq('slug', input.slug)
                .eq('enabled', true)
                .maybeSingle();
            if (!l || !(await pro(l.owner_id)))
                return reply({ error: 'link_unavailable' }, 404);
            const { data: emailAllowed } = await admin.rpc(
                'booking_rate_limit',
                {
                    key: await sha(
                        `email:${input.promoter_email.trim().toLowerCase()}`,
                    ),
                    max_attempts: 5,
                },
            );
            if (!emailAllowed) return reply({ error: 'rate_limit' }, 429);
            const access = token();
            const { data, error } = await admin.rpc('booking_guest_action', {
                action: 'request',
                input: {
                    ...input,
                    token: access,
                    token_hash: await sha(access),
                },
            });
            if (error) return reply({ error: safeError(error.message) }, 400);
            const { data: alreadySent } = await admin.rpc(
                'booking_email_sent',
                { request_id: data.id },
            );
            if (!alreadySent && !(await deliver(data.id)))
                return reply({ error: 'email_delivery_pending' }, 503);
            return reply({ sent: true });
        }
        if (
            ![
                'verify',
                'read',
                'message',
                'changes',
                'accept',
                'decline',
            ].includes(action) ||
            !uuid(input.id) ||
            typeof input.access !== 'string' ||
            !/^[a-f0-9]{64}$/.test(input.access)
        )
            return reply({ error: 'access_expired' }, 401);
        if (['message', 'changes'].includes(action) && !text(input.body, 3000))
            return reply({ error: 'invalid_message' }, 400);
        if (action === 'accept' && !uuid(input.proposal_id))
            return reply({ error: 'proposal_changed' }, 400);
        const { data: tokenAllowed } = await admin.rpc('booking_rate_limit', {
            key: await sha(`token:${input.access}`),
            max_attempts: 120,
        });
        if (!tokenAllowed) return reply({ error: 'rate_limit' }, 429);
        const accessHash = await sha(input.access);
        if (action === 'accept') {
            const { data: r, error } = await admin.rpc('booking_guest_action', {
                action: 'read',
                input: { id: input.id, token_hash: accessHash },
            });
            if (error) return reply({ error: 'access_expired' }, 401);
            await pro(r.request.owner_id);
        }
        const { data, error } = await admin.rpc('booking_guest_action', {
            action,
            input: { ...input, token_hash: accessHash },
        });
        if (error) return reply({ error: safeError(error.message) }, 400);
        // Promoter never receives owner identity, submission keys or private contact details.
        const { owner_id, submission_key, ...r } = data.request;
        return reply({ ...data, request: r });
    } catch {
        return reply({ error: 'temporarily_unavailable' }, 503);
    }
});
