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
    Calendar
} from 'lucide-react-native';
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
    const [newContact, setNewContact] = useState('');
    const [newNotes, setNewNotes] = useState('');

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
            await createVenueMutation.mutateAsync({
                name: normalizedName,
                address: newAddress.trim(),
                contact_info: newContact.trim(),
                notes: newNotes.trim()
            });

            setIsAddModalVisible(false);
            setNewName('');
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
                                    autoFocus
                                />
                            </View>
                        </View>

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
