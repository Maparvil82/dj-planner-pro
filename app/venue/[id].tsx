import React, { useState, useEffect, useContext } from 'react';
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
    Image
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    Trash2,
    Save,
    MapPin,
    Phone,
    Plus,
    X,
    Check,
    Cloud,
    CloudOff,
    Loader,
    Image as ImageIcon,
    Camera
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { venueService } from '../../src/services/venues';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTranslation } from '../../src/i18n/useTranslation';
import {
    useVenueByIdQuery,
    useUpdateVenueMutation,
    useDeleteVenueMutation
} from '../../src/hooks/useVenuesQuery';
import {
    useVaultFoldersByAssociationQuery,
    useCreateFolderMutation
} from '../../src/hooks/useVaultQuery';
import {
    Folder,
    FolderPlus,
    ChevronRight
} from 'lucide-react-native';
import { ThemeContext } from '../../src/contexts/ThemeContext';
export default function VenueDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { t } = useTranslation();
    const themeCtx = useContext(ThemeContext);
    const { session } = useAuthStore();

    if (!session) {
        return <Redirect href="/(auth)/login" />;
    }
    const isDark = themeCtx?.activeTheme === 'dark';

    const { data: venue, isLoading, error } = useVenueByIdQuery(id as string);
    const updateVenueMutation = useUpdateVenueMutation();
    const deleteVenueMutation = useDeleteVenueMutation();

    const { data: associatedFolders = [], isLoading: isLoadingFolders } = useVaultFoldersByAssociationQuery('venue', id as string);
    const createFolderMutation = useCreateFolderMutation();

    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [contact, setContact] = useState('');
    const [notes, setNotes] = useState('');
    const [soundQuality, setSoundQuality] = useState<number>(0);
    const [experienceRating, setExperienceRating] = useState<number>(0);
    const [capacity, setCapacity] = useState('');
    const [equipment, setEquipment] = useState<Array<{ name: string; quantity: number }>>([]);
    const [images, setImages] = useState<string[]>([]);
    const [equipInput, setEquipInput] = useState('');
    const [equipQuantity, setEquipQuantity] = useState('');
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    useEffect(() => {
        if (venue && !hasChanges) {
            setName(venue.name || '');
            setAddress(venue.address || '');
            setCity(venue.city || '');
            setContact(venue.contact_info || '');
            setNotes(venue.notes || '');
            setSoundQuality(venue.sound_quality || 0);
            setExperienceRating(venue.experience_rating || 0);
            setCapacity(venue.capacity?.toString() || '');

            // Robust check for equipment array
            let equipData = venue.equipment;
            if (typeof equipData === 'string') {
                try {
                    equipData = JSON.parse(equipData);
                } catch (e) {
                    equipData = [];
                }
            }
            setEquipment(Array.isArray(equipData) ? equipData : []);
            setImages(venue.images || []);
        }
    }, [venue]);

    // Auto-save effect
    useEffect(() => {
        if (!hasChanges || !venue || !name.trim()) return;

        const timeoutId = setTimeout(async () => {
            setSaveStatus('saving');
            try {
                await updateVenueMutation.mutateAsync({
                    venueId: venue.id,
                    input: {
                        name: name.trim(),
                        address: address.trim(),
                        city: city.trim(),
                        contact_info: contact.trim(),
                        capacity: capacity.trim() ? parseInt(capacity) : undefined,
                        equipment: equipment.length > 0 ? equipment : [],
                        images: images,
                        sound_quality: soundQuality || undefined,
                        experience_rating: experienceRating || undefined,
                        notes: notes.trim()
                    }
                });
                setHasChanges(false);
                setSaveStatus('saved');

                // Reset to idle after 2s
                setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (err) {
                setSaveStatus('error');
            }
        }, 1000); // 1 second debounce

        return () => clearTimeout(timeoutId);
    }, [name, address, city, contact, notes, soundQuality, experienceRating, capacity, equipment, images, hasChanges, venue]);

    const handleDelete = () => {
        Alert.alert(
            t('delete_venue'),
            t('delete_session_message'),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteVenueMutation.mutateAsync(venue!.id);
                            router.back();
                        } catch (err) {
                            Alert.alert(t('error'), 'No se pudo eliminar el lugar');
                        }
                    }
                }
            ]
        );
    };

    const pickAndUploadImage = async () => {
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
            setIsSaving(true);
            setSaveStatus('saving');
            const newUrls: string[] = [...images];

            try {
                for (const asset of result.assets) {
                    const uploadedUrl = await venueService.uploadVenueImage(session!.user.id, asset.uri);
                    if (uploadedUrl) {
                        newUrls.push(uploadedUrl);
                    }
                }
                setImages(newUrls);
                setHasChanges(true);
            } catch (error) {
                setSaveStatus('error');
                Alert.alert(t('error'), t('error_uploading'));
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleDeleteImage = async (indexToRemove: number) => {
        const imageUrl = images[indexToRemove];
        if (imageUrl) {
            await venueService.deleteVenueImage(imageUrl);
        }
        const updatedImages = images.filter((_, index) => index !== indexToRemove);
        setImages(updatedImages);
        setHasChanges(true);
    };

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-gray-950 items-center justify-center">
                <ActivityIndicator size="large" color="#2563EB" />
            </SafeAreaView>
        );
    }

    if (!venue) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-gray-950 items-center justify-center px-6">
                <Text className="text-gray-500 dark:text-gray-400 text-center mb-4">
                    No se encontró el lugar.
                </Text>
                <TouchableOpacity onPress={() => router.back()} className="bg-blue-600 px-6 py-3 rounded-xl">
                    <Text className="text-white font-bold">{t('go_back')}</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-950" edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Custom Header */}
            <View className="px-6 py-4 flex-row items-center justify-between">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-900 items-center justify-center"
                >
                    <ArrowLeft size={24} color={isDark ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>
                <View className="flex-1 items-center justify-center mx-2">
                    <Text className="text-xl font-black text-gray-900 dark:text-white text-center" numberOfLines={1}>
                        {venue.name}
                    </Text>
                    {/* Auto-save status indicator */}
                    <View className="flex-row items-center mt-1">
                        {saveStatus === 'saving' && (
                            <>
                                <Loader size={12} color="#2563EB" className="mr-1 animate-spin" />
                                <Text className="text-[10px] text-blue-600 font-bold uppercase">{t('saving') || 'Guardando...'}</Text>
                            </>
                        )}
                        {saveStatus === 'saved' && (
                            <>
                                <Cloud size={12} color="#10B981" className="mr-1" />
                                <Text className="text-[10px] text-green-500 font-bold uppercase">{t('saved') || 'Guardado'}</Text>
                            </>
                        )}
                        {saveStatus === 'error' && (
                            <>
                                <CloudOff size={12} color="#EF4444" className="mr-1" />
                                <Text className="text-[10px] text-red-500 font-bold uppercase">{t('error') || 'Error'}</Text>
                            </>
                        )}
                    </View>
                </View>
                <TouchableOpacity
                    onPress={handleDelete}
                    className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 items-center justify-center"
                >
                    <Trash2 size={20} color="#EF4444" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
                    <View className="space-y-6">
                        {/* Name Field */}
                        <View>
                            <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                {t('venue_name')}
                            </Text>
                            <TextInput
                                className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-bold border border-gray-100 dark:border-gray-800"
                                value={name}
                                onChangeText={(val) => {
                                    setName(val);
                                    setHasChanges(true);
                                }}
                            />
                        </View>

                        {/* Address Field */}
                        <View className="mt-6">
                            <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                {t('venue_address')}
                            </Text>
                            <View className="relative">
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 pl-12 text-gray-900 dark:text-white font-medium border border-gray-100 dark:border-gray-800"
                                    value={address}
                                    onChangeText={(val) => {
                                        setAddress(val);
                                        setHasChanges(true);
                                    }}
                                    multiline
                                />
                                <View className="absolute left-4 top-4">
                                    <MapPin size={20} color={isDark ? '#4B5563' : '#9CA3AF'} />
                                </View>
                            </View>
                        </View>

                        {/* City Field */}
                        <View className="mt-6">
                            <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                {t('venue_city')}
                            </Text>
                            <View className="relative">
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 pl-12 text-gray-900 dark:text-white font-medium border border-gray-100 dark:border-gray-800"
                                    value={city}
                                    onChangeText={(val) => {
                                        setCity(val);
                                        setHasChanges(true);
                                    }}
                                />
                                <View className="absolute left-4 top-4">
                                    <MapPin size={20} color={isDark ? '#4B5563' : '#9CA3AF'} />
                                </View>
                            </View>
                        </View>

                        {/* Contact Field */}
                        <View className="mt-6">
                            <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                {t('venue_contact')}
                            </Text>
                            <View className="relative">
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 pl-12 text-gray-900 dark:text-white font-medium border border-gray-100 dark:border-gray-800"
                                    value={contact}
                                    onChangeText={(val) => {
                                        setContact(val);
                                        setHasChanges(true);
                                    }}
                                />
                                <View className="absolute left-4 top-4">
                                    <Phone size={20} color={isDark ? '#4B5563' : '#9CA3AF'} />
                                </View>
                            </View>
                        </View>

                        {/* Capacity Field */}
                        <View className="mt-6">
                            <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                {t('venue_capacity')}
                            </Text>
                            <TextInput
                                className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-bold border border-gray-100 dark:border-gray-800"
                                placeholder={t('capacity_placeholder')}
                                placeholderTextColor="#9CA3AF"
                                value={capacity}
                                onChangeText={(val) => {
                                    setCapacity(val);
                                    setHasChanges(true);
                                }}
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Equipment Field */}
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
                                            setEquipment([...equipment, { name: equipInput.trim(), quantity: qty }]);
                                            setEquipInput('');
                                            setEquipQuantity('');
                                            setHasChanges(true);
                                        }
                                    }}
                                    className="w-12 h-12 rounded-2xl bg-blue-600 items-center justify-center"
                                >
                                    <Plus size={24} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                            <View className="flex-row flex-wrap gap-2">
                                {Array.isArray(equipment) && equipment.map((item, index) => (
                                    <View key={index} className="bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-xl flex-row items-center">
                                        <Text className="text-blue-600 dark:text-blue-400 font-medium text-sm mr-2">
                                            {item.quantity} x {item.name}
                                        </Text>
                                        <TouchableOpacity onPress={() => {
                                            setEquipment(equipment.filter((_, i) => i !== index));
                                            setHasChanges(true);
                                        }}>
                                            <X size={14} color={isDark ? '#60A5FA' : '#2563EB'} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Sound Quality Rating */}
                        <View className="mt-6">
                            <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                {t('sound_quality') || 'Calidad de Sonido'}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <TouchableOpacity
                                        key={star}
                                        onPress={() => {
                                            setSoundQuality(star === soundQuality ? 0 : star);
                                            setHasChanges(true);
                                        }}
                                    >
                                        <Text style={{ fontSize: 32, color: star <= soundQuality ? '#FACC15' : (isDark ? '#374151' : '#E5E7EB') }}>
                                            ★
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {soundQuality > 0 && (
                                <Text style={{ fontSize: 11, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 4, marginLeft: 2 }}>
                                    {['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'][soundQuality]}
                                </Text>
                            )}
                        </View>

                        {/* Experience Rating */}
                        <View className="mt-6">
                            <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                {t('experience_rating') || 'Experiencia General'}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <TouchableOpacity
                                        key={star}
                                        onPress={() => {
                                            setExperienceRating(star === experienceRating ? 0 : star);
                                            setHasChanges(true);
                                        }}
                                    >
                                        <Text style={{ fontSize: 32, color: star <= experienceRating ? '#3B82F6' : (isDark ? '#374151' : '#E5E7EB') }}>
                                            ★
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {experienceRating > 0 && (
                                <Text style={{ fontSize: 11, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 4, marginLeft: 2 }}>
                                    {['', 'Muy mala', 'Mala', 'Regular', 'Buena', 'Excelente'][experienceRating]}
                                </Text>
                            )}
                        </View>

                        <View className="mt-6">
                            <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                {t('venue_notes')}
                            </Text>
                            <TextInput
                                className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-medium border border-gray-100 dark:border-gray-800 min-h-[120]"
                                value={notes}
                                onChangeText={(val) => {
                                    setNotes(val);
                                    setHasChanges(true);
                                }}
                                multiline
                                numberOfLines={6}
                                textAlignVertical="top"
                            />
                        </View>

                        {/* Images Section - Pinterest Style */}
                        <View className="mt-6">
                            <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                {t('venue_images')}
                            </Text>
                            <View className="flex-row flex-wrap gap-3">
                                <TouchableOpacity
                                    onPress={pickAndUploadImage}
                                    style={{ width: '47.5%', aspectRatio: 1 }}
                                    className="rounded-2xl bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-800 flex-col items-center justify-center"
                                >
                                    <Camera size={24} color={isDark ? '#4B5563' : '#9CA3AF'} />
                                    <Text className="text-[12px] font-bold text-gray-400 mt-2 text-center px-2">{t('add_image')}</Text>
                                </TouchableOpacity>
                                {images.map((url, index) => (
                                    <View key={index} style={{ width: '47.5%', aspectRatio: index % 3 === 0 ? 0.8 : 1.2 }} className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
                                        <Image
                                            source={{ uri: url }}
                                            className="w-full h-full"
                                            resizeMode="cover"
                                        />
                                        <TouchableOpacity
                                            onPress={() => handleDeleteImage(index)}
                                            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 items-center justify-center border border-white/20"
                                        >
                                            <X size={16} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* VAULT / DOCUMENTS SECTION */}
                        <View className="mt-10 mb-4 px-1">
                            <View className="flex-row items-center justify-between mb-4">
                                <View className="flex-row items-center">
                                    <View className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 items-center justify-center mr-3">
                                        <Folder size={18} color="#2563EB" />
                                    </View>
                                    <Text className="text-lg font-bold text-gray-900 dark:text-white">
                                        {t('venue_vault') || 'Documentos y Carpetas'}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        Alert.prompt(
                                            t('new_folder') || 'Nueva Carpeta',
                                            t('folder_name_placeholder') || 'Ejem: Contratos, Planos...',
                                            [
                                                { text: t('cancel'), style: 'cancel' },
                                                {
                                                    text: t('create'),
                                                    onPress: (name?: string) => {
                                                        if (name) createFolderMutation.mutate({
                                                            name,
                                                            type: 'venue',
                                                            associatedId: id as string
                                                        });
                                                    }
                                                }
                                            ]
                                        );
                                    }}
                                    className="flex-row items-center bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg"
                                >
                                    <Plus size={14} color="#2563EB" style={{ marginRight: 4 }} />
                                    <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                        {t('add_folder') || 'Añadir'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {isLoadingFolders ? (
                                <ActivityIndicator size="small" color="#2563EB" />
                            ) : associatedFolders.length > 0 ? (
                                <View style={{ gap: 8 }}>
                                    {associatedFolders.map((folder) => (
                                        <TouchableOpacity
                                            key={folder.id}
                                            onPress={() => router.push(`/vault/${folder.id}?name=${encodeURIComponent(folder.name)}` as any)}
                                            className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-xl flex-row items-center justify-between shadow-sm shadow-black/5"
                                        >
                                            <View className="flex-row items-center">
                                                <Folder size={20} color="#2563EB" fill="#2563EB" fillOpacity={0.1} />
                                                <Text className="text-sm font-bold text-gray-900 dark:text-white ml-3">
                                                    {folder.name}
                                                </Text>
                                            </View>
                                            <ChevronRight size={16} color={isDark ? '#4B5563' : '#9CA3AF'} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => {
                                        Alert.prompt(
                                            t('new_folder') || 'Nueva Carpeta',
                                            t('folder_name_placeholder') || 'Ejem: Contratos, Planos...',
                                            [
                                                { text: t('cancel'), style: 'cancel' },
                                                {
                                                    text: t('create'),
                                                    onPress: (name?: string) => {
                                                        if (name) createFolderMutation.mutate({
                                                            name,
                                                            type: 'venue',
                                                            associatedId: id as string
                                                        });
                                                    }
                                                }
                                            ]
                                        );
                                    }}
                                    className="bg-gray-50 dark:bg-gray-950/50 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-8 items-center"
                                >
                                    <FolderPlus size={32} color={isDark ? '#374151' : '#D1D5DB'} />
                                    <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-3 text-center">
                                        {t('no_associated_folders_venue') || 'No hay carpetas para este lugar.\nCrea una para guardar contratos o planos.'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                    <View className="h-20" />
                </ScrollView>
            </KeyboardAvoidingView>


        </SafeAreaView>
    );
}
