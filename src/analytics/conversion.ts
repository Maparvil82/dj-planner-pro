import type { CustomerInfo } from 'react-native-purchases';
import { captureAnalytics } from './index';

const reported = new Set<string>();

/** Called only for a completed checkout, never restore, refresh or entitlement listeners. */
export function recordProCheckout(input: {
    userId: string;
    previouslyPaid: boolean;
    success: boolean;
    userCancelled: boolean;
    customerInfo?: CustomerInfo;
    productId: string;
    plan: 'monthly' | 'yearly';
}) {
    const entitlement = input.customerInfo?.entitlements.active['DJ Planner Pro'];
    if (input.previouslyPaid || !input.success || input.userCancelled || !entitlement?.isActive) return;
    // Store free trials are not payments. Later automatic charges require RevenueCat webhooks.
    if (!['NORMAL', 'INTRO', 'PREPAID'].includes(entitlement.periodType.toUpperCase())) return;
    if (entitlement.productIdentifier !== input.productId || !entitlement.latestPurchaseDate || typeof entitlement.isSandbox !== 'boolean') return;
    const key = `${input.userId}:${input.productId}:${entitlement.latestPurchaseDate}`;
    if (reported.has(key)) return;
    if (captureAnalytics('pro_purchase_completed', { plan: input.plan, is_sandbox: entitlement.isSandbox }, input.userId)) reported.add(key);
}
