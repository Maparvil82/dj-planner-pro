export function createStorageMaintenanceHandler(admin: any) {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
            'authorization, apikey, x-client-info, content-type',
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
    return async (req: Request) => {
        if (req.method === 'OPTIONS') return respond({});
        if (req.method !== 'POST')
            return respond({ error: 'METHOD_NOT_ALLOWED' }, 405);
        const token = req.headers
            .get('Authorization')
            ?.match(/^Bearer (.+)$/)?.[1];
        if (!token) return respond({ error: 'AUTH_REQUIRED' }, 401);
        try {
            const {
                data: { user },
                error: authError,
            } = await admin.auth.getUser(token);
            if (authError || !user)
                return respond({ error: 'AUTH_REQUIRED' }, 401);
            const { data, error } = await admin.rpc('storage_cleanup_work', {
                action: 'claim',
                target: user.id,
            });
            if (error) throw error;
            const groups = new Map<string, string[]>();
            for (const file of data.objects) {
                const paths = groups.get(file.bucket_id) || [];
                paths.push(file.name);
                groups.set(file.bucket_id, paths);
            }
            let removed = 0;
            for (const [bucket, paths] of groups) {
                const { error: deletionError } = await admin.storage
                    .from(bucket)
                    .remove(paths);
                if (deletionError) throw deletionError;
                const { error: ackError } = await admin.rpc(
                    'storage_cleanup_work',
                    {
                        action: 'ack',
                        target: user.id,
                        items: paths.map((name) => ({
                            bucket_id: bucket,
                            name,
                        })),
                    },
                );
                if (ackError) throw ackError;
                removed += paths.length;
            }
            return respond({ removed });
        } catch {
            // Claims survive failures; retries cannot delete referenced replacements.
            return respond({ error: 'STORAGE_MAINTENANCE_RETRY' }, 503);
        }
    };
}
