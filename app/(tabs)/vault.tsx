import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
    TextInput,
    Alert,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import {
    useVaultFoldersQuery,
    useCreateFolderMutation,
    useDeleteFolderMutation
} from '../../src/hooks/useVaultQuery';
import { useAuthStore } from '../../src/store/useAuthStore';
import {
    Folder,
    Plus,
    MoreVertical,
    ChevronRight,
    FileText,
    Shield,
    Search,
    X,
    FolderPlus
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function VaultScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';
    const { session } = useAuthStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const { data: folders = [], isLoading } = useVaultFoldersQuery();
    const createFolderMutation = useCreateFolderMutation();
    const deleteFolderMutation = useDeleteFolderMutation();

    const filteredFolders = folders.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        try {
            await createFolderMutation.mutateAsync({ name: newFolderName.trim() });
            setNewFolderName('');
            setIsCreateModalVisible(false);
        } catch (error) {
            Alert.alert(t('error'), t('error_creating_folder') || 'Error al crear la carpeta');
        }
    };

    const handleDeleteFolder = (id: string, name: string) => {
        Alert.alert(
            t('delete_folder_title') || 'Eliminar Carpeta',
            t('delete_folder_message', { name }) || `¿Estás seguro de que quieres eliminar "${name}" y todo su contenido?`,
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('delete'),
                    style: 'destructive',
                    onPress: () => deleteFolderMutation.mutate(id)
                }
            ]
        );
    };

    if (isLoading) {
        return (
            <View className="flex-1 bg-white dark:bg-gray-950 items-center justify-center">
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-950" edges={['top']}>
            {/* HEADER */}
            <View className="px-6 pt-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                <View className="flex-row items-center justify-between mb-4">
                    <View>
                        <Text className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                            {t('vault_title')}
                        </Text>
                        <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-widest">
                            {t('secure_storage')}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setIsCreateModalVisible(true)}
                        className="w-10 h-10 rounded-full bg-blue-600 items-center justify-center shadow-lg shadow-blue-500/30"
                    >
                        <Plus size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                {/* SEARCH BAR */}
                <View className="flex-row items-center bg-gray-100 dark:bg-gray-900 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-800">
                    <Search size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    <TextInput
                        placeholder={t('search_vault')}
                        placeholderTextColor={isDark ? '#4B5563' : '#9CA3AF'}
                        className="flex-1 ml-3 text-sm font-medium text-gray-900 dark:text-white"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            <ScrollView
                className="flex-1 px-5"
                contentContainerStyle={{ paddingTop: 20, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {filteredFolders.length > 0 ? (
                    <View className="flex-row flex-wrap justify-between">
                        {filteredFolders.map((folder) => (
                            <TouchableOpacity
                                key={folder.id}
                                activeOpacity={0.7}
                                onPress={() => router.push(`/vault/${folder.id}?name=${encodeURIComponent(folder.name)}` as any)}
                                onLongPress={() => handleDeleteFolder(folder.id, folder.name)}
                                style={{ width: (width - 52) / 2 }}
                                className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-2xl mb-4 shadow-sm shadow-black/5"
                            >
                                <View className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 items-center justify-center mb-3">
                                    <Folder size={24} color="#2563EB" fill="#2563EB" fillOpacity={0.2} />
                                </View>
                                <Text className="text-base font-bold text-gray-900 dark:text-white" numberOfLines={1}>
                                    {folder.name}
                                </Text>
                                <View className="flex-row items-center mt-1">
                                    <Text className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">
                                        {folder.associated_type === 'general' ? t('general') : (folder.associated_type === 'session' ? t('session') : t('venue'))}
                                    </Text>
                                    <View className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700 mx-2" />
                                    <ChevronRight size={10} color={isDark ? '#4B5563' : '#9CA3AF'} />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <View className="flex-1 items-center justify-center pt-20">
                        <View className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-900 items-center justify-center mb-6">
                            <Shield size={40} color={isDark ? '#4B5563' : '#D1D5DB'} />
                        </View>
                        <Text className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
                            {searchQuery ? t('no_search_results') : (t('vault_empty_title') || 'Tu Vault está vacío')}
                        </Text>
                        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center px-10">
                            {searchQuery ? t('try_another_search') : (t('vault_empty_desc') || 'Crea carpetas para organizar tus contratos, riders y documentos importantes asociados a tus sesiones.')}
                        </Text>
                        {!searchQuery && (
                            <TouchableOpacity
                                onPress={() => setIsCreateModalVisible(true)}
                                className="mt-8 px-6 py-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30"
                            >
                                <Text className="text-white font-bold">{t('create_first_folder') || 'Crear mi primera carpeta'}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* CREATE FOLDER MODAL */}
            <Modal
                visible={isCreateModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsCreateModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/60 px-6">
                    <View className="bg-white dark:bg-gray-900 w-full rounded-3xl p-6 shadow-2xl">
                        <View className="flex-row items-center justify-between mb-6">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 items-center justify-center mr-3">
                                    <FolderPlus size={20} color="#2563EB" />
                                </View>
                                <Text className="text-xl font-bold text-gray-900 dark:text-white">
                                    {t('new_folder') || 'Nueva Carpeta'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsCreateModalVisible(false)}>
                                <X size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                            </TouchableOpacity>
                        </View>

                        <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 ml-1">
                            {t('folder_name_label') || 'NOMBRE DE LA CARPETA'}
                        </Text>
                        <TextInput
                            className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-4 text-gray-900 dark:text-white font-medium mb-6"
                            placeholder={t('folder_name_placeholder') || 'Ejem: Contratos, Riders 2024...'}
                            placeholderTextColor={isDark ? '#4B5563' : '#9CA3AF'}
                            value={newFolderName}
                            onChangeText={setNewFolderName}
                            autoFocus
                        />

                        <TouchableOpacity
                            onPress={handleCreateFolder}
                            disabled={!newFolderName.trim() || createFolderMutation.isPending}
                            className={`py-4 rounded-xl items-center shadow-lg ${!newFolderName.trim() || createFolderMutation.isPending ? 'bg-gray-300 dark:bg-gray-800 shadow-none' : 'bg-blue-600 shadow-blue-500/30'}`}
                        >
                            {createFolderMutation.isPending ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text className="text-white font-bold text-lg">
                                    {t('create_folder_action') || 'Crear Carpeta'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
