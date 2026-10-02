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
import { Plus, Search, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
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
    const { t } = useTranslation();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';
    const router = useRouter();
    const {
        data: venues = [],
        isLoading,
        isError,
        refetch,
        isRefetching,
    } = useVenuesQuery();
    const createVenueMutation = useCreateVenueMutation();
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [newCity, setNewCity] = useState('');
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
        if (saving.current || !newName.trim()) return;
        saving.current = true;
        setIsSaving(true);
        try {
            const duplicate = venues.find(
                (venue) => normalized(venue.name) === normalized(newName),
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
                ...(newCity.trim() ? { city: newCity.trim() } : {}),
                ...(newAddress.trim() ? { address: newAddress.trim() } : {}),
            });
            setIsAddModalVisible(false);
            setNewName('');
            setNewCity('');
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
                subtitle={t('places.intro')}
                action={
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={t('add_venue')}
                        onPress={() => setIsAddModalVisible(true)}
                        style={{
                            width: 46,
                            height: 46,
                            borderRadius: 16,
                            backgroundColor: '#6554df',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Plus size={24} color="#fff" />
                    </TouchableOpacity>
                }
            />
            <View
                style={{
                    flex: 1,
                    width: '100%',
                    maxWidth: 900,
                    alignSelf: 'center',
                }}
            >
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
                                    <View style={{ gap: 8 }}>
                                        <Text
                                            style={{
                                                color: muted,
                                                fontWeight: '600',
                                                fontSize: 13,
                                            }}
                                        >
                                            {t('venue_city')}
                                        </Text>
                                        <TextInput
                                            accessibilityLabel={t('venue_city')}
                                            placeholder={t(
                                                'places.cityPlaceholder',
                                            )}
                                            placeholderTextColor={muted}
                                            className="focus:outline-none"
                                            selectionColor="#8270e4"
                                            onFocus={() =>
                                                setFocusedField('city')
                                            }
                                            onBlur={() => setFocusedField(null)}
                                            value={newCity}
                                            onChangeText={setNewCity}
                                            autoCapitalize="words"
                                            editable={!isSaving}
                                            style={[
                                                inputStyle,
                                                {
                                                    borderColor:
                                                        focusedField === 'city'
                                                            ? '#8270e4'
                                                            : border,
                                                },
                                            ]}
                                        />
                                    </View>
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
                                disabled={!newName.trim() || isSaving}
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
