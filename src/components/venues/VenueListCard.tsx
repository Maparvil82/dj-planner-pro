import { useDarkPalette } from '../../contexts/ThemeContext';
import { StorageImage as Image } from '../ui/StorageImage';
import { useTranslation } from '../../i18n/useTranslation';
import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
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
    const darkPalette = useDarkPalette();
    const { t } = useTranslation();
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    const [failedImage, setFailedImage] = useState<string | null>(null);
    const muted = dark ? darkPalette.muted : '#6d7588';
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
                backgroundColor: dark ? darkPalette.surface : '#fff',
                borderWidth: dark ? 0 : 1,
                borderColor: dark ? darkPalette.border : '#e9ecf3',
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
                    style={[{
                        color: dark ? darkPalette.text : '#202538',
                        fontWeight: '700',
                        fontSize: 16,
                        lineHeight: 21,
                    }, dark && { color: darkPalette.onSurface }]}
                >
                    {venue.name}
                </Text>
                {!!venue.archived_at && (
                    <Text
                        style={[{
                            color: '#8270e4',
                            fontSize: 11,
                            fontWeight: '700',
                        }, dark && { color: darkPalette.onSurface }]}
                    >
                        {t('location.archivedLabel')}
                    </Text>
                )}
                {venue.city ? (
                    <Text
                        numberOfLines={1}
                        style={[{
                            color: dark ? darkPalette.primary : '#7666df',
                            fontWeight: '600',
                            fontSize: 12,
                        }, dark && { color: darkPalette.onSurface }]}
                    >
                        {venue.city}
                    </Text>
                ) : null}
                {venue.address ? (
                    <Text
                        numberOfLines={2}
                        style={[{ color: muted, fontSize: 12, lineHeight: 17 }, dark && { color: darkPalette.onSurface }]}
                    >
                        {venue.address}
                    </Text>
                ) : null}
            </View>
            <ChevronRight size={17} color={dark ? darkPalette.muted : '#afb5c5'} />
        </TouchableOpacity>
    );
}
