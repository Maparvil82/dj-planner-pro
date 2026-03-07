import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Modal,
    Pressable,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Image
} from 'react-native';
import { profileService } from '../../src/services/profile';
import { cn } from '../../src/theme/tw';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    MapPin,
    Plus,
    ChevronRight,
    Search,
    X,
    MapPinned,
    Phone,
    FileText,
    ArrowRight,
    Calendar,
    Image as ImageIcon,
    Camera,
    Loader
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { venueService } from '../../src/services/venues';
import { PickedImage } from '../../src/types/venue';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useVenuesQuery, useCreateVenueMutation } from '../../src/hooks/useVenuesQuery';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { Avatar } from '../../src/components/ui/Avatar';
import { useContext } from 'react';
import { useRouter } from 'expo-router';

export default function VenuesScreen() {
    const { t } = useTranslation();
    const { session, profile } = useAuthStore();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';
    const router = useRouter();

    const { data: venues, isLoading, refetch, isRefetching } = useVenuesQuery();
    const createVenueMutation = useCreateVenueMutation();

    const [searchQuery, setSearchQuery] = useState('');
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);

    // New Venue State
    const [newName, setNewName] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [newCity, setNewCity] = useState('');
    const [newContact, setNewContact] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [newCapacity, setNewCapacity] = useState('');
    const [newEquipment, setNewEquipment] = useState<Array<{ name: string; quantity: number }>>([]);
    const [equipInput, setEquipInput] = useState('');
    const [equipQuantity, setEquipQuantity] = useState('');
    const [selectedImages, setSelectedImages] = useState<PickedImage[]>([]);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const groupedVenues = useMemo(() => {
        if (!venues) return [];
        let filtered = venues;

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            filtered = venues.filter(v =>
                v.name.toLowerCase().includes(lowerQuery) ||
                v.address?.toLowerCase().includes(lowerQuery)
            );
        }

        // Sort alphabetically
        filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

        const groups: { letter: string; data: typeof venues }[] = [];
        filtered.forEach(venue => {
            const letter = venue.name ? venue.name.charAt(0).toUpperCase() : '?';
            // Group non-letters in '#'
            const indexLetter = /[A-Z0-9ÄÖÜÑ]/.test(letter) ? letter : '#';

            let group = groups.find(g => g.letter === indexLetter);
            if (!group) {
                group = { letter: indexLetter, data: [] };
                groups.push(group);
            }
            group.data.push(venue);
        });

        // Ensure '#' is at the end if exists, otherwise normal sort
        groups.sort((a, b) => {
            if (a.letter === '#') return 1;
            if (b.letter === '#') return -1;
            return a.letter.localeCompare(b.letter);
        });

        return groups;
    }, [venues, searchQuery]);

    const handleCreateVenue = async () => {
        const normalizedName = newName.trim();
        if (!normalizedName) {
            Alert.alert(t('error'), t('missing_fields'));
            return;
        }

        const duplicateVenue = venues?.find(v => v.name.toLowerCase() === normalizedName.toLowerCase());
        if (duplicateVenue) {
            Alert.alert(
                t('duplicate_venue_title'),
                t('duplicate_venue_message'),
                [
                    { text: t('cancel'), style: 'cancel' },
                    {
                        text: t('go_to_venue'),
                        onPress: () => {
                            setIsAddModalVisible(false);
                            router.push(`/venue/${duplicateVenue.id}`);
                        }
                    }
                ]
            );
            return;
        }

        try {
            setIsSaving(true);
            const imageUrls: string[] = [];

            if (selectedImages.length > 0) {
                setIsUploadingImage(true);
                for (const img of selectedImages) {
                    const uploadedUrl = await venueService.uploadVenueImage(session!.user.id, img.uri);
                    if (uploadedUrl) imageUrls.push(uploadedUrl);
                }
                setIsUploadingImage(false);
            }

            await createVenueMutation.mutateAsync({
                name: normalizedName,
                address: newAddress.trim(),
                city: newCity.trim(),
                contact_info: newContact.trim(),
                capacity: newCapacity.trim() ? parseInt(newCapacity) : undefined,
                equipment: newEquipment.length > 0 ? newEquipment : undefined,
                images: imageUrls.length > 0 ? imageUrls : undefined,
                notes: newNotes.trim()
            });

            setIsAddModalVisible(false);
            setNewName('');
            setNewAddress('');
            setNewCity('');
            setNewContact('');
            setNewNotes('');
            setNewCapacity('');
            setNewEquipment([]);
            setEquipQuantity('');
            setSelectedImages([]);
        } catch (error) {
            Alert.alert(t('error'), t('error_saving_session'));
        } finally {
            setIsSaving(false);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('error'), t('camera_permission_denied'));
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            const newImages: PickedImage[] = result.assets.map(asset => ({
                uri: asset.uri,
                width: asset.width,
                height: asset.height,
            }));
            setSelectedImages([...selectedImages, ...newImages]);
        }
    };

    if (isLoading && !isRefetching) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-gray-950 items-center justify-center">
                <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#2563EB'} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top', 'left', 'right']}>
            {/* Header */}
            <View className="px-6 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 justify-center">
                <View className="flex-row items-center justify-between h-10">
                    {/* Left Actions - Empty for balance */}
                    <View className="w-8" />

                    {/* Centered Title */}
                    <View className="absolute left-0 right-0 items-center justify-center">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                            {t('venues_title')}
                        </Text>
                    </View>

                    {/* Right Actions */}
                    <View className="flex-row items-center gap-3 ml-auto">
                        <TouchableOpacity
                            onPress={() => setIsAddModalVisible(true)}
                            className="w-8 h-8 rounded-full bg-blue-600 items-center justify-center shadow-lg shadow-blue-500/30"
                        >
                            <Plus size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Search Bar */}
            <View className="px-6 mt-4">
                <View className="flex-row items-center bg-gray-100 dark:bg-gray-900 rounded-2xl px-4 py-3 border border-gray-100 dark:border-gray-800">
                    <Search size={20} color={isDark ? '#4B5563' : '#9CA3AF'} />
                    <TextInput
                        className="flex-1 ml-3 text-gray-900 dark:text-white font-medium"
                        placeholder={t('search_placeholder')}
                        placeholderTextColor={isDark ? '#4B5563' : '#9CA3AF'}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery !== '' && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={18} color={isDark ? '#4B5563' : '#9CA3AF'} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView
                className="flex-1 px-6 mt-4"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor={isDark ? '#FFFFFF' : '#000000'}
                    />
                }
            >
                {groupedVenues.length === 0 ? (
                    <View className="py-20 items-center justify-center">
                        <View className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full items-center justify-center mb-4 border border-gray-100 dark:border-gray-800">
                            <MapPin size={32} color={isDark ? '#4B5563' : '#9CA3AF'} />
                        </View>
                        <Text className="text-gray-500 dark:text-gray-400 text-lg font-bold text-center px-10">
                            {searchQuery ? t('no_results_filtered') : t('no_venues_yet')}
                        </Text>
                    </View>
                ) : (
                    groupedVenues.map((group) => (
                        <View key={group.letter} className="mb-2">
                            <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 mb-3 ml-2 mt-2 uppercase tracking-widest">
                                {group.letter}
                            </Text>
                            {group.data.map((venue) => (
                                <TouchableOpacity
                                    key={venue.id}
                                    activeOpacity={0.7}
                                    onPress={() => router.push(`/venue/${venue.id}`)}
                                    className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 mb-4 flex-row items-center"
                                >
                                    {venue.images && venue.images.length > 0 ? (
                                        <Image
                                            source={{ uri: venue.images[0] }}
                                            className="w-12 h-12 rounded-xl mr-3"
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-xl items-center justify-center mr-3 border border-gray-100 dark:border-gray-700">
                                            <ImageIcon size={20} color={isDark ? '#4B5563' : '#9CA3AF'} />
                                        </View>
                                    )}
                                    <View className="flex-1">
                                        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-1" numberOfLines={1}>
                                            {venue.name}
                                        </Text>
                                        {venue.address ? (
                                            <Text className="text-gray-500 dark:text-gray-400 text-xs" numberOfLines={1}>
                                                {venue.address}
                                            </Text>
                                        ) : (
                                            <Text className="text-gray-400 dark:text-gray-600 text-xs italic">
                                                {t('venue_address')}...
                                            </Text>
                                        )}
                                    </View>
                                    <ChevronRight size={20} color={isDark ? '#4B5563' : '#9CA3AF'} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    ))
                )}
                <View className="h-20" />
            </ScrollView>

            {/* Add Venue Modal */}
            <Modal
                visible={isAddModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsAddModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <Pressable className="flex-1" onPress={() => setIsAddModalVisible(false)} />
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        className="bg-white dark:bg-gray-950 rounded-t-[40px] px-6 pt-8 pb-16"
                    >
                        <View className="flex-row items-center justify-between mb-8">
                            <Text className="text-2xl font-black text-gray-900 dark:text-white">
                                {t('add_venue')}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setIsAddModalVisible(false)}
                                className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-900 items-center justify-center"
                            >
                                <X size={24} color={isDark ? '#FFFFFF' : '#000000'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="space-y-6" showsVerticalScrollIndicator={false}>
                            <View>
                                <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                    {t('venue_name')}
                                </Text>
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-bold border border-gray-100 dark:border-gray-800"
                                    placeholder={t('venue_placeholder')}
                                    placeholderTextColor="#9CA3AF"
                                    value={newName}
                                    onChangeText={setNewName}
                                    autoFocus
                                />
                            </View>

                            <View className="mt-6">
                                <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                    {t('venue_capacity')}
                                </Text>
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-bold border border-gray-100 dark:border-gray-800"
                                    placeholder={t('capacity_placeholder')}
                                    placeholderTextColor="#9CA3AF"
                                    value={newCapacity}
                                    onChangeText={setNewCapacity}
                                    keyboardType="numeric"
                                />
                            </View>

                            <View className="mt-6">
                                <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                    {t('venue_address')}
                                </Text>
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-medium border border-gray-100 dark:border-gray-800"
                                    placeholder={t('address_placeholder') || 'Calle...'}
                                    placeholderTextColor="#9CA3AF"
                                    value={newAddress}
                                    onChangeText={setNewAddress}
                                />
                            </View>

                            <View className="mt-6">
                                <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                    {t('venue_city')}
                                </Text>
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-medium border border-gray-100 dark:border-gray-800"
                                    placeholder={t('city_placeholder') || 'Ciudad...'}
                                    placeholderTextColor="#9CA3AF"
                                    value={newCity}
                                    onChangeText={setNewCity}
                                />
                            </View>

                            <View className="mt-6">
                                <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                    {t('venue_contact')}
                                </Text>
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-medium border border-gray-100 dark:border-gray-800"
                                    placeholder={t('contact_placeholder') || 'Teléfono...'}
                                    placeholderTextColor="#9CA3AF"
                                    value={newContact}
                                    onChangeText={setNewContact}
                                />
                            </View>

                            <View className="mt-6">
                                <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                    {t('venue_equipment')}
                                </Text>
                                <View className="flex-row items-center gap-2 mb-3">
                                    <View className="w-16">
                                        <TextInput
                                            className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-3 py-4 text-gray-900 dark:text-white font-bold border border-gray-100 dark:border-gray-800 text-center"
                                            placeholder="1"
                                            placeholderTextColor="#9CA3AF"
                                            value={equipQuantity}
                                            onChangeText={setEquipQuantity}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <TextInput
                                        className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-medium border border-gray-100 dark:border-gray-800"
                                        placeholder={t('equipment_placeholder')}
                                        placeholderTextColor="#9CA3AF"
                                        value={equipInput}
                                        onChangeText={setEquipInput}
                                    />
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (equipInput.trim()) {
                                                const qty = equipQuantity.trim() ? (parseInt(equipQuantity) || 1) : 1;
                                                setNewEquipment([...newEquipment, { name: equipInput.trim(), quantity: qty }]);
                                                setEquipInput('');
                                                setEquipQuantity('');
                                            }
                                        }}
                                        className="w-12 h-12 rounded-2xl bg-blue-600 items-center justify-center"
                                    >
                                        <Plus size={24} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                                <View className="flex-row flex-wrap gap-2">
                                    {Array.isArray(newEquipment) && newEquipment.map((item, index) => (
                                        <View key={index} className="bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-xl flex-row items-center">
                                            <Text className="text-blue-600 dark:text-blue-400 font-medium text-sm mr-2">
                                                {item.quantity} x {item.name}
                                            </Text>
                                            <TouchableOpacity onPress={() => setNewEquipment(newEquipment.filter((_, i) => i !== index))}>
                                                <X size={14} color={isDark ? '#60A5FA' : '#2563EB'} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            </View>

                            <View className="mt-6">
                                <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                    {t('venue_notes')}
                                </Text>
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-medium border border-gray-100 dark:border-gray-800 min-h-[100px]"
                                    placeholder={t('venue_notes_placeholder') || 'Notas...'}
                                    placeholderTextColor="#9CA3AF"
                                    value={newNotes}
                                    onChangeText={setNewNotes}
                                    multiline
                                />
                            </View>

                            <View className="mt-6">
                                <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                    {t('venue_images')}
                                </Text>
                                <View className="flex-row flex-wrap gap-3">
                                    <TouchableOpacity
                                        onPress={pickImage}
                                        style={{ width: '47.5%', aspectRatio: 1 }}
                                        className="rounded-2xl bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-800 flex-col items-center justify-center"
                                    >
                                        <Camera size={24} color={isDark ? '#4B5563' : '#9CA3AF'} />
                                        <Text className="text-[12px] font-bold text-gray-400 mt-2 text-center px-2">{t('add_image')}</Text>
                                    </TouchableOpacity>
                                    {selectedImages.map((img, index) => (
                                        <View key={index} style={{ width: '47.5%', aspectRatio: index % 3 === 0 ? 0.8 : 1.2 }} className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
                                            <Image
                                                source={{ uri: img.uri }}
                                                className="w-full h-full"
                                                resizeMode="cover"
                                            />
                                            <TouchableOpacity
                                                onPress={() => setSelectedImages(selectedImages.filter((_, i) => i !== index))}
                                                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 items-center justify-center border border-white/20"
                                            >
                                                <X size={16} color="#FFFFFF" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                                {isUploadingImage && (
                                    <View className="flex-row items-center mt-3 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl">
                                        <ActivityIndicator size="small" color="#2563EB" className="mr-3" />
                                        <Text className="text-xs text-blue-600 dark:text-blue-400 font-bold text-center flex-1">{t('uploading_image')}</Text>
                                    </View>
                                )}
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            onPress={handleCreateVenue}
                            disabled={!newName.trim() || createVenueMutation.isPending}
                            className={cn(
                                "mt-8 mb-4 bg-blue-600 py-4 rounded-2xl items-center justify-center flex-row",
                                (!newName.trim() || createVenueMutation.isPending) && "opacity-50"
                            )}
                        >
                            {createVenueMutation.isPending ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <Text className="text-white font-bold text-lg mr-2">
                                        {t('save_venue')}
                                    </Text>
                                    {newName.trim().length > 0 && (
                                        <ArrowRight size={20} color="#FFFFFF" />
                                    )}
                                </>
                            )}
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                </View >
            </Modal >
        </SafeAreaView >
    );
}
