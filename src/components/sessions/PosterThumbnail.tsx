import { useState } from 'react';
import { Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function PosterThumbnail({
    uri,
    color,
    width = 96,
}: {
    uri?: string | null;
    color?: string;
    width?: number;
}) {
    const [failedUri, setFailedUri] = useState<string | null>(null);
    return (
        <LinearGradient
            colors={[color || '#433b65', '#151c30']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
                width,
                height: (width * 4) / 3,
                borderRadius: 16,
                overflow: 'hidden',
                flexShrink: 0,
            }}
        >
            {uri && failedUri !== uri ? (
                <Image
                    source={{ uri }}
                    resizeMode="contain"
                    onError={() => setFailedUri(uri)}
                    accessible={false}
                    style={{ width: '100%', height: '100%' }}
                />
            ) : (
                <>
                    <View
                        style={{
                            position: 'absolute',
                            width: 140,
                            height: 140,
                            borderRadius: 70,
                            borderWidth: 1,
                            borderColor: '#ffffff20',
                            top: -65,
                            right: -65,
                        }}
                    />
                    <View
                        style={{
                            position: 'absolute',
                            width: 105,
                            height: 105,
                            borderRadius: 53,
                            borderWidth: 1,
                            borderColor: '#ffffff15',
                            top: -48,
                            right: -48,
                        }}
                    />
                </>
            )}
        </LinearGradient>
    );
}
