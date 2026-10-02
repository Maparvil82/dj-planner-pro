import { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { Venue } from '../../types/venue';

export function VenueListCard({
    venue,
    onPress,
}: {
    venue: Venue;
    onPress: () => void;
}) {
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    const [failedImage, setFailedImage] = useState<string | null>(null);
    const muted = dark ? '#a8b2c6' : '#6d7588';
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={[venue.name, venue.city, venue.address]
                .filter(Boolean)
                .join(', ')}
            onPress={onPress}
            activeOpacity={0.8}
            style={{
                padding: 18,
                borderRadius: 24,
                backgroundColor: dark ? '#171d2c' : '#fff',
                borderWidth: 1,
                borderColor: dark ? '#252d40' : '#e9ecf3',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
            }}
        >
            {venue.images?.[0] && venue.images[0] !== failedImage ? (
                <Image
                    source={{ uri: venue.images[0] }}
                    onError={() => setFailedImage(venue.images?.[0] || null)}
                    style={{ width: 64, height: 64, borderRadius: 18 }}
                    resizeMode="cover"
                />
            ) : null}
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <Text
                    numberOfLines={2}
                    style={{
                        color: dark ? '#f3f4f8' : '#202538',
                        fontWeight: '700',
                        fontSize: 16,
                        lineHeight: 21,
                    }}
                >
                    {venue.name}
                </Text>
                {venue.city ? (
                    <Text
                        numberOfLines={1}
                        style={{
                            color: dark ? '#bdb0f5' : '#7666df',
                            fontWeight: '600',
                            fontSize: 12,
                        }}
                    >
                        {venue.city}
                    </Text>
                ) : null}
                {venue.address ? (
                    <Text
                        numberOfLines={2}
                        style={{ color: muted, fontSize: 12, lineHeight: 17 }}
                    >
                        {venue.address}
                    </Text>
                ) : null}
            </View>
            <ChevronRight size={17} color={dark ? '#657089' : '#afb5c5'} />
        </TouchableOpacity>
    );
}
