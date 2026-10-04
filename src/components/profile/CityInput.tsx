import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityFilterOptions } from '../../hooks/useCommunityQuery';
import { normalizeCity, suggestCities } from '../../utils/cities';
import { useCommunityColors } from '../community/CommunityUI';

export function CityInput({
    value,
    onChange,
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
}) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const [editing, setEditing] = useState(false);
    // Reuse the public-profile projection; private drafts never become suggestions.
    const cities = useCommunityFilterOptions('djs');
    const options = editing
        ? suggestCities(value, cities.data?.cities || [])
        : [];
    return (
        <View style={{ gap: 8 }}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>
                {t('venue_city')} *
            </Text>
            <TextInput
                accessibilityLabel={t('venue_city') + ' *'}
                value={value}
                onChangeText={(text) => {
                    setEditing(true);
                    onChange(text);
                }}
                onFocus={() => setEditing(true)}
                onBlur={() => onChange(normalizeCity(value))}
                editable={!disabled}
                maxLength={100}
                autoCapitalize="words"
                autoCorrect={false}
                style={{
                    minHeight: 52,
                    padding: 15,
                    borderRadius: 15,
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: c.field,
                    color: c.fg,
                    fontSize: 15,
                }}
            />
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                {t(
                    cities.isError
                        ? 'profileUX.cityUnavailable'
                        : 'profileUX.cityHint',
                )}
            </Text>
            {options.length > 0 && (
                <View
                    style={{
                        borderWidth: 1,
                        borderColor: c.border,
                        borderRadius: 15,
                        overflow: 'hidden',
                    }}
                >
                    {options.map((city, index) => (
                        <TouchableOpacity
                            key={city}
                            disabled={disabled}
                            accessibilityRole="button"
                            accessibilityLabel={city}
                            onPress={() => {
                                onChange(city);
                                setEditing(false);
                            }}
                            style={{
                                paddingHorizontal: 15,
                                paddingVertical: 13,
                                borderTopWidth: index ? 1 : 0,
                                borderColor: c.border,
                            }}
                        >
                            <Text style={{ color: c.fg, fontSize: 14 }}>
                                {city}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}
