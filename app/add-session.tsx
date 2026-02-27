import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from '../src/i18n/useTranslation';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/useAuthStore';
import { Calendar as CalendarIcon, MapPin, Clock } from 'lucide-react-native';
import { ThemeContext } from '../src/contexts/ThemeContext';
import { useContext } from 'react';

export default function AddSessionModal() {
    const { date } = useLocalSearchParams<{ date: string }>();
    const { t, currentLanguage } = useTranslation();
    const router = useRouter();
    const { session } = useAuthStore();
    const themeCtx = useContext(ThemeContext) as { activeTheme?: string };
    const isDark = themeCtx?.activeTheme === 'dark';

    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [venue, setVenue] = useState('');
    const [startTime, setStartTime] = useState('22:00');
    const [endTime, setEndTime] = useState('04:00');

    // Format the incoming date string (e.g. "2026-10-15")
    const formattedDate = date ? new Date(date).toLocaleDateString(currentLanguage, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : '';

    const handleSave = async () => {
        if (!title.trim() || !venue.trim()) {
            Alert.alert(t('error'), t('missing_fields'));
            return;
        }

        setLoading(true);

        try {
            // TODO: Actually save this to supabase
            // Mock waiting time
            await new Promise(resolve => setTimeout(resolve, 800));

            Alert.alert(t('success'), t('session_added_success'), [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            Alert.alert(t('error'), t('error_saving_session'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['bottom', 'left', 'right']}>
            <Stack.Screen options={{
                headerShown: true,
                title: t('add_session'),
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text className="text-blue-500 font-medium text-lg mr-4">{t('cancel')}</Text>
                    </TouchableOpacity>
                ),
                headerStyle: { backgroundColor: 'transparent' },
                headerShadowVisible: false,
                headerTintColor: '#3b82f6', // blue-500
                presentation: 'modal',
            }} />

            <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
                {/* Header info */}
                <View className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-2xl mb-6 flex-row items-center border border-blue-100 dark:border-blue-900/50">
                    <View className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-full items-center justify-center mr-3">
                        <CalendarIcon size={20} color={isDark ? '#60A5FA' : '#2563EB'} />
                    </View>
                    <View className="flex-1">
                        <Text className="text-blue-900 dark:text-blue-100 font-bold">
                            {t('selected_date')}
                        </Text>
                        <Text className="text-blue-700 dark:text-blue-300 capitalize mt-1">
                            {formattedDate}
                        </Text>
                    </View>
                </View>

                {/* Form fields */}
                <View className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm shadow-black/5 border border-gray-100 dark:border-gray-800 space-y-4">

                    <View>
                        <Text className="text-gray-700 dark:text-gray-300 font-bold mb-2 ml-1">
                            {t('session_title')} *
                        </Text>
                        <TextInput
                            className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white"
                            placeholder={t('session_title_placeholder')}
                            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                            value={title}
                            onChangeText={setTitle}
                        />
                    </View>

                    <View>
                        <Text className="text-gray-700 dark:text-gray-300 font-bold mb-2 ml-1">
                            {t('venue')} *
                        </Text>
                        <View className="relative justify-center">
                            <View className="absolute left-4 z-10 w-5 items-center">
                                <MapPin size={18} color={isDark ? '#6B7280' : '#9CA3AF'} />
                            </View>
                            <TextInput
                                className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl pl-11 pr-4 py-3 text-gray-900 dark:text-white"
                                placeholder={t('venue_placeholder')}
                                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                value={venue}
                                onChangeText={setVenue}
                            />
                        </View>
                    </View>

                    <View className="flex-row space-x-4">
                        <View className="flex-1 mr-2">
                            <Text className="text-gray-700 dark:text-gray-300 font-bold mb-2 ml-1">
                                {t('start_time')}
                            </Text>
                            <View className="relative justify-center">
                                <View className="absolute left-4 z-10 w-5 items-center">
                                    <Clock size={18} color={isDark ? '#6B7280' : '#9CA3AF'} />
                                </View>
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl pl-11 pr-4 py-3 text-gray-900 dark:text-white"
                                    placeholder="22:00"
                                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                    value={startTime}
                                    onChangeText={setStartTime}
                                />
                            </View>
                        </View>

                        <View className="flex-1 ml-2">
                            <Text className="text-gray-700 dark:text-gray-300 font-bold mb-2 ml-1">
                                {t('end_time')}
                            </Text>
                            <View className="relative justify-center">
                                <View className="absolute left-4 z-10 w-5 items-center">
                                    <Clock size={18} color={isDark ? '#6B7280' : '#9CA3AF'} />
                                </View>
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl pl-11 pr-4 py-3 text-gray-900 dark:text-white"
                                    placeholder="04:00"
                                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                    value={endTime}
                                    onChangeText={setEndTime}
                                />
                            </View>
                        </View>
                    </View>

                </View>

                {/* Save Button */}
                <TouchableOpacity
                    className={`mt-8 mb-12 flex-row justify-center py-4 rounded-full ${loading || !title.trim() || !venue.trim()
                        ? 'bg-blue-300 dark:bg-blue-900/50'
                        : 'bg-blue-600 dark:bg-blue-500'
                        }`}
                    onPress={handleSave}
                    disabled={loading || !title.trim() || !venue.trim()}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold text-lg">
                            {t('save_session')}
                        </Text>
                    )}
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}
