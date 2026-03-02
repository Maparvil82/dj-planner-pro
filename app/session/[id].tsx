import React, { useContext } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Share } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSessionByIdQuery, useDeleteSessionMutation } from '../../src/hooks/useSessionsQuery';
import { ArrowLeft, Calendar, Clock, MapPin, Users, Banknote, Trash2, Share2, ChevronLeft, MapPinned } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { ThemeContext } from '../../src/contexts/ThemeContext';

export default function SessionDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { t, currentLanguage } = useTranslation();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';

    const { data: session, isLoading, error } = useSessionByIdQuery(id as string);
    const deleteSessionMutation = useDeleteSessionMutation();

    const handleDelete = () => {
        Alert.alert(
            t('delete_session_title') || 'Eliminar Sesión',
            t('delete_session_message') || '¿Estás seguro de que quieres eliminar esta sesión de forma permanente?',
            [
                { text: t('cancel') || 'Cancelar', style: 'cancel' },
                {
                    text: t('delete') || 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        await deleteSessionMutation.mutateAsync(id as string);
                        router.back();
                    }
                }
            ]
        );
    };

    const handleShare = async () => {
        if (!session) return;
        try {
            const message = `${session.title}\n📍 ${session.venue}\n📅 ${capitalizedDate}\n⏰ ${session.start_time} - ${session.end_time}`;
            await Share.share({ message });
        } catch (error) {
            console.error('Error sharing session:', error);
        }
    };

    if (isLoading) {
        return (
            <View className="flex-1 bg-white dark:bg-gray-950 items-center justify-center">
                <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
            </View>
        );
    }

    if (error || !session) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-gray-950 items-center justify-center p-6">
                <Text className="text-xl font-bold text-red-500 mb-2">Error</Text>
                <Text className="text-gray-500 dark:text-gray-400 mb-6 text-center">
                    {t('error_loading_session') || 'No pudimos cargar la información de esta sesión.'}
                </Text>
                <TouchableOpacity
                    className="bg-black dark:bg-blue-600 px-8 py-4 rounded-2xl shadow-lg"
                    onPress={() => router.back()}
                >
                    <Text className="text-white font-bold">{t('go_back') || 'Volver atrás'}</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const [y, m, d] = session.date.split('-');
    const sessionDateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const formattedDate = sessionDateObj.toLocaleDateString(currentLanguage, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    const calculateSessionDuration = () => {
        const [startH, startM] = (session.start_time || '00:00').split(':').map(Number);
        const [endH, endM] = (session.end_time || '00:00').split(':').map(Number);
        let startMins = startH * 60 + startM;
        let endMins = endH * 60 + endM;
        if (endMins <= startMins) endMins += 24 * 60;
        return (endMins - startMins) / 60;
    };

    const calculateSessionEarnings = () => {
        if (session.earning_type === 'fixed') return session.earning_amount || 0;
        if (session.earning_type === 'hourly') {
            return (session.earning_amount || 0) * calculateSessionDuration();
        }
        return 0;
    };

    const duration = calculateSessionDuration();
    const earnings = calculateSessionEarnings();

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-950" edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Flat Header */}
            <View className="flex-row items-center justify-between px-6 py-4">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-full"
                >
                    <ChevronLeft size={24} color={isDark ? '#FFFFFF' : '#111827'} />
                </TouchableOpacity>
                <View className="flex-row gap-2">
                    <TouchableOpacity
                        onPress={handleShare}
                        className="w-10 h-10 items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-full"
                    >
                        <Share2 size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleDelete}
                        className="w-10 h-10 items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-full"
                    >
                        <Trash2 size={20} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Title and Earnings Section */}
                <View className="mb-8">
                    <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
                        {t('session_summary_label') || 'Resumen de la sesión'}
                    </Text>
                    <Text className="text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-3">
                        {session.title}
                    </Text>

                    {/* Estimated Earnings prominently below title */}
                    <View className="flex-row items-center bg-emerald-50 dark:bg-emerald-900/20 self-start px-4 py-2 rounded-2xl border border-emerald-100 dark:border-emerald-800/40">
                        <Banknote size={16} color={isDark ? '#34D399' : '#059669'} className="mr-2" />
                        <Text className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mr-2">
                            {t('total_earnings') || 'Total Ganado'}:
                        </Text>
                        <Text className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                            {earnings.toFixed(2)} {session.currency || '€'}
                        </Text>
                    </View>
                </View>

                {/* Venue Section (Flat Style) */}
                <View className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-6 flex-row items-center mb-6">
                    <View className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full items-center justify-center mr-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <MapPinned size={22} color={isDark ? '#FFFFFF' : '#111827'} />
                    </View>
                    <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
                            {t('venue') || 'Ubicación'}
                        </Text>
                        <Text className="text-lg font-bold text-gray-900 dark:text-white">
                            {session.venue}
                        </Text>
                    </View>
                </View>

                {/* Summary Section (Mockup Inspiration) */}
                <View className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-8">
                    <Text className="text-xl font-black text-gray-900 dark:text-white mb-6">
                        {t('session_detail_header') || 'Detalle de la sesión'}
                    </Text>

                    <View className="space-y-6">
                        {/* Date Row */}
                        <View className="flex-row justify-between items-center">
                            <Text className="text-base text-gray-500 dark:text-gray-400 font-medium">{t('date') || 'Fecha'}</Text>
                            <Text className="text-base text-gray-900 dark:text-white font-bold">{capitalizedDate}</Text>
                        </View>

                        {/* Clock Row */}
                        <View className="flex-row justify-between items-center">
                            <Text className="text-base text-gray-500 dark:text-gray-400 font-medium">{t('time_label') || 'Horario'}</Text>
                            <Text className="text-base text-gray-900 dark:text-white font-bold">{session.start_time} — {session.end_time}</Text>
                        </View>

                        {/* Duration Row */}
                        <View className="flex-row justify-between items-center">
                            <Text className="text-base text-gray-500 dark:text-gray-400 font-medium">{t('duration') || 'Duración'}</Text>
                            <Text className="text-base text-gray-900 dark:text-white font-bold">{duration.toFixed(1)} h</Text>
                        </View>

                        {/* Crew Row */}
                        {session.is_collective && session.djs && session.djs.length > 0 && (
                            <View className="flex-row justify-between items-center">
                                <Text className="text-base text-gray-500 dark:text-gray-400 font-medium">{t('shared_with') || 'Compartes con'}</Text>
                                <Text className="text-base text-gray-900 dark:text-white font-bold text-right flex-1 ml-4" numberOfLines={2}>
                                    {session.djs.join(', ')}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
