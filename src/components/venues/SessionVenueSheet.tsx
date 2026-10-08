import { CityInput } from '../profile/CityInput';
import {
    cityKey,
    cityLabel,
    normalizeCity,
    type CityLocation,
} from '../../utils/cities';
import type { CreateVenueInput } from '../../types/venue';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/CommunityUI';
import type { Venue } from '../../types/venue';

export function SessionVenueSheet({
    visible,
    venues,
    selectedId,
    onClose,
    onSelect,
    onCreate,
}: {
    visible: boolean;
    venues: Venue[];
    selectedId: string | null;
    onClose: () => void;
    onSelect: (venue: Venue) => void | Promise<void>;
    onCreate: (input: CreateVenueInput) => Promise<Venue>;
}) {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const [query, setQuery] = useState('');
    const [creating, setCreating] = useState(false);
    const [city, setCity] = useState('');
    const [cityLocation, setCityLocation] = useState<CityLocation | null>(null);
    const [address, setAddress] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);
    const saving = useRef(false);
    useEffect(() => {
        if (visible) {
            setQuery('');
            setCity('');
            setCityLocation(null);
            setAddress('');
            setCreating(false);
            setError(false);
        }
    }, [visible]);
    const normalize = (value: string) =>
        value
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase();
    const matches = venues.filter((v) =>
        normalize(
            [v.name, v.city, v.address].filter(Boolean).join(' '),
        ).includes(normalize(query)),
    );
    const close = () => {
        if (!saving.current) onClose();
    };
    const select = async (place: Venue) => {
        if (saving.current) return;
        saving.current = true;
        setBusy(true);
        setError(false);
        try {
            await onSelect(place);
        } catch {
            setError(true);
        } finally {
            saving.current = false;
            setBusy(false);
        }
    };
    const add = async () => {
        if (!creating) {
            setCreating(true);
            setError(false);
            return;
        }
        const name = query.trim();
        if (!name || !city.trim() || saving.current) return;
        const existing = venues.find(
            (v) =>
                normalize(v.name) === normalize(name) &&
                cityKey(cityLabel(v.city || '', v.city_location)) ===
                    cityKey(cityLabel(city, cityLocation)) &&
                normalize(v.address || '') === normalize(address),
        );
        if (existing) {
            await select(existing);
            return;
        }
        saving.current = true;
        setBusy(true);
        setError(false);
        try {
            await onSelect(
                await onCreate({
                    name,
                    city: normalizeCity(city),
                    city_location: cityLocation,
                    address: address.trim(),
                }),
            );
        } catch {
            setError(true);
        } finally {
            saving.current = false;
            setBusy(false);
        }
    };
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={close}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{
                    flex: 1,
                    justifyContent: 'flex-end',
                    backgroundColor: 'rgba(15,18,30,0.5)',
                }}
            >
                <Pressable
                    accessibilityLabel={t('cancel')}
                    onPress={close}
                    style={{ flex: 1 }}
                />
                <View
                    style={{
                        backgroundColor: c.card,
                        borderTopLeftRadius: 30,
                        borderTopRightRadius: 30,
                        maxHeight: height * 0.8,
                        flexShrink: 1,
                        height: creating
                            ? Math.min(height * 0.8, 650)
                            : Math.min(height * 0.72, 600),
                        paddingHorizontal: 20,
                        paddingTop: 12,
                    }}
                >
                    <View
                        style={{
                            width: 36,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: c.border,
                            alignSelf: 'center',
                            marginBottom: 20,
                        }}
                    />
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: 16,
                            marginBottom: 20,
                        }}
                    >
                        <View style={{ flex: 1, gap: 7 }}>
                            <Text
                                accessibilityRole="header"
                                style={{
                                    color: c.fg,
                                    fontSize: 24,
                                    fontWeight: '800',
                                }}
                            >
                                {t(
                                    creating
                                        ? 'venuePicker.newTitle'
                                        : 'venuePicker.title',
                                )}
                            </Text>
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 14,
                                    lineHeight: 20,
                                }}
                            >
                                {t(
                                    creating
                                        ? 'venuePicker.newHint'
                                        : 'venuePicker.hint',
                                )}
                            </Text>
                        </View>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('cancel')}
                            onPress={close}
                            disabled={busy}
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 16,
                                backgroundColor: c.bg,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <X size={21} color={c.fg} />
                        </Pressable>
                    </View>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
                        style={{ flex: 1 }}
                    >
                        {creating && (
                            <Text
                                style={{
                                    color: c.fg,
                                    fontWeight: '700',
                                    fontSize: 13,
                                }}
                            >
                                {t('venue_name')}
                            </Text>
                        )}
                        <TextInput
                            key={creating ? 'new' : 'search'}
                            autoFocus={creating}
                            editable={!busy}
                            value={query}
                            onChangeText={(value) => {
                                setQuery(value);
                                setError(false);
                            }}
                            accessibilityLabel={t(
                                creating ? 'venue_name' : 'places.search',
                            )}
                            placeholder={t(
                                creating
                                    ? 'venue_placeholder'
                                    : 'places.search',
                            )}
                            placeholderTextColor={c.muted}
                            autoCapitalize="words"
                            maxLength={120}
                            returnKeyType={creating ? 'done' : 'search'}
                            onSubmitEditing={() => {
                                if (creating) void add();
                            }}
                            style={{
                                minHeight: 52,
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: c.border,
                                backgroundColor: c.bg,
                                color: c.fg,
                                paddingHorizontal: 16,
                                fontSize: 15,
                                marginBottom: 6,
                            }}
                        />
                        {creating && (
                            <>
                                <CityInput
                                    value={city}
                                    onChange={setCity}
                                    location={cityLocation}
                                    onLocation={setCityLocation}
                                    disabled={busy}
                                />
                                <Text style={{ color: c.muted, fontSize: 12 }}>
                                    {t('location.addressOptional')}
                                </Text>
                                <TextInput
                                    value={address}
                                    onChangeText={setAddress}
                                    editable={!busy}
                                    maxLength={500}
                                    accessibilityLabel={t('venue_address')}
                                    placeholder={t('places.addressPlaceholder')}
                                    placeholderTextColor={c.muted}
                                    style={{
                                        minHeight: 52,
                                        borderRadius: 16,
                                        borderWidth: 1,
                                        borderColor: c.border,
                                        backgroundColor: c.bg,
                                        color: c.fg,
                                        paddingHorizontal: 16,
                                        fontSize: 15,
                                    }}
                                />
                            </>
                        )}
                        {error && (
                            <Text
                                accessibilityRole="alert"
                                style={{ color: '#dc4545', fontSize: 14 }}
                            >
                                {t('venuePicker.saveError')}
                            </Text>
                        )}
                        {!creating &&
                            (matches.length ? (
                                matches.map((v) => (
                                    <Pressable
                                        key={v.id}
                                        accessibilityRole="button"
                                        accessibilityState={{
                                            selected: selectedId === v.id,
                                        }}
                                        disabled={busy}
                                        onPress={() => void select(v)}
                                        style={{
                                            borderWidth: 1,
                                            borderColor:
                                                selectedId === v.id
                                                    ? c.accent
                                                    : c.border,
                                            borderRadius: 18,
                                            padding: 16,
                                            backgroundColor:
                                                selectedId === v.id
                                                    ? c.tint
                                                    : c.card,
                                            gap: 5,
                                        }}
                                    >
                                        <Text
                                            numberOfLines={2}
                                            style={{
                                                color: c.fg,
                                                fontWeight: '700',
                                                fontSize: 16,
                                            }}
                                        >
                                            {v.name}
                                        </Text>
                                        {(v.city || v.address) && (
                                            <Text
                                                numberOfLines={2}
                                                style={{
                                                    color: c.muted,
                                                    fontSize: 13,
                                                    lineHeight: 18,
                                                }}
                                            >
                                                {[
                                                    cityLabel(
                                                        v.city || '',
                                                        v.city_location,
                                                    ),
                                                    v.address,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </Text>
                                        )}
                                    </Pressable>
                                ))
                            ) : (
                                <Text
                                    style={{
                                        color: c.muted,
                                        fontSize: 14,
                                        lineHeight: 21,
                                        paddingVertical: 18,
                                    }}
                                >
                                    {t(
                                        venues.length
                                            ? 'venuePicker.empty'
                                            : 'no_venues_yet',
                                    )}
                                </Text>
                            ))}
                    </ScrollView>
                    <View
                        style={{
                            paddingTop: 14,
                            paddingBottom: Math.max(insets.bottom, 12) + 16,
                            gap: 12,
                            borderTopWidth: 1,
                            borderColor: c.border,
                        }}
                    >
                        <Pressable
                            accessibilityRole="button"
                            disabled={
                                busy ||
                                (creating && (!query.trim() || !city.trim()))
                            }
                            onPress={() => void add()}
                            style={{
                                minHeight: 54,
                                paddingVertical: 15,
                                paddingHorizontal: 20,
                                borderRadius: 18,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: c.accent,
                                opacity:
                                    busy ||
                                    (creating &&
                                        (!query.trim() || !city.trim()))
                                        ? 0.5
                                        : 1,
                            }}
                        >
                            {busy ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text
                                    style={{
                                        color: '#fff',
                                        fontWeight: '800',
                                        fontSize: 16,
                                        textAlign: 'center',
                                    }}
                                >
                                    {t('add_venue')}
                                </Text>
                            )}
                        </Pressable>
                        {creating && (
                            <Pressable
                                accessibilityRole="button"
                                disabled={busy}
                                onPress={() => {
                                    setCreating(false);
                                    setError(false);
                                }}
                                style={{
                                    minHeight: 36,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                            >
                                <Text
                                    style={{
                                        color: c.muted,
                                        fontSize: 14,
                                        fontWeight: '600',
                                    }}
                                >
                                    {t('venuePicker.back')}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
