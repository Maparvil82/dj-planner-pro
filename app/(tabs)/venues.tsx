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
    Platform
} from 'react-native';
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
    ArrowRight
} from 'lucide-react-native';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useVenuesQuery, useCreateVenueMutation } from '../../src/hooks/useVenuesQuery';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { useContext } from 'react';
import { useRouter } from 'expo-router';

export default function VenuesScreen() {
    const { t } = useTranslation();
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
    const [newContact, setNewContact] = useState('');
    const [newNotes, setNewNotes] = useState('');

    const filteredVenues = useMemo(() => {
        if (!venues) return [];
        if (!searchQuery) return venues;

        const lowerQuery = searchQuery.toLowerCase();
        return venues.filter(v =>
            v.name.toLowerCase().includes(lowerQuery) ||
            v.address?.toLowerCase().includes(lowerQuery)
        );
    }, [venues, searchQuery]);

    const handleCreateVenue = async () => {
        if (!newName.trim()) {
            Alert.alert(t('error'), t('missing_fields'));
            return;
        }

        try {
            await createVenueMutation.mutateAsync({
                name: newName.trim(),
                address: newAddress.trim(),
                contact_info: newContact.trim(),
                notes: newNotes.trim()
            });

            setIsAddModalVisible(false);
            setNewName('');
            setNewAddress('');
            setNewContact('');
            setNewNotes('');
        } catch (error) {
            Alert.alert(t('error'), t('error_saving_session'));
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
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-950" edges={['top']}>
            {/* Header */}
            <View className="px-6 pt-4 pb-2">
                <View className="flex-row items-center justify-between">
                    <Text className="text-3xl font-black text-gray-900 dark:text-white">
                        {t('venues_title')}
                    </Text>
                    <TouchableOpacity
                        onPress={() => setIsAddModalVisible(true)}
                        className="w-10 h-10 rounded-full bg-blue-600 items-center justify-center"
                    >
                        <Plus size={24} color="#FFFFFF" />
                    </TouchableOpacity>
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
                {filteredVenues.length === 0 ? (
                    <View className="py-20 items-center justify-center">
                        <View className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full items-center justify-center mb-4 border border-gray-100 dark:border-gray-800">
                            <MapPin size={32} color={isDark ? '#4B5563' : '#9CA3AF'} />
                        </View>
                        <Text className="text-gray-500 dark:text-gray-400 text-lg font-bold text-center px-10">
                            {searchQuery ? t('no_results_filtered') : t('no_venues_yet')}
                        </Text>
                    </View>
                ) : (
                    filteredVenues.map((venue) => (
                        <TouchableOpacity
                            key={venue.id}
                            activeOpacity={0.7}
                            onPress={() => router.push(`/venue/${venue.id}`)}
                            className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 mb-4 flex-row items-center"
                        >
                            <View className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl items-center justify-center mr-4">
                                <MapPin size={24} color="#2563EB" />
                            </View>
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
                        className="bg-white dark:bg-gray-950 rounded-t-[40px] px-6 pt-8 pb-10"
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

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View className="space-y-6">
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
                                    />
                                </View>

                                <View className="mt-6">
                                    <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                        {t('venue_address')}
                                    </Text>
                                    <TextInput
                                        className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-medium border border-gray-100 dark:border-gray-800"
                                        placeholder="Calle Ejemplo 123..."
                                        placeholderTextColor="#9CA3AF"
                                        value={newAddress}
                                        onChangeText={setNewAddress}
                                        multiline
                                    />
                                </View>

                                <View className="mt-6">
                                    <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                        {t('venue_contact')}
                                    </Text>
                                    <TextInput
                                        className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-medium border border-gray-100 dark:border-gray-800"
                                        placeholder="+34 600..."
                                        placeholderTextColor="#9CA3AF"
                                        value={newContact}
                                        onChangeText={setNewContact}
                                    />
                                </View>

                                <View className="mt-6">
                                    <Text className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">
                                        {t('venue_notes')}
                                    </Text>
                                    <TextInput
                                        className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-medium border border-gray-100 dark:border-gray-800"
                                        placeholder="..."
                                        placeholderTextColor="#9CA3AF"
                                        value={newNotes}
                                        onChangeText={setNewNotes}
                                        multiline
                                        numberOfLines={4}
                                        textAlignVertical="top"
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            onPress={handleCreateVenue}
                            disabled={createVenueMutation.isPending}
                            className="mt-8 bg-blue-600 py-4 rounded-2xl items-center justify-center flex-row"
                        >
                            {createVenueMutation.isPending ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <Text className="text-white font-black text-lg mr-2">
                                        {t('save_session')}
                                    </Text>
                                    <ArrowRight size={20} color="#FFFFFF" />
                                </>
                            )}
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
