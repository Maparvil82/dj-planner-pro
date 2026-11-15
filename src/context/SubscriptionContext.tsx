import { recordProCheckout } from '../analytics/conversion';
import React, {
    createContext,
    useEffect,
    useState,
    ReactNode,
    useRef,
    useCallback,
} from 'react';
import Purchases, {
    CustomerInfo,
    PurchasesOffering,
    PurchasesPackage,
} from 'react-native-purchases';
import { AppState } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { rcService } from '../services/revenuecat';
import { useAuthStore } from '../store/useAuthStore';

interface SubscriptionContextType {
    isPro: boolean;
    isLoading: boolean;
    offerings: PurchasesOffering | null;
    currentOffering: PurchasesOffering | null;
    monthlyPackage: PurchasesPackage | null;
    annualPackage: PurchasesPackage | null;
    customerInfo: CustomerInfo | null;
    storefrontCountryCode: string | null;
    refreshSubscriptionStatus: () => Promise<void>;
    purchaseMonthly: () => Promise<boolean>;
    purchaseAnnual: () => Promise<boolean>;
    restorePurchases: () => Promise<boolean>;
}
export const SubscriptionContext = createContext<
    SubscriptionContextType | undefined
>(undefined);
export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
    const userId = useAuthStore((state) => state.user?.id);
    const [isPro, setIsPro] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentOffering, setCurrentOffering] =
        useState<PurchasesOffering | null>(null);
    const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
    const [storefrontCountryCode, setStorefrontCountryCode] = useState<string | null>(null);
    const generation = useRef(0);
    const ready = useRef(false);
    const refreshRequest = useRef(0);
    const operationInFlight = useRef(false);
    const apply = useCallback((info: CustomerInfo) => {
        setCustomerInfo(info);
        setIsPro(rcService.hasProAccess(info));
    }, []);
    useEffect(() => {
        const version = ++generation.current;
        let cancelled = false;
        let listener: ((info: CustomerInfo) => void) | undefined;
        ready.current = false;
        operationInFlight.current = false;
        ++refreshRequest.current;
        setIsPro(false);
        setCustomerInfo(null);
        setCurrentOffering(null);
        setStorefrontCountryCode(null);
        setIsLoading(true);
        const initialize = async () => {
            try {
                if (
                    !rcService.supportsPurchases() ||
                    Constants.executionEnvironment ===
                        ExecutionEnvironment.StoreClient ||
                    !userId
                )
                    return;
                if (!(await rcService.configureRevenueCat(userId)) || cancelled)
                    return;
                // Attach only after configuration; remove on every account switch.
                listener = (info) => {
                    if (!cancelled) apply(info);
                };
                Purchases.addCustomerInfoUpdateListener(listener);
                const [info, offering, country] = await Promise.all([
                    rcService.getCustomerInfo(),
                    rcService.getCurrentOffering(true),
                    rcService.getStorefrontCountry(),
                ]);
                if (cancelled) return;
                if (info) apply(info);
                setCurrentOffering(offering);
                setStorefrontCountryCode(country);
                ready.current = true;
            } finally {
                if (!cancelled && generation.current === version)
                    setIsLoading(false);
            }
        };
        void initialize();
        return () => {
            cancelled = true;
            if (listener) Purchases.removeCustomerInfoUpdateListener(listener);
        };
    }, [userId, apply]);
    const refreshSubscriptionStatus = useCallback(async () => {
        if (!ready.current || operationInFlight.current) return;
        const version = generation.current;
        const request = ++refreshRequest.current;
        setIsLoading(true);
        try {
            const [info, offering, country] = await Promise.all([rcService.getCustomerInfo(), rcService.getCurrentOffering(true), rcService.getStorefrontCountry()]);
            if (generation.current !== version || refreshRequest.current !== request) return;
            if (info) apply(info);
            setCurrentOffering(offering);
            setStorefrontCountryCode(country);
        } finally {
            if (generation.current === version && refreshRequest.current === request) setIsLoading(false);
        }
    }, [apply]);
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') void refreshSubscriptionStatus();
        });
        return () => subscription.remove();
    }, [refreshSubscriptionStatus]);
    const purchase = async (pkg: PurchasesPackage | null): Promise<boolean> => {
        if (!ready.current || !pkg || isLoading || operationInFlight.current) return false;
        const version = generation.current;
        const previouslyPaid = !!customerInfo && rcService.hasProAccess(customerInfo);
        operationInFlight.current = true;
        ++refreshRequest.current;
        setIsLoading(true);
        try {
            const result = await rcService.purchasePackage(pkg);
            if (generation.current !== version) return false;
            if (result.customerInfo) apply(result.customerInfo);
            if (result.userCancelled) return false;
            if (!result.success) throw new Error('billing.purchaseError');
            if (userId && (pkg === currentOffering?.monthly || pkg === currentOffering?.annual)) {
                recordProCheckout({ ...result, userId, previouslyPaid, productId: pkg.product.identifier, plan: pkg === currentOffering?.monthly ? 'monthly' : 'yearly' });
            }
            return (
                !!result.customerInfo &&
                rcService.hasProAccess(result.customerInfo)
            );
        } finally {
            if (generation.current === version) {
                operationInFlight.current = false;
                setIsLoading(false);
            }
        }
    };
    const restorePurchases = async (): Promise<boolean> => {
        if (!ready.current || isLoading || operationInFlight.current) return false;
        const version = generation.current;
        operationInFlight.current = true;
        ++refreshRequest.current;
        setIsLoading(true);
        try {
            const result = await rcService.restoreUserPurchases();
            if (generation.current !== version) return false;
            if (!result.success) throw new Error('billing.restoreError');
            if (result.customerInfo) apply(result.customerInfo);
            return (
                !!result.customerInfo &&
                rcService.hasProAccess(result.customerInfo)
            );
        } finally {
            if (generation.current === version) {
                operationInFlight.current = false;
                setIsLoading(false);
            }
        }
    };
    return (
        <SubscriptionContext.Provider
            value={{
                isPro,
                isLoading,
                offerings: currentOffering,
                currentOffering,
                monthlyPackage: currentOffering?.monthly || null,
                annualPackage: currentOffering?.annual || null,
                customerInfo,
                storefrontCountryCode,
                refreshSubscriptionStatus,
                purchaseMonthly: () =>
                    purchase(currentOffering?.monthly || null),
                purchaseAnnual: () => purchase(currentOffering?.annual || null),
                restorePurchases,
            }}
        >
            {children}
        </SubscriptionContext.Provider>
    );
};
