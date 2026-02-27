import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Switch, Keyboard } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from '../src/i18n/useTranslation';
import { useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/useAuthStore';
import { Calendar as CalendarIcon, MapPin, Clock, Users, X } from 'lucide-react-native';
import { ThemeContext } from '../src/contexts/ThemeContext';
import { useContext } from 'react';
import { useCreateSessionMutation } from '../src/hooks/useSessionsQuery';
import { useTagsQuery } from '../src/hooks/useTagsQuery';

export default function AddSessionModal() {
    const { date } = useLocalSearchParams<{ date: string }>();
    const { t, currentLanguage } = useTranslation();
    const router = useRouter();
    const { session } = useAuthStore();
    const themeCtx = useContext(ThemeContext) as { activeTheme?: string };
    const isDark = themeCtx?.activeTheme === 'dark';

    const createSessionMutation = useCreateSessionMutation();

    const [title, setTitle] = useState('');
    const [venue, setVenue] = useState('');
    const [startTime, setStartTime] = useState('22:00');
    const [endTime, setEndTime] = useState('04:00');

    // Collective Session State
    const [isCollective, setIsCollective] = useState(false);
    const [djInput, setDjInput] = useState('');
    const [selectedDjs, setSelectedDjs] = useState<string[]>([]);

    // UI Focus States
    const [focusedInput, setFocusedInput] = useState<string | null>(null);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleFocus = (field: string) => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        setFocusedInput(field);
    };

    const handleBlur = () => {
        blurTimeoutRef.current = setTimeout(() => {
            setFocusedInput(null);
        }, 150);
    };

    // Tags and Autocomplete
    const { data: titleTags = [] } = useTagsQuery('title');
    const { data: venueTags = [] } = useTagsQuery('venue');
    const { data: djTags = [] } = useTagsQuery('dj');

    const filteredTitleTags = title.trim().length > 0
        ? titleTags
            .filter(t => t.name.toLowerCase().includes(title.toLowerCase()) && t.name.toLowerCase() !== title.toLowerCase())
            .slice(0, 10)
        : [];

    const filteredVenueTags = venue.trim().length > 0
        ? venueTags
            .filter(v => v.name.toLowerCase().includes(venue.toLowerCase()) && v.name.toLowerCase() !== venue.toLowerCase())
            .slice(0, 10)
        : [];

    const filteredDjTags = djInput.trim().length > 0
        ? djTags
            .filter(d => d.name.toLowerCase().includes(djInput.toLowerCase()) && !selectedDjs.includes(d.name))
            .slice(0, 10)
        : [];


    // Format the incoming date string (e.g. "2026-10-15")
    const dateObj = date ? new Date(date) : new Date();
    const dateIsoStr = dateObj.toISOString().split('T')[0]; // Format as YYYY-MM-DD for supabase
    const weekday = dateObj.toLocaleDateString(currentLanguage, { weekday: 'long' });
    const dayAndMonth = dateObj.toLocaleDateString(currentLanguage, { day: 'numeric', month: 'long', year: 'numeric' });

    const handleSave = async () => {
        if (!title.trim() || !venue.trim()) {
            Alert.alert(t('error'), t('missing_fields'));
            return;
        }

        // Auto-add any text left in the DJ input field before saving
        let finalDjs = [...selectedDjs];
        if (isCollective && djInput.trim().length > 0 && !finalDjs.includes(djInput.trim())) {
            finalDjs.push(djInput.trim());
            setSelectedDjs(finalDjs);
            setDjInput('');
        }

        try {
            await createSessionMutation.mutateAsync({
                date: dateIsoStr,
                title: title.trim(),
                venue: venue.trim(),
                start_time: startTime.trim(),
                end_time: endTime.trim(),
                is_collective: isCollective,
                djs: finalDjs
            });

            Alert.alert(t('success'), t('session_added_success'), [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            Alert.alert(t('error'), t('error_saving_session'));
        }
    };


    return (
        <SafeAreaView className="flex-1 bg-gray-50/50 dark:bg-gray-950" edges={['bottom', 'left', 'right']}>
            <Stack.Screen options={{
                headerShown: true,
                title: t('add_session'),
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.back()} className="mr-2">
                        <Text className="text-blue-600 dark:text-blue-500 font-medium text-lg">{t('cancel')}</Text>
                    </TouchableOpacity>
                ),
                headerTitleStyle: {
                    fontWeight: '700',
                    color: isDark ? '#F9FAFB' : '#111827'
                },
                headerStyle: { backgroundColor: isDark ? '#030712' : '#F9FAFB' },
                headerShadowVisible: false,
                presentation: 'modal',
            }} />

            <ScrollView
                className="flex-1 px-5 pt-4 pb-12"
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
            >

                {/* Hero Header */}
                <View className="items-center mb-8">

                    <Text className="text-3xl font-extrabold text-gray-900 dark:text-white capitalize text-center">
                        {weekday}
                    </Text>
                    <Text className="text-lg text-blue-600 dark:text-blue-400 font-medium mt-1 uppercase tracking-wider">
                        {dayAndMonth}
                    </Text>
                </View>

                {/* Form Elements */}
                <View className="flex-col gap-6">

                    {/* Title Input */}
                    <View className="z-50">
                        <View className="flex-row justify-between items-end mb-2">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1 uppercase tracking-wide">
                                {t('session_title')} *
                            </Text>
                        </View>

                        {/* Autocomplete Tags */}
                        {focusedInput === 'title' && filteredTitleTags.length > 0 && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                className="mb-3"
                            >
                                {filteredTitleTags.map((tag) => (
                                    <TouchableOpacity
                                        key={tag.name}
                                        activeOpacity={0.7}
                                        className="px-4 py-2 rounded-full mr-2 border"
                                        style={{ backgroundColor: tag.color + '26', borderColor: tag.color + '4D' }}
                                        onPress={() => {
                                            setTitle(tag.name);
                                        }}
                                        onPressOut={() => setFocusedInput(null)}
                                    >
                                        <Text className="font-medium" style={{ color: tag.color }}>{tag.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}

                        <View className={`rounded-2xl border-2 transition-colors duration-200 overflow-hidden ${focusedInput === 'title' ? 'border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-900 shadow-sm shadow-blue-500/10' : 'border-transparent bg-white dark:bg-gray-900 shadow-sm shadow-black/5'}`}>
                            <TextInput
                                className="px-5 py-4 text-gray-900 dark:text-white text-base font-medium"
                                placeholder={t('session_title_placeholder')}
                                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                value={title}
                                onChangeText={setTitle}
                                onFocus={() => handleFocus('title')}
                                onBlur={handleBlur}
                            />
                        </View>
                    </View>

                    {/* Venue Input */}
                    <View className="z-40">
                        <View className="flex-row justify-between items-end mb-2">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1 uppercase tracking-wide">
                                {t('venue')} *
                            </Text>
                        </View>

                        {/* Autocomplete Tags */}
                        {focusedInput === 'venue' && filteredVenueTags.length > 0 && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                className="mb-3"
                            >
                                {filteredVenueTags.map((tag) => (
                                    <TouchableOpacity
                                        key={tag.name}
                                        activeOpacity={0.7}
                                        className="px-4 py-2 rounded-full mr-2 border flex-row items-center"
                                        style={{ backgroundColor: tag.color + '26', borderColor: tag.color + '4D' }}
                                        onPress={() => {
                                            setVenue(tag.name);
                                        }}
                                        onPressOut={() => setFocusedInput(null)}
                                    >
                                        <MapPin size={14} color={tag.color} className="mr-1.5" />
                                        <Text className="font-medium" style={{ color: tag.color }}>{tag.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}

                        <View className={`relative justify-center rounded-2xl border-2 transition-colors duration-200 overflow-hidden ${focusedInput === 'venue' ? 'border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-900 shadow-sm shadow-blue-500/10' : 'border-transparent bg-white dark:bg-gray-900 shadow-sm shadow-black/5'}`}>
                            <View className="absolute left-5 z-10 w-6 items-center">
                                <MapPin size={22} color={focusedInput === 'venue' ? (isDark ? '#60A5FA' : '#3B82F6') : (isDark ? '#6B7280' : '#9CA3AF')} />
                            </View>
                            <TextInput
                                className="pl-14 pr-5 py-4 text-gray-900 dark:text-white text-base font-medium"
                                placeholder={t('venue_placeholder')}
                                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                value={venue}
                                onChangeText={setVenue}
                                onFocus={() => handleFocus('venue')}
                                onBlur={handleBlur}
                            />
                        </View>
                    </View>

                    {/* Collective Session Toggle */}
                    <View className="flex-row items-center justify-between mb-4 mt-2 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm shadow-black/5">
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full items-center justify-center mr-3">
                                <Users size={20} color={isDark ? '#60A5FA' : '#3B82F6'} />
                            </View>
                            <Text className="text-base font-semibold text-gray-900 dark:text-white">
                                {t('collective_session')}
                            </Text>
                        </View>
                        <Switch
                            value={isCollective}
                            onValueChange={setIsCollective}
                            trackColor={{ false: isDark ? '#374151' : '#E5E7EB', true: isDark ? '#60A5FA' : '#3B82F6' }}
                            thumbColor={isDark ? '#D1D5DB' : '#FFFFFF'}
                        />
                    </View>

                    {/* DJs Input */}
                    {isCollective && (
                        <View className="z-30 mb-4">
                            <View className="flex-row justify-between items-end mb-2">
                                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1 uppercase tracking-wide">
                                    {t('add_djs')}
                                </Text>
                            </View>

                            {/* Autocomplete Tags */}
                            {focusedInput === 'dj' && filteredDjTags.length > 0 && (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    keyboardShouldPersistTaps="handled"
                                    className="mb-3"
                                >
                                    {filteredDjTags.map((tag) => (
                                        <TouchableOpacity
                                            key={tag.name}
                                            activeOpacity={0.7}
                                            className="px-4 py-2 rounded-full mr-2 border flex-row items-center"
                                            style={{ backgroundColor: tag.color + '26', borderColor: tag.color + '4D' }}
                                            onPress={() => {
                                                if (!selectedDjs.includes(tag.name)) {
                                                    setSelectedDjs([...selectedDjs, tag.name]);
                                                    setDjInput(''); // Clear input after selection
                                                }
                                            }}
                                            onPressOut={() => setFocusedInput(null)}
                                        >
                                            <Users size={14} color={tag.color} className="mr-1.5" />
                                            <Text className="font-medium" style={{ color: tag.color }}>{tag.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}

                            <View className={`relative justify-center rounded-2xl border-2 transition-colors duration-200 overflow-hidden ${focusedInput === 'dj' ? 'border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-900 shadow-sm shadow-blue-500/10' : 'border-transparent bg-white dark:bg-gray-900 shadow-sm shadow-black/5'}`}>
                                <View className="absolute left-5 z-10 w-6 items-center">
                                    <Users size={22} color={focusedInput === 'dj' ? (isDark ? '#60A5FA' : '#3B82F6') : (isDark ? '#6B7280' : '#9CA3AF')} />
                                </View>
                                <TextInput
                                    className="pl-14 pr-5 py-4 text-gray-900 dark:text-white text-base font-medium"
                                    placeholder={t('add_djs_placeholder')}
                                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                    value={djInput}
                                    onChangeText={setDjInput}
                                    onFocus={() => handleFocus('dj')}
                                    onBlur={handleBlur}
                                    onSubmitEditing={() => {
                                        if (djInput.trim() && !selectedDjs.includes(djInput.trim())) {
                                            setSelectedDjs([...selectedDjs, djInput.trim()]);
                                            setDjInput('');
                                        }
                                    }}
                                    returnKeyType="done"
                                />
                            </View>

                            {/* Selected DJs Pills */}
                            {selectedDjs.length > 0 && (
                                <View className="flex-row flex-wrap mt-3 gap-2">
                                    {selectedDjs.map((dj, index) => {
                                        const hashTagColor = djTags.find(t => t.name === dj)?.color || '#3B82F6';
                                        return (
                                            <View key={index} className="flex-row items-center px-3 py-2 rounded-xl border bg-white dark:bg-gray-800" style={{ borderColor: hashTagColor + '4D' }}>
                                                <Text className="font-semibold mr-2" style={{ color: hashTagColor }}>{dj}</Text>
                                                <TouchableOpacity onPress={() => setSelectedDjs(selectedDjs.filter(d => d !== dj))} className="bg-gray-100 dark:bg-gray-700 rounded-full p-1">
                                                    <X size={12} color={isDark ? '#D1D5DB' : '#6B7280'} />
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Time Inputs Row */}
                    <View className="flex-row space-x-4">
                        <View className="flex-1 mr-2">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">
                                {t('start_time')}
                            </Text>
                            <View className={`relative justify-center rounded-2xl border-2 transition-colors duration-200 overflow-hidden ${focusedInput === 'start' ? 'border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-900 shadow-sm shadow-blue-500/10' : 'border-transparent bg-white dark:bg-gray-900 shadow-sm shadow-black/5'}`}>
                                <View className="absolute left-4 z-10 w-5 items-center">
                                    <Clock size={20} color={focusedInput === 'start' ? (isDark ? '#60A5FA' : '#3B82F6') : (isDark ? '#6B7280' : '#9CA3AF')} />
                                </View>
                                <TextInput
                                    className="pl-11 pr-4 py-4 text-gray-900 dark:text-white text-base font-medium"
                                    placeholder="22:00"
                                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                    value={startTime}
                                    onChangeText={setStartTime}
                                    onFocus={() => setFocusedInput('start')}
                                    onBlur={() => setFocusedInput(null)}
                                />
                            </View>
                        </View>

                        <View className="flex-1 ml-2">
                            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1 uppercase tracking-wide">
                                {t('end_time')}
                            </Text>
                            <View className={`relative justify-center rounded-2xl border-2 transition-colors duration-200 overflow-hidden ${focusedInput === 'end' ? 'border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-900 shadow-sm shadow-blue-500/10' : 'border-transparent bg-white dark:bg-gray-900 shadow-sm shadow-black/5'}`}>
                                <View className="absolute left-4 z-10 w-5 items-center">
                                    <Clock size={20} color={focusedInput === 'end' ? (isDark ? '#60A5FA' : '#3B82F6') : (isDark ? '#6B7280' : '#9CA3AF')} />
                                </View>
                                <TextInput
                                    className="pl-11 pr-4 py-4 text-gray-900 dark:text-white text-base font-medium"
                                    placeholder="04:00"
                                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                    value={endTime}
                                    onChangeText={setEndTime}
                                    onFocus={() => setFocusedInput('end')}
                                    onBlur={() => setFocusedInput(null)}
                                />
                            </View>
                        </View>
                    </View>

                </View>

                {/* Save Button */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    className={`mt-10 mb-12 flex-row justify-center items-center py-4 rounded-2xl shadow-lg ${createSessionMutation.isPending || !title.trim() || !venue.trim()
                        ? 'bg-blue-300 dark:bg-blue-900/50 shadow-none'
                        : 'bg-blue-600 dark:bg-blue-500 shadow-blue-500/40'
                        }`}
                    onPress={handleSave}
                    disabled={createSessionMutation.isPending || !title.trim() || !venue.trim()}
                >
                    {createSessionMutation.isPending ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold text-[17px] tracking-wide">
                            {t('save_session')}
                        </Text>
                    )}
                </TouchableOpacity>

                {/* Bottom Spacer to ensure scrollability over safe area */}
                <View className="h-10" />

            </ScrollView>
        </SafeAreaView>
    );
}
