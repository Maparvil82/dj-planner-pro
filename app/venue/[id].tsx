import { CityInput } from '../../src/components/profile/CityInput';
import { normalizeCity, type CityLocation } from '../../src/utils/cities';
import { FEATURES } from '../../src/config/features';
import React, { useState, useEffect, useContext, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2, Plus, X, Check, CloudOff, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { venueService } from '../../src/services/venues';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTranslation } from '../../src/i18n/useTranslation';
import {
    useVenueByIdQuery,
    useUpdateVenueMutation,
    useDeleteVenueMutation,
} from '../../src/hooks/useVenuesQuery';
import {
    useVaultFoldersByAssociationQuery,
    useCreateFolderMutation,
} from '../../src/hooks/useVaultQuery';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import {
    SessionFormHeader,
    SessionFormSection,
} from '../../src/components/sessions/SessionFormLayout';
import { confirmAction } from '../../src/utils/confirmAction';
import type { CreateVenueInput } from '../../src/types/venue';

export default function VenueDetailScreen() {
    const params = useLocalSearchParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const router = useRouter();
    const { t } = useTranslation();
    const themeCtx = useContext(ThemeContext);
    const { session } = useAuthStore();
    const isDark = themeCtx?.activeTheme === 'dark';
    const { data: venue, isLoading, error, refetch } = useVenueByIdQuery(id);
    const updateVenueMutation = useUpdateVenueMutation();
    const deleteVenueMutation = useDeleteVenueMutation();
    const { data: associatedFolders = [], isLoading: isLoadingFolders } =
        useVaultFoldersByAssociationQuery('venue', id || '');
    const createFolderMutation = useCreateFolderMutation();
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [cityLocation, setCityLocation] = useState<CityLocation | null>(null);
    const [contact, setContact] = useState('');
    const [notes, setNotes] = useState('');
    const [soundQuality, setSoundQuality] = useState(0);
    const [experienceRating, setExperienceRating] = useState(0);
    const [capacity, setCapacity] = useState('');
    const [equipment, setEquipment] = useState<
        Array<{ name: string; quantity: number }>
    >([]);
    const [images, setImages] = useState<string[]>([]);
    const [equipInput, setEquipInput] = useState('');
    const [equipQuantity, setEquipQuantity] = useState('1');
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<
        'idle' | 'saving' | 'saved' | 'error'
    >('idle');
    const revision = useRef(0);
    const inFlight = useRef(false);
    const hydrated = useRef<string | null>(null);
    const baseline = useRef<Partial<CreateVenueInput>>({});
    const changed = () => {
        revision.current += 1;
        setHasChanges(true);
        if (!inFlight.current) setSaveStatus('idle');
    };
    const input: CreateVenueInput = {
        name: name.trim(),
        address: address.trim(),
        city: normalizeCity(city),
        city_location: cityLocation,
        contact_info: contact.trim(),
        notes: notes.trim(),
        capacity: capacity.trim() ? Number(capacity) : null,
        equipment,
        images,
        sound_quality: soundQuality || null,
        experience_rating: experienceRating || null,
    };
    const validCapacity =
        !capacity.trim() ||
        (/^\d+$/.test(capacity.trim()) &&
            Number.isSafeInteger(Number(capacity)));
    const valid = !!name.trim() && validCapacity;
    const validQuantity =
        /^\d+$/.test(equipQuantity.trim()) &&
        Number.isSafeInteger(Number(equipQuantity)) &&
        Number(equipQuantity) > 0;

    useEffect(() => {
        // Refetches must not replace edits made while a save is in flight.
        if (!venue || hydrated.current === venue.id) return;
        hydrated.current = venue.id;
        let equipmentData: unknown = venue.equipment;
        if (typeof equipmentData === 'string') {
            try {
                equipmentData = JSON.parse(equipmentData);
            } catch {
                equipmentData = [];
            }
        }
        const items = Array.isArray(equipmentData) ? equipmentData : [];
        setName(venue.name || '');
        setAddress(venue.address || '');
        setCity(venue.city || '');
        setCityLocation(venue.city_location || null);
        setContact(venue.contact_info || '');
        setNotes(venue.notes || '');
        setCapacity(venue.capacity?.toString() || '');
        setSoundQuality(venue.sound_quality || 0);
        setExperienceRating(venue.experience_rating || 0);
        setEquipment(items);
        setImages(venue.images || []);
        baseline.current = {
            name: venue.name.trim(),
            address: (venue.address || '').trim(),
            city: normalizeCity(venue.city || ''),
            city_location: venue.city_location || null,
            contact_info: (venue.contact_info || '').trim(),
            notes: (venue.notes || '').trim(),
            capacity: venue.capacity ?? null,
            sound_quality: venue.sound_quality || null,
            experience_rating: venue.experience_rating || null,
            equipment: items,
            images: venue.images || [],
        };
        setHasChanges(false);
        setSaveStatus('idle');
    }, [venue]);

    const save = async (): Promise<boolean> => {
        if (!venue || !valid || inFlight.current || isSaving) return false;
        const savedRevision = revision.current;
        const patch = Object.fromEntries(
            Object.entries(input).filter(
                ([key, value]) =>
                    JSON.stringify(value) !==
                    JSON.stringify(
                        baseline.current[key as keyof CreateVenueInput],
                    ),
            ),
        ) as Partial<CreateVenueInput>;
        inFlight.current = true;
        setSaveStatus('saving');
        try {
            if (Object.keys(patch).length)
                await updateVenueMutation.mutateAsync({
                    venueId: venue.id,
                    input: patch,
                });
            baseline.current = input;
            const current = revision.current === savedRevision;
            if (current) {
                setHasChanges(false);
                setSaveStatus('saved');
            } else setSaveStatus('idle');
            return current;
        } catch {
            setSaveStatus('error');
            return false;
        } finally {
            inFlight.current = false;
        }
    };
    useEffect(() => {
        if (
            !hasChanges ||
            !venue ||
            !valid ||
            isSaving ||
            saveStatus === 'saving' ||
            saveStatus === 'error'
        )
            return;
        const timer = setTimeout(() => {
            void save();
        }, 1000);
        return () => clearTimeout(timer);
    }, [
        name,
        address,
        city,
        cityLocation,
        contact,
        notes,
        soundQuality,
        experienceRating,
        capacity,
        equipment,
        images,
        hasChanges,
        venue,
        isSaving,
        saveStatus,
    ]);

    const close = async () => {
        if (inFlight.current || isSaving || deleteVenueMutation.isPending)
            return;
        if (!hasChanges || (await save())) router.back();
    };
    const handleDelete = async () => {
        if (venue?.archived_at) {
            try {
                await updateVenueMutation.mutateAsync({
                    venueId: venue.id,
                    input: { archived_at: null },
                });
                router.back();
            } catch {
                Alert.alert(t('error'), t('places.saveError'));
            }
            return;
        }
        if (
            !venue ||
            !(await confirmAction(
                t(venue?.archived_at ? 'location.restore' : 'location.archive'),
                t('location.archiveMessage'),
                t('cancel'),
                t(venue?.archived_at ? 'location.restore' : 'location.archive'),
            ))
        )
            return;
        try {
            await deleteVenueMutation.mutateAsync(venue.id);
            router.back();
        } catch {
            Alert.alert(t('error'), t('places.saveError'));
        }
    };
    const pickAndUploadImage = async () => {
        if (isSaving) return;
        const permission =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
            Alert.alert(t('error'), t('camera_permission_denied'));
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.8,
        });
        if (result.canceled) return;
        setIsSaving(true);
        try {
            for (const asset of result.assets) {
                const url = await venueService.uploadVenueImage(
                    session!.user.id,
                    asset.uri,
                );
                if (!url) throw new Error('Upload failed');
                setImages((previous) => [...previous, url]);
                changed();
            }
        } catch {
            Alert.alert(t('error'), t('error_uploading'));
        } finally {
            setIsSaving(false);
        }
    };
    const handleDeleteImage = (index: number) => {
        // Unlink through the saved record; never delete a stored file before that succeeds.
        setImages((previous) => previous.filter((_, i) => i !== index));
        changed();
    };
    const fg = isDark ? '#f3f4f8' : '#202538';
    const muted = isDark ? '#a8b2c6' : '#6d7588';
    const fieldStyle = {
        backgroundColor: isDark ? '#111625' : '#f8f9fd',
        color: fg,
        borderColor: isDark ? '#30394e' : '#e9ecf3',
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 13,
        fontSize: 15,
        minHeight: 48,
    };
    const labelStyle = {
        color: muted,
        fontSize: 12,
        fontWeight: '600' as const,
        marginBottom: 8,
    };
    const field = (
        label: string,
        value: string,
        setter: (value: string) => void,
        extra: Partial<React.ComponentProps<typeof TextInput>> = {},
    ) => (
        <View>
            <Text style={labelStyle}>{label}</Text>
            <TextInput
                accessibilityLabel={label}
                value={value}
                onChangeText={(value) => {
                    setter(value);
                    changed();
                }}
                placeholderTextColor={muted}
                style={fieldStyle}
                {...extra}
            />
        </View>
    );
    const rating = (
        label: string,
        value: number,
        setter: (value: number) => void,
    ) => (
        <View style={{ gap: 10 }}>
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: 8,
                }}
            >
                <Text
                    style={{
                        color: fg,
                        fontWeight: '600',
                        fontSize: 14,
                        flex: 1,
                    }}
                >
                    {label}
                </Text>
                <Text style={{ color: muted, fontSize: 12 }}>
                    {value ? `${value}/5` : t('places.unrated')}
                </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 5 }}>
                {[1, 2, 3, 4, 5].map((score) => (
                    <TouchableOpacity
                        key={score}
                        accessibilityRole="button"
                        accessibilityLabel={`${label}: ${score}/5`}
                        accessibilityState={{ selected: score <= value }}
                        onPress={() => {
                            setter(value === score ? 0 : score);
                            changed();
                        }}
                        style={{
                            flex: 1,
                            height: 46,
                            borderRadius: 13,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor:
                                score <= value
                                    ? isDark
                                        ? '#342957'
                                        : '#f0edfc'
                                    : isDark
                                      ? '#111625'
                                      : '#f8f9fd',
                        }}
                    ></TouchableOpacity>
                ))}
            </View>
        </View>
    );
    if (!session) return <Redirect href="/(auth)/login" />;
    if (isLoading)
        return (
            <SafeAreaView
                style={{
                    flex: 1,
                    backgroundColor: isDark ? '#0d1220' : '#f5f6fa',
                    justifyContent: 'center',
                }}
            >
                <ActivityIndicator color="#6554df" />
            </SafeAreaView>
        );
    if (!venue)
        return (
            <SafeAreaView
                style={{
                    flex: 1,
                    padding: 24,
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 20,
                }}
            >
                <Text style={{ color: muted }}>
                    {error ? t('places.loadError') : t('places.notFound')}
                </Text>
                <TouchableOpacity
                    onPress={() => (error ? refetch() : router.back())}
                >
                    <Text style={{ color: '#6554df' }}>
                        {error ? t('insights.retry') : t('back')}
                    </Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    const statusText =
        !valid && hasChanges
            ? !name.trim()
                ? t('places.requiredName')
                : t('places.capacityError')
            : isSaving
              ? t('places.uploading')
              : saveStatus === 'saving'
                ? t('places.saving')
                : saveStatus === 'error'
                  ? t('places.saveError')
                  : hasChanges
                    ? t('places.pending')
                    : t('places.saved');
    return (
        <SafeAreaView
            edges={['top', 'bottom']}
            style={{ flex: 1, backgroundColor: isDark ? '#0d1220' : '#f5f6fa' }}
        >
            <Stack.Screen options={{ headerShown: false }} />
            <SessionFormHeader
                title={t('places.detailTitle')}
                subtitle={venue.name}
                onClose={() => {
                    void close();
                }}
            />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{
                        paddingHorizontal: 20,
                        paddingBottom: 32,
                    }}
                >
                    <View
                        style={{
                            width: '100%',
                            maxWidth: 900,
                            alignSelf: 'center',
                            gap: 16,
                        }}
                    >
                        <View
                            accessibilityLiveRegion="polite"
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                paddingHorizontal: 4,
                                paddingBottom: 2,
                            }}
                        >
                            {saveStatus === 'saving' || isSaving ? (
                                <ActivityIndicator
                                    size="small"
                                    color="#6554df"
                                />
                            ) : saveStatus === 'error' || !valid ? (
                                <CloudOff size={16} color="#e37070" />
                            ) : (
                                <Check size={16} color="#9983ee" />
                            )}
                            <Text
                                style={{
                                    color:
                                        saveStatus === 'error' || !valid
                                            ? '#e37070'
                                            : muted,
                                    fontSize: 12,
                                    flex: 1,
                                }}
                            >
                                {statusText}
                            </Text>
                            {saveStatus === 'error' && (
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    onPress={() => {
                                        void save();
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: '#9983ee',
                                            fontWeight: '700',
                                        }}
                                    >
                                        {t('insights.retry')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <SessionFormSection
                            title={t('places.details')}
                            kind="location"
                        >
                            {field(t('venue_name'), name, setName, {
                                maxLength: 160,
                            })}
                            {field(t('venue_contact'), contact, setContact, {
                                keyboardType: 'phone-pad',
                            })}
                        </SessionFormSection>
                        <SessionFormSection
                            title={t('places.location')}
                            kind="location"
                        >
                            <CityInput
                                value={city}
                                onChange={(value) => {
                                    setCity(value);
                                    changed();
                                }}
                                location={cityLocation}
                                onLocation={(value) => {
                                    setCityLocation(value);
                                    changed();
                                }}
                                disabled={isSaving}
                            />
                            {field(t('venue_address'), address, setAddress, {
                                placeholder: t('places.addressPlaceholder'),
                                multiline: true,
                            })}
                            <Text
                                style={{
                                    color: muted,
                                    fontSize: 12,
                                    lineHeight: 18,
                                }}
                            >
                                {t('location.futureHint')}
                            </Text>
                        </SessionFormSection>
                        <SessionFormSection
                            title={t('places.preparation')}
                            kind="equipment"
                        >
                            {field(t('venue_capacity'), capacity, setCapacity, {
                                keyboardType: 'number-pad',
                                placeholder: t('places.capacityPlaceholder'),
                                maxLength: 9,
                            })}
                            {!validCapacity && (
                                <Text
                                    style={{ color: '#e37070', fontSize: 12 }}
                                >
                                    {t('places.capacityError')}
                                </Text>
                            )}
                            <View>
                                <Text style={labelStyle}>
                                    {t('venue_equipment')}
                                </Text>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        gap: 8,
                                        alignItems: 'center',
                                    }}
                                >
                                    <TextInput
                                        accessibilityLabel={t(
                                            'places.quantity',
                                        )}
                                        keyboardType="number-pad"
                                        value={equipQuantity}
                                        onChangeText={setEquipQuantity}
                                        maxLength={4}
                                        style={[
                                            fieldStyle,
                                            {
                                                width: 54,
                                                textAlign: 'center',
                                                paddingHorizontal: 6,
                                            },
                                        ]}
                                    />
                                    <TextInput
                                        accessibilityLabel={t(
                                            'venue_equipment',
                                        )}
                                        value={equipInput}
                                        onChangeText={setEquipInput}
                                        placeholder={t(
                                            'places.equipmentPlaceholder',
                                        )}
                                        placeholderTextColor={muted}
                                        style={[
                                            fieldStyle,
                                            { flex: 1, minWidth: 0 },
                                        ]}
                                    />
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        accessibilityLabel={t(
                                            'places.addEquipment',
                                        )}
                                        disabled={
                                            !equipInput.trim() || !validQuantity
                                        }
                                        onPress={() => {
                                            setEquipment((previous) => [
                                                ...previous,
                                                {
                                                    name: equipInput.trim(),
                                                    quantity:
                                                        Number(equipQuantity),
                                                },
                                            ]);
                                            setEquipInput('');
                                            setEquipQuantity('1');
                                            changed();
                                        }}
                                        style={{
                                            width: 46,
                                            height: 48,
                                            backgroundColor:
                                                !equipInput.trim() ||
                                                !validQuantity
                                                    ? isDark
                                                        ? '#39315c'
                                                        : '#c5bdee'
                                                    : '#6554df',
                                            borderRadius: 14,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Plus size={22} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                                {!validQuantity && (
                                    <Text
                                        style={{
                                            color: '#e37070',
                                            fontSize: 12,
                                            marginTop: 8,
                                        }}
                                    >
                                        {t('places.quantityError')}
                                    </Text>
                                )}
                            </View>
                            {equipment.length ? (
                                equipment.map((item, index) => (
                                    <View
                                        key={index}
                                        style={{
                                            flexDirection: 'row',
                                            gap: 10,
                                            alignItems: 'center',
                                            paddingLeft: 14,
                                            backgroundColor: isDark
                                                ? '#111625'
                                                : '#f8f9fd',
                                            borderRadius: 14,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: '#9983ee',
                                                fontWeight: '800',
                                            }}
                                        >
                                            {item.quantity}×
                                        </Text>
                                        <Text
                                            style={{
                                                color: fg,
                                                flex: 1,
                                                fontSize: 14,
                                            }}
                                        >
                                            {item.name}
                                        </Text>
                                        <TouchableOpacity
                                            accessibilityRole="button"
                                            accessibilityLabel={`${t('delete')}: ${item.name}`}
                                            onPress={() => {
                                                setEquipment((previous) =>
                                                    previous.filter(
                                                        (_, i) => i !== index,
                                                    ),
                                                );
                                                changed();
                                            }}
                                            style={{ padding: 14 }}
                                        >
                                            <X size={18} color={muted} />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            ) : (
                                <Text
                                    style={{
                                        color: muted,
                                        fontSize: 12,
                                        lineHeight: 18,
                                    }}
                                >
                                    {t('places.equipmentHint')}
                                </Text>
                            )}
                        </SessionFormSection>
                        <SessionFormSection
                            title={t('places.ratings')}
                            kind="rating"
                        >
                            {rating(
                                t('sound_quality'),
                                soundQuality,
                                setSoundQuality,
                            )}
                            {rating(
                                t('experience_rating'),
                                experienceRating,
                                setExperienceRating,
                            )}
                            <Text
                                style={{
                                    color: muted,
                                    fontSize: 12,
                                    lineHeight: 18,
                                }}
                            >
                                {t('places.ratingHint')}
                            </Text>
                        </SessionFormSection>
                        <SessionFormSection
                            title={t('venue_notes')}
                            kind="notes"
                        >
                            {field(t('places.notesLabel'), notes, setNotes, {
                                multiline: true,
                                textAlignVertical: 'top',
                                placeholder: t('places.notesPlaceholder'),
                                style: [fieldStyle, { minHeight: 130 }],
                            })}
                        </SessionFormSection>
                        <SessionFormSection
                            title={t('venue_images')}
                            kind="poster"
                        >
                            <Text
                                style={{
                                    color: muted,
                                    fontSize: 12,
                                    lineHeight: 18,
                                }}
                            >
                                {t('places.photosHint')}
                            </Text>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    flexWrap: 'wrap',
                                    gap: 10,
                                }}
                            >
                                {images.map((url, index) => (
                                    <View
                                        key={`${url}-${index}`}
                                        style={{
                                            width: '47%',
                                            aspectRatio: 1,
                                            borderRadius: 16,
                                            overflow: 'hidden',
                                            backgroundColor: isDark
                                                ? '#111625'
                                                : '#f8f9fd',
                                        }}
                                    >
                                        <Image
                                            source={{ uri: url }}
                                            accessibilityLabel={`${t('venue_images')} ${index + 1}`}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                            }}
                                        />
                                        <TouchableOpacity
                                            accessibilityRole="button"
                                            accessibilityLabel={`${t('delete')}: ${t('venue_images')} ${index + 1}`}
                                            onPress={() =>
                                                handleDeleteImage(index)
                                            }
                                            style={{
                                                position: 'absolute',
                                                right: 6,
                                                top: 6,
                                                padding: 10,
                                                backgroundColor: '#202538cc',
                                                borderRadius: 12,
                                            }}
                                        >
                                            <X size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel={t('places.addPhotos')}
                                    disabled={isSaving}
                                    onPress={pickAndUploadImage}
                                    style={{
                                        width: images.length ? '47%' : '100%',
                                        minHeight: 116,
                                        borderRadius: 16,
                                        borderWidth: 1,
                                        borderStyle: 'dashed',
                                        borderColor: isDark
                                            ? '#504673'
                                            : '#c9c1ed',
                                        backgroundColor: isDark
                                            ? '#211d35'
                                            : '#f7f5fe',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                    }}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator color="#9983ee" />
                                    ) : (
                                        <Camera size={25} color="#9983ee" />
                                    )}
                                    <Text
                                        style={{
                                            color: '#9983ee',
                                            fontWeight: '600',
                                            fontSize: 13,
                                        }}
                                    >
                                        {t('places.addPhotos')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </SessionFormSection>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={t(
                                venue?.archived_at
                                    ? 'location.restore'
                                    : 'location.archive',
                            )}
                            disabled={
                                deleteVenueMutation.isPending ||
                                updateVenueMutation.isPending ||
                                hasChanges ||
                                isSaving ||
                                saveStatus === 'saving'
                            }
                            onPress={handleDelete}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 9,
                                padding: 17,
                                opacity:
                                    hasChanges ||
                                    isSaving ||
                                    saveStatus === 'saving'
                                        ? 0.4
                                        : 1,
                            }}
                        >
                            <Trash2 size={17} color="#d76f7d" />
                            <Text
                                style={{
                                    color: '#d76f7d',
                                    fontWeight: '600',
                                    fontSize: 13,
                                }}
                            >
                                {t(
                                    venue?.archived_at
                                        ? 'location.restore'
                                        : 'location.archive',
                                )}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
