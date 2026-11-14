import { Platform } from 'react-native';
import Purchases, {
    CustomerInfo,
    PurchasesPackage,
    PurchasesOffering,
    LOG_LEVEL,
    PRODUCT_CATEGORY,
} from 'react-native-purchases';

// IMPORTANT: Using exactly this API Key as requested
const API_KEY_IOS = '';

// Android must use the public Google SDK key from the same RevenueCat project.
const API_KEY_ANDROID = '';
const API_KEY = Platform.OS === 'ios' ? API_KEY_IOS : Platform.OS === 'android' ? API_KEY_ANDROID : '';

// Store entitlement identifier, independent of the public app name "DJ Planner".
const PRO_ENTITLEMENT_ID = 'DJ Planner Pro';

class RevenueCatService {
    supportsPurchases(): boolean { return !!API_KEY; }
    async getStorefrontCountry(): Promise<string | null> {
        if (!this.isConfigured) return null;
        try { return (await Purchases.getStorefront())?.countryCode || null; }
        catch { return null; }
    }
    async getIntroEligibility(productIds: string[]): Promise<Record<string, boolean>> {
        if (!this.isConfigured || Platform.OS !== 'ios' || !productIds.length) return {};
        try {
            const result = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);
            return Object.fromEntries(Object.entries(result).map(([id, eligibility]) => [id,
                eligibility.status === Purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE]));
        } catch { return {}; }
    }
    private isConfigured = false;
    private configurationQueue: Promise<boolean> = Promise.resolve(false);

    /**
     * Configures the RevenueCat SDK.
     * @param appUserID - Optional Supabase user.id to sync purchases to the user.
     */
    configureRevenueCat(appUserID?: string): Promise<boolean> {
        // Serialize account changes so a slower previous login cannot win.
        this.configurationQueue = this.configurationQueue.catch(() => false).then(() => this.configureIdentity(appUserID));
        return this.configurationQueue;
    }
    private async configureIdentity(appUserID?: string): Promise<boolean> {
        if (!API_KEY) {
            if (__DEV__) console.warn('RevenueCat is not supported on this platform yet or missing API key.');
            return false;
        }

        try {
            if (!this.isConfigured) {
                // Provide more verbose logging in development
                Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);

                if (appUserID) {
                    // Using Supabase user.id as the appUserID in RevenueCat
                    Purchases.configure({ apiKey: API_KEY, appUserID });
                } else {
                    Purchases.configure({ apiKey: API_KEY });
                }

                this.isConfigured = true;
                if (__DEV__) console.log('[RevenueCat] Configured successfully');
            } else {
                // If it is already configured, we switch user instead of configuring again
                if (appUserID) {
                    await Purchases.logIn(appUserID);
                    if (__DEV__) console.log('[RevenueCat] Account changed');
                } else {
                    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
                    if (__DEV__) console.log('[RevenueCat] Logged out (anonymous)');
                }
            }
            return true;
        } catch (error) {
            if (__DEV__) console.error('[RevenueCat] Failed to configure or switch user:', error);
            return false;
        }
    }

    /**
     * Gets the current offering (set to 'default' ID in RevenueCat).
     */
    async getCurrentOffering(refreshProducts = false): Promise<PurchasesOffering | null> {
        try {
            const offerings = await Purchases.getOfferings();
            if (offerings.current !== null) {
                const offering = offerings.current;
                if (!refreshProducts || Platform.OS !== 'ios') return offering;
                // Refresh product metadata without changing package identifiers or attribution.
                // TestFlight may still return inconsistent metadata: the payment sheet is authoritative.
                const identifiers = [...new Set([offering.monthly, offering.annual].flatMap(pkg => pkg ? [pkg.product.identifier] : []))];
                if (!identifiers.length) return offering;
                const products = await Purchases.getProducts(identifiers, PRODUCT_CATEGORY.SUBSCRIPTION);
                const byId = new Map(products.map(product => [product.identifier, product]));
                const refresh = (pkg: PurchasesPackage | null): PurchasesPackage | null => {
                    if (!pkg) return null;
                    if (!identifiers.includes(pkg.product.identifier)) return pkg;
                    const product = byId.get(pkg.product.identifier);
                    return product ? { ...pkg, product } : null;
                };
                return { ...offering,
                    monthly: refresh(offering.monthly), annual: refresh(offering.annual),
                    availablePackages: offering.availablePackages.flatMap(pkg => { const updated = refresh(pkg); return updated ? [updated] : []; }),
                };
            } else {
                if (__DEV__) console.warn('[RevenueCat] No current offering configured.');
                return null;
            }
        } catch (error) {
            if (__DEV__) console.error('[RevenueCat] Error getting offerings:', error);
            return null;
        }
    }

    /**
     * Gets the monthly and annual packages from the specified offering.
     */
    getPackagesFromOffering(offering: PurchasesOffering): {
        monthly: PurchasesPackage | null;
        annual: PurchasesPackage | null;
    } {
        return {
            monthly: offering.monthly || null,
            annual: offering.annual || null,
        };
    }

    /**
     * Checks if the user has active Pro access based on customer info.
     */
    hasProAccess(customerInfo: CustomerInfo): boolean {
        // IMPORTANT: Checking exactly for "DJ Planner Pro" entitlement
        const activeEntitlements = customerInfo.entitlements.active;
        return typeof activeEntitlements[PRO_ENTITLEMENT_ID] !== 'undefined';
    }

    /**
     * Purchases a specific package.
     */
    async purchasePackage(pkg: PurchasesPackage): Promise<{
        success: boolean;
        customerInfo?: CustomerInfo;
        error?: any;
        userCancelled: boolean;
    }> {
        try {
            const { customerInfo } = await Purchases.purchasePackage(pkg);
            return {
                success: true,
                customerInfo,
                userCancelled: false,
            };
        } catch (error: any) {
            // Handle user cancellation gracefully
            if (error?.userCancelled) {
                if (__DEV__) console.log('[RevenueCat] User cancelled purchase');
                return { success: false, userCancelled: true, error };
            }
            if (__DEV__) console.error('[RevenueCat] Error purchasing package:', error);
            return { success: false, userCancelled: false, error };
        }
    }

    /**
     * Restores previous purchases for the user.
     */
    async restoreUserPurchases(): Promise<{
        success: boolean;
        customerInfo?: CustomerInfo;
        error?: any;
    }> {
        try {
            const customerInfo = await Purchases.restorePurchases();
            return { success: true, customerInfo };
        } catch (error: any) {
            if (__DEV__) console.error('[RevenueCat] Error restoring purchases:', error);
            return { success: false, error };
        }
    }

    /**
     * Fetches the latest customer info state from RevenueCat.
     */
    async getCustomerInfo(): Promise<CustomerInfo | null> {
        if (!this.isConfigured) return null;
        try {
            return await Purchases.getCustomerInfo();
        } catch (error) {
            if (__DEV__) console.error('[RevenueCat] Error fetching customer info:', error);
            return null;
        }
    }
}

export const rcService = new RevenueCatService();
