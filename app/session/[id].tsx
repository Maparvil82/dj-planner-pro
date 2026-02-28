import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSessionByIdQuery } from '../../src/hooks/useSessionsQuery';
import { ArrowLeft, Calendar, Clock, MapPin, Users, Banknote, Tag } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

export default function SessionDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    const { data: session, isLoading, error } = useSessionByIdQuery(id as string);

    if (isLoading) {
        return (
            <View className="flex-1 bg-white dark:bg-black items-center justify-center">
                <Stack.Screen options={{ headerShown: false }} />
                <ActivityIndicator size="large" color={isDark ? 'white' : 'black'} />
            </View>
        );
    }

    if (error || !session) {
        return (
            <View className="flex-1 justify-center items-center p-4 bg-white dark:bg-black">
                <Stack.Screen options={{ headerShown: false }} />
                <Text className="text-xl font-bold text-red-500 mb-2">Error</Text>
                <Text className="text-gray-500 mb-6 text-center">No pudimos cargar la información de esta sesión.</Text>
                <TouchableOpacity
                    className="bg-blue-600 px-6 py-3 rounded-xl"
                    onPress={() => router.back()}
                >
                    <Text className="text-white font-bold">Volver atrás</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Format date specifically if needed, here relying on YYYY-MM-DD text
    const [y, m, d] = session.date.split('-');
    const formattedDate = `${d}/${m}/${y}`;

    return (
        <View className="flex-1 bg-gray-50 dark:bg-black">
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Detalles de la sesión',
                    headerStyle: {
                        backgroundColor: isDark ? '#000000' : '#FFFFFF',
                    },
                    headerTintColor: isDark ? '#FFFFFF' : '#000000',
                    headerShadowVisible: false,
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} className="mr-4">
                            <ArrowLeft size={24} color={isDark ? '#FFFFFF' : '#000000'} />
                        </TouchableOpacity>
                    ),
                }}
            />

            <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
                {/* Header Section */}
                <View className="items-center mb-8">
                    <View
                        className="w-20 h-20 rounded-full items-center justify-center mb-4"
                        style={{ backgroundColor: session.color + '26' }}
                    >
                        <Tag size={32} color={session.color} />
                    </View>
                    <Text className="text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-2">
                        {session.title}
                    </Text>
                    <Text className="text-lg font-medium text-gray-500 dark:text-gray-400 text-center">
                        {session.venue}
                    </Text>
                </View>

                {/* Details Card */}
                <View className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">

                    {/* Date */}
                    <View className="flex-row items-center py-4 border-b border-gray-50 dark:border-gray-800/50">
                        <View className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 items-center justify-center mr-4">
                            <Calendar size={20} color={isDark ? '#60A5FA' : '#3B82F6'} />
                        </View>
                        <View className="flex-1">
                            <Text className="text-sm font-medium text-gray-400 dark:text-gray-500 mb-0.5">Fecha</Text>
                            <Text className="text-base font-bold text-gray-900 dark:text-white">{formattedDate}</Text>
                        </View>
                    </View>

                    {/* Time */}
                    <View className="flex-row items-center py-4 border-b border-gray-50 dark:border-gray-800/50">
                        <View className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 items-center justify-center mr-4">
                            <Clock size={20} color={isDark ? '#F97316' : '#EA580C'} />
                        </View>
                        <View className="flex-1">
                            <Text className="text-sm font-medium text-gray-400 dark:text-gray-500 mb-0.5">Horario</Text>
                            <Text className="text-base font-bold text-gray-900 dark:text-white">{session.start_time} - {session.end_time}</Text>
                        </View>
                    </View>

                    {/* Venue */}
                    <View className="flex-row items-center py-4 border-b border-gray-50 dark:border-gray-800/50">
                        <View className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 items-center justify-center mr-4">
                            <MapPin size={20} color={isDark ? '#C084FC' : '#9333EA'} />
                        </View>
                        <View className="flex-1">
                            <Text className="text-sm font-medium text-gray-400 dark:text-gray-500 mb-0.5">Lugar</Text>
                            <Text className="text-base font-bold text-gray-900 dark:text-white">{session.venue}</Text>
                        </View>
                    </View>

                    {/* Collective DJs */}
                    {session.is_collective && session.djs && session.djs.length > 0 && (
                        <View className="flex-row items-center py-4 border-b border-gray-50 dark:border-gray-800/50">
                            <View className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 items-center justify-center mr-4">
                                <Users size={20} color={isDark ? '#2DD4BF' : '#0D9488'} />
                            </View>
                            <View className="flex-1">
                                <Text className="text-sm font-medium text-gray-400 dark:text-gray-500 mb-0.5">DJs (Colectivo)</Text>
                                <Text className="text-base font-bold text-gray-900 dark:text-white">{session.djs.join(', ')}</Text>
                            </View>
                        </View>
                    )}

                    {/* Earnings */}
                    {session.earning_type && session.earning_type !== 'free' && (
                        <View className="flex-row items-center py-4 border-b border-gray-50 dark:border-gray-800/50">
                            <View className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 items-center justify-center mr-4">
                                <Banknote size={20} color={isDark ? '#4ADE80' : '#16A34A'} />
                            </View>
                            <View className="flex-1">
                                <Text className="text-sm font-medium text-gray-400 dark:text-gray-500 mb-0.5">Beneficio económico</Text>
                                <View className="flex-row items-baseline gap-2">
                                    <Text className="text-base font-bold text-green-600 dark:text-green-500">
                                        {session.earning_type === 'hourly' ? `${session.earning_amount} ${session.currency || '€'} / hr` : `${session.earning_amount} ${session.currency || '€'} (fijo)`}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                </View>
            </ScrollView>
        </View>
    );
}
