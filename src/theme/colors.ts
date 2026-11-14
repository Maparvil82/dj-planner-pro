import darkPalette from './darkPalette.json';

export const DEFAULT_SESSION_COLOR = '#34D399';

export const colors = {
    light: {
        background: '#FFFFFF',
        text: '#111827',
        primary: '#3B82F6',
        border: '#E5E7EB',
    },
    dark: {
        ...darkPalette,
    },
};
