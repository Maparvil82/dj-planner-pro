import { useDarkPalette } from '../../contexts/ThemeContext';
import { useTheme } from '../../contexts/ThemeContext';
export function useCommunityColors() {
    const darkPalette = useDarkPalette();
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    return {
        dark,
        bg: dark ? darkPalette.background : '#f5f6fa',
        cardText: dark ? darkPalette.onSurface : '#202538',
        card: dark ? darkPalette.surface : '#fff',
        field: dark ? darkPalette.field : '#f8f9fd',
        fg: dark ? darkPalette.text : '#202538',
        muted: dark ? darkPalette.muted : '#6d7588',
        border: dark ? darkPalette.border : '#e9ecf3',
        accent: dark ? darkPalette.primary : '#6554df',
        onAccent: dark ? darkPalette.onPrimary : '#fff',
        tint: dark ? darkPalette.tint : '#f0edfc',
    };
}
