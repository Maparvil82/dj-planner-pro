import { CityInput } from '../../src/components/profile/CityInput';
import { cityKey, cityLabel, type CityLocation } from '../../src/utils/cities';
import { useTabBarScroll } from '../../src/contexts/TabBarVisibilityContext';
import React, { useState, useMemo, useRef, useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, ChevronLeft } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from '../../src/i18n/useTranslation';
import {
    useVenuesQuery,
    useCreateVenueMutation,
} from '../../src/hooks/useVenuesQuery';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { PageHeader } from '../../src/components/ui/PageHeader';
import {
    SessionFormHeader,
    SessionFormSection,
    SessionFormFooter,
} from '../../src/components/sessions/SessionFormLayout';
import { VenueListCard } from '../../src/components/venues/VenueListCard';
import { confirmAction } from '../../src/utils/confirmAction';
import { showError } from '../../src/utils/showError';

const normalized = (value: string) =>
    value
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase();

export default function VenuesScreen() {
    const onTabScroll = useTabBarScroll();
    const { t } = useTranslation();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';
    const router = useRouter();
    const params = useLocalSearchParams<{ create?: string }>();
    useEffect(() => {
        if (params.create === '1') {
            setIsAddModalVisible(true);
            router.setParams({ create: '' });
        }
    }, [params.create, router]);
    const [includeArchived, setIncludeArchived] = useState(false);
    const {
        data: venues = [],
        isLoading,
        isError,
        refetch,
        isRefetching,
    } = useVenuesQuery(includeArchived);
    const createVenueMutation = useCreateVenueMutation();
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [newCity, setNewCity] = useState('');
    const [newCityLocation, setNewCityLocation] = useState<CityLocation | null>(
        null,
    );
    const [newAddress, setNewAddress] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const saving = useRef(false);
    const text = isDark ? '#f3f4f8' : '#202538',
        muted = isDark ? '#a8b2c6' : '#6d7588',
        surface = isDark ? '#171d2c' : '#fff',
        border = isDark ? '#252d40' : '#e9ecf3',
        background = isDark ? '#0d1220' : '#f5f6fa';
    const filtered = useMemo(
        () =>
            [...venues]
                .filter((venue) =>
                    [venue.name, venue.city, venue.address].some((value) =>
                        normalized(value || '').includes(
                            normalized(searchQuery),
                        ),
                    ),
                )
                .sort((a, b) => a.name.localeCompare(b.name)),
        [venues, searchQuery],
    );
    const groupedVenues = useMemo(() => {
        const groups = new Map<string, typeof venues>();
        for (const venue of filtered) {
            const first = venue.name.charAt(0).toUpperCase(),
                letter = /[\p{L}\p{N}]/u.test(first) ? first : '#';
            groups.set(letter, [...(groups.get(letter) || []), venue]);
        }
        return [...groups.entries()].sort(([a], [b]) =>
            a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b),
        );
    }, [filtered]);
    const handleCreateVenue = async () => {
        if (saving.current || !newName.trim() || !newCity.trim()) return;
        saving.current = true;
        setIsSaving(true);
        try {
            const duplicate = venues.find(
                (venue) =>
                    normalized(venue.name) === normalized(newName) &&
                    cityKey(
                        cityLabel(venue.city || '', venue.city_location),
                    ) === cityKey(cityLabel(newCity, newCityLocation)) &&
                    normalized(venue.address || '') === normalized(newAddress),
            );
            if (duplicate) {
                if (
                    await confirmAction(
                        t('duplicate_venue_title'),
                        t('duplicate_venue_message'),
                        t('cancel'),
                        t('go_to_venue'),
                    )
                ) {
                    setIsAddModalVisible(false);
                    router.push(`/venue/${duplicate.id}`);
                }
                return;
            }
            await createVenueMutation.mutateAsync({
                name: newName.trim(),
                city: newCity.trim(),
                city_location: newCityLocation,
                ...(newAddress.trim() ? { address: newAddress.trim() } : {}),
            });
            setIsAddModalVisible(false);
            setNewName('');
            setNewCity('');
            setNewCityLocation(null);
            setNewAddress('');
        } catch {
            showError(t('error'), t('places.saveError'));
        } finally {
            saving.current = false;
            setIsSaving(false);
        }
    };
    const inputStyle = {
        borderWidth: 1,
        borderColor: border,
        backgroundColor: isDark ? '#111625' : '#f8f9fd',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
        color: text,
        fontSize: 16,
    };
    return (
        <SafeAreaView
            style={{ flex: 1, backgroundColor: background }}
            edges={['top', 'left', 'right']}
        >
            <PageHeader
                title={t('venues_title')}
                showPlaces={false}
                leading={
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={t('go_back')}
                        onPress={() =>
                            router.canGoBack()
                                ? router.back()
                                : router.replace('/home')
                        }
                        style={{
                            width: 44,
                            height: 44,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <ChevronLeft size={22} color={text} />
                    </TouchableOpacity>
                }
                subtitle={t('places.intro')}
            />
            <View
                style={{
                    flex: 1,
                    width: '100%',
                    maxWidth: 900,
                    alignSelf: 'center',
                }}
            >
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('add_venue')}
                    onPress={() => setIsAddModalVisible(true)}
                    style={{
                        alignSelf: 'flex-start',
                        marginHorizontal: 20,
                        marginBottom: 14,
                        paddingHorizontal: 18,
                        paddingVertical: 13,
                        borderRadius: 14,
                        backgroundColor: isDark ? '#292743' : '#f0edfc',
                    }}
                >
                    <Text
                        style={{
                            color: isDark ? '#bdb0f5' : '#6554df',
                            fontSize: 14,
                            fontWeight: '700',
                        }}
                    >
                        {t('add_venue')}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setIncludeArchived((v) => !v)}
                    accessibilityRole="button"
                    style={{ paddingVertical: 12, alignSelf: 'flex-end' }}
                >
                    <Text
                        style={{
                            color: muted,
                            fontSize: 13,
                            fontWeight: '600',
                        }}
                    >
                        {t(
                            includeArchived
                                ? 'location.hideArchived'
                                : 'location.showArchived',
                        )}
                    </Text>
                </TouchableOpacity>
                <View
                    style={{
                        marginHorizontal: 20,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderRadius: 18,
                        backgroundColor: surface,
                        borderWidth: 1,
                        borderColor: border,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                    }}
                >
                    <Search size={19} color={muted} />
                    <TextInput
                        accessibilityLabel={t('places.search')}
                        placeholder={t('places.search')}
                        placeholderTextColor={muted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            color: text,
                            fontSize: 14,
                        }}
                    />
                    {searchQuery ? (
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={t('filter_reset')}
                            onPress={() => setSearchQuery('')}
                        >
                            <X size={18} color={muted} />
                        </TouchableOpacity>
                    ) : null}
                </View>
                <ScrollView
                    onScroll={onTabScroll}
                    scrollEventThrottle={16}
                    contentContainerStyle={{
                        paddingHorizontal: 20,
                        paddingTop: 20,
                        paddingBottom: 110,
                        gap: 18,
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching}
                            onRefresh={refetch}
                            tintColor="#8270e4"
                        />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {isLoading ? (
                        <ActivityIndicator
                            color="#8270e4"
                            size="large"
                            style={{ marginTop: 32 }}
                        />
                    ) : isError ? (
                        <View
                            style={{
                                padding: 24,
                                gap: 16,
                                backgroundColor: surface,
                                borderRadius: 24,
                            }}
                        >
                            <Text style={{ color: muted }}>
                                {t('insights.loadingError')}
                            </Text>
                            <TouchableOpacity
                                accessibilityRole="button"
                                onPress={() => refetch()}
                            >
                                <Text
                                    style={{
                                        color: '#8270e4',
                                        fontWeight: '700',
                                    }}
                                >
                                    {t('insights.retry')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : !filtered.length ? (
                        <View
                            style={{
                                backgroundColor: surface,
                                borderWidth: 1,
                                borderColor: border,
                                borderRadius: 24,
                                padding: 30,
                                alignItems: 'center',
                                gap: 16,
                            }}
                        >
                            <Text
                                style={{
                                    color: text,
                                    fontSize: 16,
                                    fontWeight: '700',
                                    textAlign: 'center',
                                }}
                            >
                                {t(
                                    searchQuery
                                        ? 'no_results_filtered'
                                        : 'no_venues_yet',
                                )}
                            </Text>
                            <TouchableOpacity
                                accessibilityRole="button"
                                onPress={() =>
                                    searchQuery
                                        ? setSearchQuery('')
                                        : setIsAddModalVisible(true)
                                }
                            >
                                <Text
                                    style={{
                                        color: '#8270e4',
                                        fontWeight: '700',
                                    }}
                                >
                                    {t(
                                        searchQuery
                                            ? 'filter_reset'
                                            : 'add_venue',
                                    )}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        groupedVenues.map(([letter, items]) => (
                            <View key={letter} style={{ gap: 12 }}>
                                <Text
                                    style={{
                                        color: muted,
                                        fontSize: 12,
                                        fontWeight: '700',
                                        marginLeft: 4,
                                    }}
                                >
                                    {letter}
                                </Text>
                                <View className="flex-row flex-wrap gap-4">
                                    {items.map((venue) => (
                                        <View
                                            key={venue.id}
                                            className="w-full md:w-[48.5%]"
                                        >
                                            <VenueListCard
                                                venue={venue}
                                                onPress={() =>
                                                    router.push(
                                                        `/venue/${venue.id}`,
                                                    )
                                                }
                                            />
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>
            <Modal
                visible={isAddModalVisible}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => {
                    if (!isSaving) setIsAddModalVisible(false);
                }}
            >
                <SafeAreaProvider>
                    <SafeAreaView
                        style={{ flex: 1, backgroundColor: background }}
                        edges={['top', 'bottom', 'left', 'right']}
                    >
                        <SessionFormHeader
                            title={t('add_venue')}
                            subtitle={t('places.addIntro')}
                            onClose={() => {
                                if (!isSaving) setIsAddModalVisible(false);
                            }}
                        />
                        <KeyboardAvoidingView
                            style={{ flex: 1 }}
                            behavior={
                                Platform.OS === 'ios' ? 'padding' : undefined
                            }
                            keyboardVerticalOffset={
                                Platform.OS === 'ios' ? 90 : 0
                            }
                        >
                            <ScrollView
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode="on-drag"
                                contentContainerStyle={{
                                    paddingHorizontal: 20,
                                    paddingBottom: 130,
                                    width: '100%',
                                    maxWidth: 900,
                                    alignSelf: 'center',
                                    gap: 16,
                                }}
                            >
                                <SessionFormSection
                                    kind="event"
                                    title={t('places.details')}
                                >
                                    <View style={{ gap: 8 }}>
                                        <Text
                                            style={{
                                                color: muted,
                                                fontWeight: '600',
                                                fontSize: 13,
                                            }}
                                        >
                                            {t('venue_name')} *
                                        </Text>
                                        <TextInput
                                            accessibilityLabel={t('venue_name')}
                                            placeholder={t('venue_placeholder')}
                                            placeholderTextColor={muted}
                                            className="focus:outline-none"
                                            selectionColor="#8270e4"
                                            onFocus={() =>
                                                setFocusedField('name')
                                            }
                                            onBlur={() => setFocusedField(null)}
                                            value={newName}
                                            onChangeText={setNewName}
                                            autoCapitalize="words"
                                            autoFocus
                                            editable={!isSaving}
                                            style={[
                                                inputStyle,
                                                {
                                                    borderColor:
                                                        focusedField === 'name'
                                                            ? '#8270e4'
                                                            : border,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            color: muted,
                                            fontSize: 12,
                                            lineHeight: 18,
                                        }}
                                    >
                                        {t('places.nameHint')}
                                    </Text>
                                </SessionFormSection>
                                <SessionFormSection
                                    kind="location"
                                    title={t('places.location')}
                                >
                                    <CityInput
                                        value={newCity}
                                        onChange={setNewCity}
                                        location={newCityLocation}
                                        onLocation={setNewCityLocation}
                                        disabled={isSaving}
                                    />
                                    <View style={{ gap: 8 }}>
                                        <Text
                                            style={{
                                                color: muted,
                                                fontWeight: '600',
                                                fontSize: 13,
                                            }}
                                        >
                                            {t('venue_address')}
                                        </Text>
                                        <TextInput
                                            accessibilityLabel={t(
                                                'venue_address',
                                            )}
                                            placeholder={t(
                                                'places.addressPlaceholder',
                                            )}
                                            placeholderTextColor={muted}
                                            className="focus:outline-none"
                                            selectionColor="#8270e4"
                                            onFocus={() =>
                                                setFocusedField('address')
                                            }
                                            onBlur={() => setFocusedField(null)}
                                            value={newAddress}
                                            onChangeText={setNewAddress}
                                            autoCapitalize="words"
                                            editable={!isSaving}
                                            style={[
                                                inputStyle,
                                                {
                                                    borderColor:
                                                        focusedField ===
                                                        'address'
                                                            ? '#8270e4'
                                                            : border,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            color: muted,
                                            fontSize: 12,
                                            lineHeight: 18,
                                        }}
                                    >
                                        {t('places.locationHint')}
                                    </Text>
                                </SessionFormSection>
                            </ScrollView>
                            <SessionFormFooter
                                label={t('save_venue')}
                                disabled={
                                    !newName.trim() ||
                                    !newCity.trim() ||
                                    isSaving
                                }
                                busy={isSaving}
                                onSave={handleCreateVenue}
                            />
                        </KeyboardAvoidingView>
                    </SafeAreaView>
                </SafeAreaProvider>
            </Modal>
        </SafeAreaView>
    );
}
