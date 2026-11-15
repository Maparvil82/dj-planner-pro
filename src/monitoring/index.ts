import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';
import { privateEvent, privateTransaction, safeOperation } from './privacy';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
export const monitoringEnabled = Boolean(dsn) && (!__DEV__ || process.env.EXPO_PUBLIC_SENTRY_DEV_ENABLED === 'true');
const native = monitoringEnabled && !isRunningInExpoGo();
if (monitoringEnabled) Sentry.init({
    dsn, environment: __DEV__ ? 'development' : 'production',
    enableNative: native, enableNativeCrashHandling: native,
    sendDefaultPii: false, enableAutoSessionTracking: false,
    enableLogs: false, attachScreenshot: false, attachViewHierarchy: false,
    enableAutoBreadcrumbTracking: false, maxBreadcrumbs: 0,
    enableCaptureFailedRequests: false, enableAutoPerformanceTracing: false,
    enableUserInteractionTracing: false, enableAppStartTracking: false,
    enableNativeFramesTracking: false, enableStallTracking: false,
    tracesSampleRate: __DEV__ ? 1 : 0.1,
    // Profiling, replay and automatic HTTP collection are deliberately not enabled.
    integrations: defaults => defaults.filter(integration => !['Breadcrumbs', 'HttpContext', 'ExpoConstants', 'ExpoContext', 'ExpoUpdates', 'ExpoUpdatesListener'].includes(integration.name)),
    beforeBreadcrumb: () => null,
    beforeSend: (event, hint) => { hint.attachments = []; return privateEvent(event); },
    beforeSendTransaction: privateTransaction,
    tracePropagationTargets: [],
});

export const wrapMonitoringRoot = <P extends Record<string, unknown>>(component: React.ComponentType<P>) => monitoringEnabled ? Sentry.wrap(component) : component;
const reported = new Map<string, number>();
export function captureOperationFailure(operation: string, error: unknown) {
    if (!monitoringEnabled || (error as { name?: string })?.name === 'CancelledError') return;
    const name = safeOperation(operation), now = Date.now();
    if (now - (reported.get(name) ?? 0) < 60000) return;
    reported.set(name, now);
    Sentry.withScope(scope => { scope.setTag('operation', name); Sentry.captureException(error); });
}
export function startOperation(operation: string) {
    if (!monitoringEnabled) return () => {};
    const name = safeOperation(operation);
    const span = Sentry.startInactiveSpan({ name, op: name.startsWith('screen.') ? 'ui.load' : 'app.operation', forceTransaction: true });
    let ended = false;
    return (failed = false, cancelled = false) => {
        if (ended) return; ended = true;
        if (cancelled) span?.setAttribute('app.cancelled', true);
        span?.setStatus({ code: failed ? 2 : 1 }); span?.end();
    };
}
export function queryOperation(key: readonly unknown[]) {
    const family = key[0];
    return typeof family === 'string' && ['sessions', 'expenses', 'venues', 'notifications', 'community'].includes(family) ? `query.${family}` : 'query.other';
}

// Opt-in, development-only check. Never crash a user's app to verify reporting.
if (monitoringEnabled && __DEV__ && process.env.EXPO_PUBLIC_SENTRY_VERIFY === 'true') {
    Sentry.withScope(scope => {
        scope.setTag('operation', 'monitoring.check');
        const error = new Error('Synthetic SDK verification');
        error.name = 'MonitoringSDKCheck';
        Sentry.captureException(error);
    });
    startOperation('monitoring.check')();
}
