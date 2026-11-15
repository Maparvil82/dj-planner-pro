import type { Event, TransactionEvent } from '@sentry/react-native';

const operations = new Set(['query.sessions', 'query.expenses', 'query.venues', 'query.notifications', 'query.community', 'query.other', 'mutation.other', 'poster.generate', 'poster.edit', 'poster.purchase', 'poster.other', 'screen.home', 'screen.history', 'screen.calendar', 'screen.dashboard', 'monitoring.check']);
export function safeOperation(value: unknown) { return typeof value === 'string' && operations.has(value) ? value : 'query.other'; }
const identifier = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_.$@+:[\] -]{1,160}$/.test(value) ? value : undefined;
const basename = (value: unknown) => typeof value === 'string' ? identifier(value.split(/[?#]/)[0].split(/[/\\]/).pop()) : undefined;

/** Build an allowlist payload. Never carry query keys, route params, bodies or user messages. */
export function privateEvent<T extends Event>(event: T): T {
    const result: Event = {
        event_id: event.event_id, timestamp: event.timestamp, platform: event.platform,
        release: identifier(event.release), dist: identifier(event.dist), environment: identifier(event.environment), level: event.level,
        tags: { operation: safeOperation(event.tags?.operation) },
    };
    if (event.exception?.values) result.exception = { values: event.exception.values.slice(-6).map(value => ({
        type: identifier(value.type) || 'Error', value: 'Application error; private message removed',
        mechanism: value.mechanism ? { type: identifier(value.mechanism.type) || 'generic', handled: value.mechanism.handled } : undefined,
        stacktrace: value.stacktrace ? { frames: value.stacktrace.frames?.slice(-60).map(frame => ({
            filename: basename(frame.filename), function: identifier(frame.function), module: basename(frame.module),
            lineno: frame.lineno, colno: frame.colno, in_app: frame.in_app,
        })) } : undefined,
    })) };
    const contexts: NonNullable<Event['contexts']> = {};
    if (event.contexts?.trace) {
        const trace = event.contexts.trace;
        contexts.trace = { trace_id: trace.trace_id, span_id: trace.span_id, parent_span_id: trace.parent_span_id, op: identifier(trace.op), status: identifier(trace.status) };
    }
    for (const [context, fields] of Object.entries({ device: ['model', 'family', 'arch', 'manufacturer'], os: ['name', 'version'], app: ['app_version', 'app_build'] })) {
        const source = event.contexts?.[context];
        if (source) contexts[context] = Object.fromEntries(fields.filter(key => identifier(source[key])).map(key => [key, identifier(source[key])]));
    }
    result.contexts = contexts;
    if (event.debug_meta?.images) result.debug_meta = { images: event.debug_meta.images.map(image => {
        if (image.type === 'macho') return { type: image.type, debug_id: image.debug_id, code_file: basename(image.code_file), image_addr: image.image_addr, image_size: image.image_size };
        return { type: image.type, debug_id: image.debug_id, code_file: basename(image.code_file) || 'app.bundle' };
    }) };
    return result as T;
}

export function privateTransaction(event: TransactionEvent): TransactionEvent | null {
    // Only explicitly instrumented, static operation names are permitted.
    if (!event.transaction || !operations.has(event.transaction) || event.contexts?.trace?.data?.['app.cancelled']) return null;
    const result = privateEvent(event) as TransactionEvent;
    result.type = 'transaction'; result.transaction = event.transaction;
    result.start_timestamp = event.start_timestamp;
    result.transaction_info = { source: 'custom' };
    result.spans = []; // No automatically captured URLs, queries, route parameters or attributes.
    return result;
}
