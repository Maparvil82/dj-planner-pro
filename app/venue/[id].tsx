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
    Platform
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    Trash2,
    Save,
    MapPin,
    Phone,
    FileText,
    X,
    Check,
    Cloud,
    CloudOff,
    Loader
} from 'lucide-react-native';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useVenueByIdQuery, useUpdateVenueMutation, useDeleteVenueMutation } from '../../src/hooks/useVenuesQuery';
import { ThemeContext } from '../../src/contexts/ThemeContext';

export default function VenueDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { t } = useTranslation();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';

    const { data: venue, isLoading, error } = useVenueByIdQuery(id as string);
    const updateVenueMutation = useUpdateVenueMutation();
    const deleteVenueMutation = useDeleteVenueMutation();

    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [contact, setContact] = useState('');
    const [notes, setNotes] = useState('');
    const [soundQuality, setSoundQuality] = useState<number>(0);
    const [experienceRating, setExperienceRating] = useState<number>(0);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    useEffect(() => {
        if (venue) {
            setName(venue.name || '');
            setAddress(venue.address || '');
            setContact(venue.contact_info || '');
            setNotes(venue.notes || '');
            setSoundQuality(venue.sound_quality || 0);
            setExperienceRating(venue.experience_rating || 0);
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
                        contact_info: contact.trim(),
                        notes: notes.trim(),
                        sound_quality: soundQuality || undefined,
                        experience_rating: experienceRating || undefined
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
    }, [name, address, contact, notes, soundQuality, experienceRating, hasChanges, venue]);

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

                        {/* Notes Field */}
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
                    </View>
                    <View className="h-20" />
                </ScrollView>
            </KeyboardAvoidingView>


        </SafeAreaView>
    );
}
