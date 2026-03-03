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
    Check
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
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (venue) {
            setName(venue.name || '');
            setAddress(venue.address || '');
            setContact(venue.contact_info || '');
            setNotes(venue.notes || '');
        }
    }, [venue]);

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert(t('error'), t('missing_fields'));
            return;
        }

        try {
            await updateVenueMutation.mutateAsync({
                venueId: venue!.id,
                input: {
                    name: name.trim(),
                    address: address.trim(),
                    contact_info: contact.trim(),
                    notes: notes.trim()
                }
            });
            setHasChanges(false);
            Alert.alert(t('success'), t('venue_added_success'));
        } catch (err) {
            Alert.alert(t('error'), t('error_saving_session'));
        }
    };

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
                <Text className="text-xl font-black text-gray-900 dark:text-white flex-1 text-center mx-2" numberOfLines={1}>
                    {t('edit_venue')}
                </Text>
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
                    </View>
                    <View className="h-20" />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Save Button Overlay (only if changes) */}
            {hasChanges && (
                <View className="absolute bottom-10 left-6 right-6">
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={updateVenueMutation.isPending}
                        className="bg-blue-600 py-4 rounded-2xl items-center justify-center flex-row shadow-lg shadow-blue-500/30"
                    >
                        {updateVenueMutation.isPending ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <>
                                <Save size={20} color="#FFFFFF" className="mr-2" />
                                <Text className="text-white font-black text-lg ml-2">
                                    {t('save_session')}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}
