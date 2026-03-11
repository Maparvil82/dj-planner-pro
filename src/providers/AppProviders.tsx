import React from 'react';
import { ThemeProvider } from '../contexts/ThemeContext';
import { QueryProvider } from './QueryProvider';
import { useAuthBootstrap } from '../hooks/useAuthBootstrap';
import { SubscriptionProvider } from '../context/SubscriptionContext';
// import '../i18n'; // i18n is initialized here or in layout, let's keep it here for centralizing

/**
 * AppProviders encapsulates all the global application providers:
 * - React Query
 * - Theme (Light/Dark mode)
 * - i18n
 */
export const AppProviders = ({ children }: { children: React.ReactNode }) => {
    useAuthBootstrap();

    return (
        <QueryProvider>
            <ThemeProvider>
                <SubscriptionProvider>
                    {children}
                </SubscriptionProvider>
            </ThemeProvider>
        </QueryProvider>
    );
};
