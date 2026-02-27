import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

type ThemeType = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: ThemeType;
    activeTheme: 'light' | 'dark'; // Provides the computed theme (if system is selected)
    setTheme: (theme: ThemeType) => void;
    isReady: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const systemColorScheme = useColorScheme();
    const [theme, setThemeState] = useState<ThemeType>('system');
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Load persisted theme
        const loadTheme = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem('@theme');
                if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
                    setThemeState(savedTheme);
                }
            } catch (error) {
                console.error('Error loading theme:', error);
            } finally {
                setIsReady(true);
            }
        };
        loadTheme();
    }, []);

    const setTheme = async (newTheme: ThemeType) => {
        setThemeState(newTheme);
        try {
            await AsyncStorage.setItem('@theme', newTheme);
        } catch (error) {
            console.error('Error saving theme:', error);
        }
    };

    const activeTheme = theme === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : theme;

    return (
        <ThemeContext.Provider value={{ theme, activeTheme, setTheme, isReady }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
