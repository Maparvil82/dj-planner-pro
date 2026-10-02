import { useState } from 'react';
import { Image, Text, View, type ColorValue } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export function TabProfileIcon({
    url,
    name,
    size,
    color,
    focused,
    hasUnread = false,
}: {
    url?: string | null;
    name?: string | null;
    size: number;
    color: ColorValue;
    focused: boolean;
    hasUnread?: boolean;
}) {
    const { activeTheme } = useTheme();
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const showPhoto = !!url && failedUrl !== url;
    const initial = name?.trim().charAt(0).toLocaleUpperCase() || '?';
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
                        activeTheme === 'dark' ? '#283142' : '#e5e7eb',
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
                            fontSize: Math.round(size * 0.5),
                            fontWeight: '700',
                            color,
                        }}
                    >
                        {initial}
                    </Text>
                )}
            </View>
            {hasUnread && (
                <View
                    style={{
                        position: 'absolute',
                        top: -2,
                        right: -2,
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                        borderWidth: 2,
                        borderColor:
                            activeTheme === 'dark' ? '#111827' : '#fbfbfb',
                        backgroundColor:
                            activeTheme === 'dark' ? '#bdb0f5' : '#6554df',
                    }}
                />
            )}
        </View>
    );
}
