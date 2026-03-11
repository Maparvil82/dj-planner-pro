import { Platform } from 'react-native';
import Purchases, {
    CustomerInfo,
    PurchasesPackage,
    PurchasesOffering,
    LOG_LEVEL,
} from 'react-native-purchases';

// IMPORTANT: Using exactly this API Key as requested
const API_KEY_IOS = 'appl_txIQHoyExsJQrrCekQjlfhNEOMs';

// We only support iOS for now
const API_KEY = Platform.OS === 'ios' ? API_KEY_IOS : '';

// The exact entitlement we are looking for: "DJ Planner Pro"
const PRO_ENTITLEMENT_ID = 'DJ Planner Pro';

class RevenueCatService {
    private isConfigured = false;

    /**
     * Configures the RevenueCat SDK.
     * @param appUserID - Optional Supabase user.id to sync purchases to the user.
     */
    async configureRevenueCat(appUserID?: string): Promise<void> {
        if (!API_KEY) {
            console.warn('RevenueCat is not supported on this platform yet or missing API key.');
            return;
        }

        try {
            if (!this.isConfigured) {
                // Provide more verbose logging in development
                Purchases.setLogLevel(LOG_LEVEL.DEBUG);

                if (appUserID) {
                    // Using Supabase user.id as the appUserID in RevenueCat
                    Purchases.configure({ apiKey: API_KEY, appUserID });
                } else {
                    Purchases.configure({ apiKey: API_KEY });
                }

                this.isConfigured = true;
                console.log('[RevenueCat] Configured successfully with User ID:', appUserID || 'anonymous');
            } else {
                // If it is already configured, we switch user instead of configuring again
                if (appUserID) {
                    await Purchases.logIn(appUserID);
                    console.log('[RevenueCat] Logged in with User ID:', appUserID);
                } else {
                    await Purchases.logOut();
                    console.log('[RevenueCat] Logged out (anonymous)');
                }
            }
        } catch (error) {
            console.error('[RevenueCat] Failed to configure or switch user:', error);
        }
    }

    /**
     * Gets the current offering (set to 'default' ID in RevenueCat).
     */
    async getCurrentOffering(): Promise<PurchasesOffering | null> {
        try {
            const offerings = await Purchases.getOfferings();
            if (offerings.current !== null) {
                return offerings.current;
            } else {
                console.warn('[RevenueCat] No current offering configured.');
                return null;
            }
        } catch (error) {
            console.error('[RevenueCat] Error getting offerings:', error);
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
                console.log('[RevenueCat] User cancelled purchase');
                return { success: false, userCancelled: true, error };
            }
            console.error('[RevenueCat] Error purchasing package:', error);
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
            console.error('[RevenueCat] Error restoring purchases:', error);
            return { success: false, error };
        }
    }

    /**
     * Fetches the latest customer info state from RevenueCat.
     */
    async getCustomerInfo(): Promise<CustomerInfo | null> {
        try {
            return await Purchases.getCustomerInfo();
        } catch (error) {
            console.error('[RevenueCat] Error fetching customer info:', error);
            return null;
        }
    }
}

export const rcService = new RevenueCatService();
