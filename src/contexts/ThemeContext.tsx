import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { colorScheme, vars, useColorScheme as useStyledColorScheme } from 'nativewind';
import baseDarkPalette from '../theme/darkPalette.json';

export type ThemeType = 'light' | 'dark' | 'dark-honey' | 'dark-ocean' | 'dark-bubble';
const rgb = (hex: string) => hex.slice(1).match(/.{2}/g)!.map(value => parseInt(value, 16)).join(' ');
const honeyPalette = { ...baseDarkPalette, primary: '#EDB458', tint: '#382B1C' };
const oceanPalette = { ...baseDarkPalette, primary: '#0077B6', tint: '#142D3A', onPrimary: '#F7F7F7', heroEnd: '#00466B' };
const bubblePalette = { ...baseDarkPalette, primary: '#EF476F', tint: '#382029', onPrimary: '#171717', heroEnd: '#F58BA5' };
interface ThemeContextType {
    theme: ThemeType;
    activeTheme: 'light' | 'dark';
    darkPalette: typeof baseDarkPalette;
    setTheme: (theme: ThemeType) => void;
    isReady: boolean;
}
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const { colorScheme: styledColorScheme } = useStyledColorScheme();
    const [theme, setThemeState] = useState<ThemeType>('dark');
    const [hasLoadedTheme, setHasLoadedTheme] = useState(false);
    useEffect(() => {
        const loadTheme = async () => {
            try {
                const saved = await AsyncStorage.getItem('@theme');
                if (saved === 'light' || saved === 'dark' || saved === 'dark-honey' || saved === 'dark-ocean' || saved === 'dark-bubble') {
                    setThemeState(saved);
                } else {
                    // New installs and legacy system preferences start with dark lime.
                    const initial: ThemeType = 'dark';
                    setThemeState(initial);
                    await AsyncStorage.setItem('@theme', initial);
                }
            } catch (error) {
                console.error('Error loading theme:', error);
            } finally { setHasLoadedTheme(true); }
        };
        void loadTheme();
    }, []);
    const setTheme = async (next: ThemeType) => {
        setThemeState(next);
        try { await AsyncStorage.setItem('@theme', next); }
        catch (error) { console.error('Error saving theme:', error); }
    };
    const activeTheme = theme === 'light' ? 'light' : 'dark';
    const darkPalette = theme === 'dark-bubble' ? bubblePalette : theme === 'dark-ocean' ? oceanPalette : theme === 'dark-honey' ? honeyPalette : baseDarkPalette;
    // Apply the saved choice before showing the app, and wait for native styles
    // to acknowledge it instead of mixing dark text with light backgrounds.
    const isReady = hasLoadedTheme && styledColorScheme === activeTheme;
    useLayoutEffect(() => {
        if (hasLoadedTheme) colorScheme.set(activeTheme);
    }, [activeTheme, hasLoadedTheme]);
    useLayoutEffect(() => {
        // Web modals render in a portal outside the root View.
        if (Platform.OS === 'web') {
            document.documentElement.style.setProperty('--dj-primary', rgb(darkPalette.primary));
            document.documentElement.style.setProperty('--dj-tint', rgb(darkPalette.tint));
        }
    }, [darkPalette]);
    return (
        <ThemeContext.Provider value={{ theme, activeTheme, darkPalette, setTheme, isReady }}>
            <View style={[{ flex: 1, backgroundColor: activeTheme === 'dark' ? darkPalette.background : '#f5f6fa' }, vars({ '--dj-primary': rgb(darkPalette.primary), '--dj-tint': rgb(darkPalette.tint) })]}>
                {children}
            </View>
        </ThemeContext.Provider>
    );
};
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
};
export const useDarkPalette = () => useTheme().darkPalette;
