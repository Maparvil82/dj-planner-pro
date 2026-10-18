// Inject the Admin client to test the real orchestration without real accounts.
export function createDeletionHandler(admin: any, now = Date.now) {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
            'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    const respond = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
            status,
            headers: {
                ...cors,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            },
        });
    const work = async (action: string, target: string) => {
        const { data, error } = await admin.rpc('account_deletion_work', {
            action,
            target,
        });
        if (error) throw error;
        return data;
    };
    return async (req: Request) => {
        if (req.method === 'OPTIONS') return respond({});
        if (req.method !== 'POST')
            return respond({ error: 'METHOD_NOT_ALLOWED' }, 405);
        let input;
        try {
            input = await req.json();
        } catch {
            return respond({ error: 'INVALID_REQUEST' }, 400);
        }
        // The opaque, short-lived receipt only confirms completion. It cannot
        // identify an account, enumerate files or authorize deletion.
        if (input.action === 'receipt') {
            if (!/^[0-9a-f-]{36}$/i.test(input.receipt || ''))
                return respond({ error: 'INVALID_REQUEST' }, 400);
            try {
                return respond(await work('receipt', input.receipt));
            } catch {
                return respond({ error: 'DELETION_UNAVAILABLE' }, 503);
            }
        }
        if (
            !['start', 'delete'].includes(input.action) ||
            input.confirm !== true
        )
            return respond({ error: 'CONFIRMATION_REQUIRED' }, 400);
        const token = req.headers
            .get('Authorization')
            ?.match(/^Bearer (.+)$/)?.[1];
        if (!token) return respond({ error: 'AUTH_REQUIRED' }, 401);
        const {
            data: { user },
            error: authError,
        } = await admin.auth.getUser(token);
        if (authError || !user) return respond({ error: 'AUTH_REQUIRED' }, 401);
        let receipt: string | undefined;
        try {
            let page = await work('begin', user.id); // Never take an account ID from the request body.
            receipt = page.receipt;
            if (input.action === 'start')
                return respond({ complete: false, receipt, removed: 0 });
            let removed = 0;
            const deadline = now() + 20000;
            for (let batch = 0; batch < 8; batch++) {
                if (!page.objects.length) {
                    const { error } = await admin.auth.admin.deleteUser(
                        user.id,
                    );
                    if (error) throw error;
                    return respond({ complete: true, receipt, removed });
                }
                const groups = new Map<string, string[]>();
                for (const item of page.objects) {
                    const paths = groups.get(item.bucket_id) || [];
                    paths.push(item.name);
                    groups.set(item.bucket_id, paths);
                }
                for (const [bucket, paths] of groups) {
                    const { error } = await admin.storage
                        .from(bucket)
                        .remove(paths);
                    if (error) throw error;
                    removed += paths.length;
                }
                page = await work('page', user.id);
                if (now() >= deadline) break;
            }
            return respond({ complete: false, receipt, removed });
        } catch {
            // Preserve the job and account on failure; retries re-list remaining
            // objects from zero, avoiding offset skips and including orphan uploads.
            return respond({ error: 'DELETION_RETRY', receipt }, 503);
        }
    };
}
