import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import Purchases from 'react-native-purchases';
import { rcService } from '../services/revenuecat';
import { useAuthStore } from '../store/useAuthStore';
import { Platform } from 'react-native';

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

export const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
    children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
    // Auth context to bind appUserID (Supabase user.id) to RevenueCat
    const { user } = useAuthStore();

    const [isPro, setIsPro] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
    const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

    const configuredRef = useRef(false);

    useEffect(() => {
        // Skip for unsupported platforms right now to avoid errors on web
        if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
            setIsLoading(false);
            return;
        }

        const initializeRevenueCat = async () => {
            setIsLoading(true);

            // Configure RC. Using useAuthStore meaning when user changes, this will re-run
            await rcService.configureRevenueCat(user?.id);
            configuredRef.current = true;

            await loadData();

            setIsLoading(false);
        };

        initializeRevenueCat();
    }, [user?.id]);

    useEffect(() => {
        if (!configuredRef.current) return;

        // Add a listener to handle customer info updates outside our direct actions (e.g. renewals)
        // This is recommended by RevenueCat docs to keep state fresh
        const updateListener = (info: CustomerInfo) => {
            updateStateWithCustomerInfo(info);
        };

        Purchases.addCustomerInfoUpdateListener(updateListener);
        return () => {
            Purchases.removeCustomerInfoUpdateListener(updateListener);
        };
    }, []);

    const loadData = async () => {
        try {
            const [info, offering] = await Promise.all([
                rcService.getCustomerInfo(),
                rcService.getCurrentOffering(),
            ]);

            if (info) {
                updateStateWithCustomerInfo(info);
            }
            if (offering) {
                setCurrentOffering(offering);
            }
        } catch (error) {
            console.error('[SubscriptionProvider] Error loading data:', error);
        }
    };

    const updateStateWithCustomerInfo = (info: CustomerInfo) => {
        setCustomerInfo(info);
        setIsPro(rcService.hasProAccess(info));
    };

    const refreshSubscriptionStatus = async () => {
        setIsLoading(true);
        const info = await rcService.getCustomerInfo();
        if (info) {
            updateStateWithCustomerInfo(info);
        }
        setIsLoading(false);
    };

    const purchaseMonthly = async (): Promise<boolean> => {
        if (!currentOffering?.monthly) return false;

        setIsLoading(true);
        const result = await rcService.purchasePackage(currentOffering.monthly);

        if (result.success && result.customerInfo) {
            updateStateWithCustomerInfo(result.customerInfo);
        }
        setIsLoading(false);
        return result.success;
    };

    const purchaseAnnual = async (): Promise<boolean> => {
        if (!currentOffering?.annual) return false;

        setIsLoading(true);
        const result = await rcService.purchasePackage(currentOffering.annual);

        if (result.success && result.customerInfo) {
            updateStateWithCustomerInfo(result.customerInfo);
        }
        setIsLoading(false);
        return result.success;
    };

    const restorePurchases = async (): Promise<boolean> => {
        setIsLoading(true);
        const result = await rcService.restoreUserPurchases();

        if (result.success && result.customerInfo) {
            updateStateWithCustomerInfo(result.customerInfo);
        }
        setIsLoading(false);
        return result.success;
    };

    const packages = currentOffering ? rcService.getPackagesFromOffering(currentOffering) : { monthly: null, annual: null };

    return (
        <SubscriptionContext.Provider
            value={{
                isPro,
                isLoading,
                offerings: currentOffering, // Backwards compat or generic
                currentOffering,
                monthlyPackage: packages.monthly,
                annualPackage: packages.annual,
                customerInfo,
                refreshSubscriptionStatus,
                purchaseMonthly,
                purchaseAnnual,
                restorePurchases,
            }}
        >
            {children}
        </SubscriptionContext.Provider>
    );
};
