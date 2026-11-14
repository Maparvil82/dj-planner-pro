import { createClient } from 'npm:@supabase/supabase-js@2.98.0';
import { createDeletionHandler } from './handler.ts';
const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            fetch: (input, init) =>
                fetch(input, { ...init, signal: AbortSignal.timeout(25000) }),
        },
    },
);
Deno.serve(createDeletionHandler(admin));
