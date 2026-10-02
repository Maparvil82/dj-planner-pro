import React, {
    createContext,
    useEffect,
    useState,
    ReactNode,
    useRef,
} from 'react';
import Purchases, {
    CustomerInfo,
    PurchasesOffering,
    PurchasesPackage,
} from 'react-native-purchases';
import { AppState, Platform } from 'react-native';
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
    const generation = useRef(0);
    const ready = useRef(false);
    const apply = (info: CustomerInfo) => {
        setCustomerInfo(info);
        setIsPro(rcService.hasProAccess(info));
    };
    useEffect(() => {
        const version = ++generation.current;
        let cancelled = false;
        let listener: ((info: CustomerInfo) => void) | undefined;
        ready.current = false;
        setIsPro(false);
        setCustomerInfo(null);
        setCurrentOffering(null);
        setIsLoading(true);
        const initialize = async () => {
            try {
                if (
                    Platform.OS !== 'ios' ||
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
                const [info, offering] = await Promise.all([
                    rcService.getCustomerInfo(),
                    rcService.getCurrentOffering(),
                ]);
                if (cancelled) return;
                if (info) apply(info);
                setCurrentOffering(offering);
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
    }, [userId]);
    const refreshSubscriptionStatus = async () => {
        if (!ready.current) return;
        const version = generation.current;
        const info = await rcService.getCustomerInfo();
        if (info && generation.current === version) apply(info);
    };
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') void refreshSubscriptionStatus();
        });
        return () => subscription.remove();
    }, [userId]);
    const purchase = async (pkg: PurchasesPackage | null): Promise<boolean> => {
        if (!ready.current || !pkg || isLoading) return false;
        const version = generation.current;
        setIsLoading(true);
        try {
            const result = await rcService.purchasePackage(pkg);
            if (generation.current !== version) return false;
            if (result.customerInfo) apply(result.customerInfo);
            if (result.userCancelled) return false;
            if (!result.success) throw new Error('billing.purchaseError');
            return (
                !!result.customerInfo &&
                rcService.hasProAccess(result.customerInfo)
            );
        } finally {
            if (generation.current === version) setIsLoading(false);
        }
    };
    const restorePurchases = async (): Promise<boolean> => {
        if (!ready.current || isLoading) return false;
        const version = generation.current;
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
            if (generation.current === version) setIsLoading(false);
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
