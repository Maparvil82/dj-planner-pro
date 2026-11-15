import { useDarkPalette } from '../../contexts/ThemeContext';
import { StorageImage as Image } from './StorageImage';
import { useState } from 'react';
import { Text, View, type ColorValue } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export function TabProfileIcon({
    url,
    name,
    size,
    color,
    focused,
    unreadCount = 0,
}: {
    url?: string | null;
    name?: string | null;
    size: number;
    color: ColorValue;
    focused: boolean;
    unreadCount?: number;
}) {
    const darkPalette = useDarkPalette();
    const { activeTheme } = useTheme();
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const showPhoto = !!url && failedUrl !== url;
    const displayName = name?.trim() || '';
    const artistName = displayName.replace(/^dj\s+/i, '').trim() || displayName;
    const initials = artistName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase() || '?';
    return (
        <View style={{ width: size, height: size }}>
            <View
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                        activeTheme === 'dark' ? darkPalette.raised : '#e5e7eb',
                    borderColor: color,
                    borderWidth: focused ? 1.5 : 0,
                }}
            >
                {showPhoto ? (
                    <Image
                        source={{ uri: url }}
                        onError={() => setFailedUrl(url)}
                        resizeMode="cover"
                        style={{ width: '100%', height: '100%' }}
                    />
                ) : (
                    <Text
                        style={{
                            fontSize: Math.round(size * (Array.from(initials).length > 1 ? 0.36 : 0.5)),
                            fontWeight: '700',
                            color,
                        }}
                    >
                        {initials}
                    </Text>
                )}
            </View>
            {unreadCount > 0 && (
                <View
                    style={{
                        position: 'absolute',
                        top: -6,
                        right: -7,
                        minWidth: 20,
                        height: 20,
                        paddingHorizontal: 4,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                        borderWidth: 2,
                        borderColor:
                            activeTheme === 'dark' ? darkPalette.background : '#fbfbfb',
                        backgroundColor:
                            activeTheme === 'dark' ? darkPalette.primary : '#6554df',
                    }}
                >
                    <Text style={{ color: activeTheme === 'dark' ? '#171717' : '#fff', fontSize: 10, lineHeight: 12, fontWeight: '800' }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                </View>
            )}
        </View>
    );
}
