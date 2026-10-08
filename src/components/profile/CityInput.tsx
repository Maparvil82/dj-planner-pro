import { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityFilterOptions } from '../../hooks/useCommunityQuery';
import { useAuthStore } from '../../store/useAuthStore';
import { communityCities, externalCities } from '../../services/cities';
import {
    normalizeCity,
    suggestCities,
    cityKey,
    cityLabel,
    mergeCitySuggestions,
    type CityLocation,
    type CitySuggestion,
} from '../../utils/cities';
import { useCommunityColors } from '../community/CommunityUI';

export function CityInput({
    value,
    onChange,
    location,
    onLocation,
    disabled,
    showHint = true,
}: {
    value: string;
    onChange: (value: string) => void;
    location: CityLocation | null;
    onLocation: (location: CityLocation | null) => void;
    disabled: boolean;
    showHint?: boolean;
}) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const viewer = useAuthStore((s) => s.session?.user.id);
    const [editing, setEditing] = useState(false);
    const [search, setSearch] = useState('');
    useEffect(() => {
        setSearch('');
        if (!editing || disabled || value.trim().length < 2) return;
        const timer = setTimeout(() => setSearch(value.trim()), 650);
        return () => clearTimeout(timer);
    }, [value, editing, disabled]);
    const cities = useCommunityFilterOptions('djs');
    const local = useQuery({
        queryKey: ['community', 'city-suggestions', viewer, cityKey(search)],
        queryFn: () => communityCities(search),
        enabled: !!viewer && search.length >= 2,
        staleTime: 60000,
        retry: false,
    });
    const remote = useQuery({
        queryKey: ['city-search', cityKey(search)],
        queryFn: ({ signal }) => externalCities(search, signal),
        enabled: search.length >= 3,
        staleTime: 24 * 60 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: false,
        refetchOnWindowFocus: false,
    });
    // Old/manual city labels remain usable while richer suggestions load.
    const fallback: CitySuggestion[] = suggestCities(
        value,
        (cities.data?.cities || []).filter((city) => !city.includes(' · ')),
    ).map((city) => ({ city, city_location: null }));
    const currentSearch = cityKey(search) === cityKey(value) && !!search;
    const localOptions = currentSearch && local.data ? local.data : fallback;
    const external = currentSearch ? remote.data || [] : [];
    const options = editing ? mergeCitySuggestions(localOptions, external) : [];
    const select = (item: CitySuggestion) => {
        onChange(item.city_location?.name || normalizeCity(item.city));
        onLocation(item.city_location);
        setEditing(false);
        setSearch('');
    };
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
                    onLocation(null);
                    onChange(text);
                }}
                onFocus={() => setEditing(true)}
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
            {!!location && !editing && (
                <Text style={{ color: c.muted, fontSize: 12 }}>
                    {cityLabel('', location).replace(/^ · /, '')}
                </Text>
            )}
            {showHint && (
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                    {t('profileUX.cityHybridHint')}
                </Text>
            )}
            {options.length > 0 && (
                <View
                    style={{
                        borderWidth: 1,
                        borderColor: c.border,
                        borderRadius: 15,
                        overflow: 'hidden',
                    }}
                >
                    {options.map((item, index) => {
                        const inCommunity = localOptions.includes(item);
                        const label = cityLabel(item.city, item.city_location);
                        return (
                            <TouchableOpacity
                                key={item.city_location?.id || label}
                                disabled={disabled}
                                accessibilityRole="button"
                                accessibilityLabel={label}
                                onPress={() => select(item)}
                                style={{
                                    paddingHorizontal: 15,
                                    paddingVertical: 13,
                                    borderTopWidth: index ? 1 : 0,
                                    borderColor: c.border,
                                    gap: 4,
                                }}
                            >
                                <Text
                                    style={{
                                        color: c.fg,
                                        fontSize: 14,
                                        fontWeight: '600',
                                    }}
                                >
                                    {item.city}
                                </Text>
                                {!!item.city_location && (
                                    <Text
                                        style={{ color: c.muted, fontSize: 12 }}
                                    >
                                        {[
                                            item.city_location.region,
                                            item.city_location.country,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </Text>
                                )}
                                <Text style={{ color: c.accent, fontSize: 11 }}>
                                    {t(
                                        inCommunity
                                            ? 'profileUX.cityCommunity'
                                            : 'profileUX.cityExternal',
                                    )}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
            {editing && currentSearch && remote.isFetching && (
                <View
                    style={{
                        flexDirection: 'row',
                        gap: 8,
                        alignItems: 'center',
                    }}
                >
                    <ActivityIndicator size="small" color={c.accent} />
                    <Text style={{ color: c.muted, fontSize: 12 }}>
                        {t('profileUX.citySearching')}
                    </Text>
                </View>
            )}
            {editing && currentSearch && (remote.isError || local.isError) && (
                <Text style={{ color: c.muted, fontSize: 12 }}>
                    {t('profileUX.cityUnavailable')}
                </Text>
            )}
            {editing && value.trim().length >= 2 && (
                <TouchableOpacity
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={t('profileUX.cityUseManual', {
                        city: normalizeCity(value),
                    })}
                    onPress={() => select({ city: value, city_location: null })}
                    style={{ paddingVertical: 10 }}
                >
                    <Text
                        style={{
                            color: c.accent,
                            fontSize: 13,
                            fontWeight: '600',
                        }}
                    >
                        {t('profileUX.cityUseManual', {
                            city: normalizeCity(value),
                        })}
                    </Text>
                </TouchableOpacity>
            )}
            {editing && external.length > 0 && (
                <TouchableOpacity
                    accessibilityRole="link"
                    onPress={() => {
                        void Linking.openURL(
                            'https://www.openstreetmap.org/copyright',
                        ).catch(() => {});
                    }}
                >
                    <Text style={{ color: c.muted, fontSize: 10 }}>
                        © OpenStreetMap contributors · Photon
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
