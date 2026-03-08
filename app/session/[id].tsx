import React, { useContext, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Share,
    Image,
    Modal
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import {
    useSessionByIdQuery,
    useDeleteSessionMutation,
    useUpdateSessionColorMutation
} from '../../src/hooks/useSessionsQuery';
import {
    Calendar,
    Clock,
    MapPin,
    Users,
    Trash2,
    Share2,
    ChevronLeft,
    MapPinned,
    Palette,
    X,
    Pencil,
    ArrowRight,
    Folder,
    Plus,
    FolderPlus,
    Banknote
} from 'lucide-react-native';
import {
    useVaultFoldersByAssociationQuery,
    useCreateFolderMutation
} from '../../src/hooks/useVaultQuery';
import { useAuthStore } from '../../src/store/useAuthStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { ThemeContext } from '../../src/contexts/ThemeContext';

export default function SessionDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { t, currentLanguage } = useTranslation();
    const themeCtx = useContext(ThemeContext);
    const { session: authSession } = useAuthStore();

    if (!authSession) {
        return <Redirect href="/(auth)/login" />;
    }
    const isDark = themeCtx?.activeTheme === 'dark';

    const { data: session, isLoading, error } = useSessionByIdQuery(id as string);
    const deleteSessionMutation = useDeleteSessionMutation();
    const updateColorMutation = useUpdateSessionColorMutation();

    const { data: associatedFolders = [], isLoading: isLoadingFolders } = useVaultFoldersByAssociationQuery('session', id as string);
    const createFolderMutation = useCreateFolderMutation();

    const [isColorModalVisible, setIsColorModalVisible] = useState(false);

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

            {/* Header */}
            <View className="flex-row items-center justify-between px-6 py-4">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-full"
                >
                    <ChevronLeft size={24} color={isDark ? '#FFFFFF' : '#111827'} />
                </TouchableOpacity>
                <View className="flex-row items-center space-x-3">
                    <TouchableOpacity
                        onPress={() => router.push(`/edit-session/${id}`)}
                        className="p-2"
                        activeOpacity={0.7}
                    >
                        <Pencil size={22} color={isDark ? '#D1D5DB' : '#4B5563'} strokeWidth={1.5} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setIsColorModalVisible(true)}
                        className="p-2"
                        activeOpacity={0.7}
                    >
                        <Palette size={22} color={session.color || (isDark ? '#D1D5DB' : '#4B5563')} strokeWidth={1.5} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleShare}
                        className="p-2"
                        activeOpacity={0.7}
                    >
                        <Share2 size={20} color={isDark ? '#D1D5DB' : '#4B5563'} strokeWidth={1.5} />
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
                {/* VAULT SECTION */}
                <View className="mb-8 px-2">
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center">
                            <View className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 items-center justify-center mr-3">
                                <Folder size={18} color="#2563EB" />
                            </View>
                            <Text className="text-lg font-bold text-gray-900 dark:text-white">
                                {t('session_vault') || 'Documentos y Carpetas'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                Alert.prompt(
                                    t('new_folder') || 'Nueva Carpeta',
                                    t('folder_name_placeholder') || 'Ejem: Contratos, Riders...',
                                    [
                                        { text: t('cancel'), style: 'cancel' },
                                        {
                                            text: t('create'),
                                            onPress: (name?: string) => {
                                                if (name) createFolderMutation.mutate({
                                                    name,
                                                    type: 'session',
                                                    associatedId: id as string
                                                });
                                            }
                                        }
                                    ]
                                );
                            }}
                            className="flex-row items-center bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg"
                        >
                            <Plus size={14} color="#2563EB" className="mr-1" />
                            <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                {t('add_folder') || 'Añadir'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {isLoadingFolders ? (
                        <ActivityIndicator size="small" color="#2563EB" />
                    ) : associatedFolders.length > 0 ? (
                        <View className="gap-2">
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
                                    <ChevronLeft size={16} color={isDark ? '#4B5563' : '#9CA3AF'} style={{ transform: [{ rotate: '180deg' }] }} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={() => {
                                Alert.prompt(
                                    t('new_folder') || 'Nueva Carpeta',
                                    t('folder_name_placeholder') || 'Ejem: Contratos, Riders...',
                                    [
                                        { text: t('cancel'), style: 'cancel' },
                                        {
                                            text: t('create'),
                                            onPress: (name?: string) => {
                                                if (name) createFolderMutation.mutate({
                                                    name,
                                                    type: 'session',
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
                                {t('no_associated_folders') || 'No hay carpetas para esta sesión.\nCrea una para guardar contratos o riders.'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Title Section */}
                <View className="mb-6">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                            {t('session_summary_label') || 'Resumen de la sesión'}
                        </Text>
                        {session.status && (
                            <View className={`px-3 py-1 rounded-full ${session.status === 'confirmed' ? 'bg-blue-100 dark:bg-blue-900/40' :
                                session.status === 'pending' ? 'bg-orange-100 dark:bg-orange-900/40' :
                                    'bg-red-100 dark:bg-red-900/40'
                                }`}>
                                <Text className={`text-xs font-bold ${session.status === 'confirmed' ? 'text-blue-700 dark:text-blue-400' :
                                    session.status === 'pending' ? 'text-orange-700 dark:text-orange-400' :
                                        'text-red-700 dark:text-red-400'
                                    }`}>
                                    {t(`status_${session.status}`) || session.status.toUpperCase()}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                        {session.title}
                    </Text>
                </View>

                {/* Poster Display */}
                {session.poster_url && (
                    <View className="mb-6 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm">
                        <Image
                            source={{ uri: session.poster_url }}
                            className="w-full aspect-[3/4]"
                            resizeMode="cover"
                        />
                    </View>
                )}

                {/* Earnings Section */}
                <View className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-6 flex-row items-center mb-6">
                    <View className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full items-center justify-center mr-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <Banknote size={22} color={isDark ? '#FFFFFF' : '#111827'} />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row justify-between items-start">
                            <View>
                                <Text className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
                                    {t('estimated_total_label') || 'Total estimado'}
                                </Text>
                                <Text className="text-2xl font-black text-gray-900 dark:text-white">
                                    {earnings.toFixed(2)} {session.currency || '€'}
                                </Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
                                    {t('payment_method') || 'Cálculo'}
                                </Text>
                                <Text className="text-xs font-bold text-gray-600 dark:text-gray-400">
                                    {session.earning_type === 'hourly' && t('calc_hourly', { amount: session.earning_amount, currency: session.currency, hours: duration.toFixed(1) })}
                                    {session.earning_type === 'fixed' && t('calc_fixed')}
                                    {session.earning_type === 'free' && t('calc_free')}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Venue Section */}
                <TouchableOpacity
                    onPress={() => {
                        if (session.venue_id) {
                            router.push(`/venue/${session.venue_id}`);
                        }
                    }}
                    disabled={!session.venue_id}
                    className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-6 flex-row items-center mb-6"
                    activeOpacity={session.venue_id ? 0.7 : 1}
                >
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
                    {session.venue_id && (
                        <ArrowRight size={20} color={isDark ? '#4B5563' : '#D1D5DB'} />
                    )}
                </TouchableOpacity>

                {/* Details Section */}
                <View className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-8">
                    <Text className="text-xl font-black text-gray-900 dark:text-white mb-10">
                        {t('session_detail_header') || 'Detalle de la sesión'}
                    </Text>

                    <View className="space-y-12">
                        <View className="flex-row justify-between items-center">
                            <Text className="text-base text-gray-500 dark:text-gray-400 font-medium">{t('date') || 'Fecha'}</Text>
                            <Text className="text-base text-gray-900 dark:text-white font-bold">{capitalizedDate}</Text>
                        </View>

                        <View className="flex-row justify-between items-center">
                            <Text className="text-base text-gray-500 dark:text-gray-400 font-medium">{t('time_label') || 'Horario'}</Text>
                            <Text className="text-base text-gray-900 dark:text-white font-bold">{session.start_time} — {session.end_time}</Text>
                        </View>

                        <View className="flex-row justify-between items-center">
                            <Text className="text-base text-gray-500 dark:text-gray-400 font-medium">{t('duration') || 'Duración'}</Text>
                            <Text className="text-base text-gray-900 dark:text-white font-bold">{duration.toFixed(1)} h</Text>
                        </View>

                        <View className="flex-row justify-between items-center">
                            <Text className="text-base text-gray-500 dark:text-gray-400 font-medium">
                                {t('djs_label') || 'DJs'}
                            </Text>
                            <Text className="text-base text-gray-900 dark:text-white font-bold text-right flex-1 ml-4" numberOfLines={2}>
                                {session.is_collective && session.djs && session.djs.length > 0
                                    ? (t('shared_with_prefix') || 'Junto a ') + session.djs.join(', ')
                                    : (t('solo_me') || 'Solo yo')}
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Color Modal */}
            <Modal
                visible={isColorModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsColorModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white dark:bg-gray-900 rounded-t-[40px] px-6 pt-8 pb-12">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-2xl font-black text-gray-900 dark:text-white">
                                {t('choose_color') || 'Elige un color'}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setIsColorModalVisible(false)}
                                className="w-10 h-10 items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full"
                            >
                                <X size={20} color={isDark ? '#F9FAFB' : '#111827'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View className="flex-row flex-wrap justify-between gap-y-4">
                                {[
                                    { color: '#262626', name: t('color_default') || 'Color predeterminado' },
                                    { color: '#EF4444', name: t('color_tomato') },
                                    { color: '#F97316', name: t('color_tangerine') },
                                    { color: '#FBBF24', name: t('color_banana') },
                                    { color: '#10B981', name: t('color_basil') },
                                    { color: '#34D399', name: t('color_sage') },
                                    { color: '#0EA5E9', name: t('color_peacock') },
                                    { color: '#3B82F6', name: t('color_blueberry') },
                                    { color: '#8B5CF6', name: t('color_lavender') },
                                    { color: '#9333EA', name: t('color_grape') },
                                    { color: '#F43F5E', name: t('color_flamingo') },
                                    { color: '#6B7280', name: t('color_graphite') },
                                ].map((item) => {
                                    const isSelected = (session.color || '#262626') === item.color;
                                    return (
                                        <TouchableOpacity
                                            key={item.color}
                                            activeOpacity={0.7}
                                            onPress={() => {
                                                Alert.alert(
                                                    t('apply_color_to_all_title') || '¿Actualizar sesiones?',
                                                    t('apply_color_to_all_message', { title: session.title }),
                                                    [
                                                        { text: t('cancel'), style: 'cancel' },
                                                        {
                                                            text: t('apply_only_this'),
                                                            onPress: () => {
                                                                updateColorMutation.mutate({ sessionId: id as string, color: item.color, updateAll: false });
                                                                setIsColorModalVisible(false);
                                                            }
                                                        },
                                                        {
                                                            text: t('apply_all_related', { title: session.title }),
                                                            onPress: () => {
                                                                updateColorMutation.mutate({ sessionId: id as string, color: item.color, updateAll: true });
                                                                setIsColorModalVisible(false);
                                                            }
                                                        }
                                                    ]
                                                );
                                            }}
                                            className={`w-[48%] flex-row items-center p-3 rounded-2xl border ${isSelected
                                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-800'
                                                }`}
                                        >
                                            <View className="w-5 h-5 rounded-full mr-3 border border-black/5" style={{ backgroundColor: item.color }} />
                                            <Text
                                                className={`text-sm flex-1 ${isSelected ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-900 dark:text-white font-medium'}`}
                                                numberOfLines={1}
                                            >
                                                {item.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
