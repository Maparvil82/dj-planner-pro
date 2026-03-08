import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
    Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from '../../src/i18n/useTranslation';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import {
    useVaultFilesQuery,
    useUploadFileMutation,
    useDeleteFileMutation
} from '../../src/hooks/useVaultQuery';
import { VaultFile } from '../../src/types/session';
import { vaultService } from '../../src/services/vault';
import {
    File,
    FileText,
    Image as ImageIcon,
    Plus,
    ChevronLeft,
    Trash2,
    Download,
    ExternalLink,
    FileMinus,
    Share2
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { decode } from 'base64-arraybuffer';

const { width } = Dimensions.get('window');

export default function FolderDetailScreen() {
    const { id, name } = useLocalSearchParams<{ id: string, name: string }>();
    const { t } = useTranslation();
    const router = useRouter();
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';

    const { data: files = [], isLoading } = useVaultFilesQuery(id as string);
    const uploadFileMutation = useUploadFileMutation();
    const deleteFileMutation = useDeleteFileMutation();

    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            const file = result.assets[0];
            // Using a more modern way to read files if readAsStringAsync / legacy is problematic
            // SDK 54+ recommends using the new File API or just readAsStringAsync from the main entry if legacy is failing
            const base64 = await FileSystem.readAsStringAsync(file.uri, {
                encoding: 'base64' as any,
            });

            await uploadFileMutation.mutateAsync({
                folderId: id as string,
                name: file.name,
                fileData: decode(base64),
                contentType: file.mimeType || 'application/octet-stream',
                size: file.size || 0
            });
        } catch (error) {
            console.error('File pick error:', error);
            Alert.alert(t('error'), t('error_uploading_file') || 'Error al subir el archivo');
        }
    };

    const handleDeleteFile = (fileId: string, filePath: string, fileName: string) => {
        Alert.alert(
            t('delete_file_title') || 'Eliminar Archivo',
            t('delete_file_message', { name: fileName }) || `¿Estás seguro de que quieres eliminar "${fileName}"?`,
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('delete'),
                    style: 'destructive',
                    onPress: () => deleteFileMutation.mutate(
                        { fileId, filePath, folderId: id as string },
                        {
                            onError: (error: any) => {
                                Alert.alert(t('error'), t('error_deleting_file') || 'No se pudo eliminar el archivo.');
                            }
                        }
                    )
                }
            ]
        );
    };

    const handleOpenFile = async (file: VaultFile) => {
        try {
            const signedUrl = await vaultService.getSignedUrl(file.path, file.url);
            await Linking.openURL(signedUrl);
        } catch (error) {
            console.error('Open file error:', error);
            Alert.alert(t('error'), t('error_opening_file') || 'No se pudo abrir el archivo');
        }
    };

    const handleShareFile = async (file: VaultFile) => {
        try {
            const signedUrl = await vaultService.getSignedUrl(file.path, file.url);
            const tempUri = FileSystem.cacheDirectory + file.name;
            const downloadResult = await FileSystem.downloadAsync(signedUrl, tempUri);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(downloadResult.uri);
            } else {
                Alert.alert(t('error'), t('sharing_not_available') || 'La opción de compartir no está disponible en este dispositivo');
            }
        } catch (error) {
            console.error('Sharing error:', error);
            Alert.alert(t('error'), t('error_sharing_file') || 'Error al compartir el archivo');
        }
    };

    const getFileIcon = (mimeType: string | null | undefined) => {
        if (!mimeType) return <File size={24} color="#6B7280" />;
        if (mimeType.startsWith('image/')) return <ImageIcon size={24} color="#3B82F6" />;
        if (mimeType.includes('pdf')) return <FileText size={24} color="#EF4444" />;
        return <File size={24} color="#6B7280" />;
    };

    const formatSize = (bytes: number | null | undefined) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
            <View className="px-6 pt-4 pb-4 border-b border-gray-100 dark:border-gray-800 flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-900 items-center justify-center mr-3"
                    >
                        <ChevronLeft size={24} color={isDark ? '#FFFFFF' : '#111827'} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className="text-xl font-bold text-gray-900 dark:text-white" numberOfLines={1}>
                            {name}
                        </Text>
                        <Text className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                            {files.length} {files.length === 1 ? t('file') : t('files')}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    onPress={handlePickFile}
                    className="w-10 h-10 rounded-full bg-blue-600 items-center justify-center shadow-lg shadow-blue-500/30"
                >
                    <Plus size={24} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            <ScrollView
                className="flex-1 px-5"
                contentContainerStyle={{ paddingTop: 20, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {files.length > 0 ? (
                    <View className="gap-3">
                        {files.map((file) => (
                            <View
                                key={file.id}
                                className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-2xl flex-row items-center shadow-sm shadow-black/5"
                            >
                                <View className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800 items-center justify-center mr-4">
                                    {getFileIcon(file.file_type)}
                                </View>
                                <View className="flex-1 mr-2">
                                    <Text className="text-sm font-bold text-gray-900 dark:text-white" numberOfLines={1}>
                                        {file.name}
                                    </Text>
                                    <Text className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-1">
                                        {formatSize(file.size)} • {new Date(file.created_at).toLocaleDateString()}
                                    </Text>
                                </View>
                                <View className="flex-row items-center gap-2">
                                    <TouchableOpacity
                                        onPress={() => handleOpenFile(file)}
                                        className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 items-center justify-center"
                                    >
                                        <ExternalLink size={16} color="#2563EB" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleShareFile(file)}
                                        className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 items-center justify-center"
                                    >
                                        <Share2 size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteFile(file.id, file.path || file.url, file.name)}
                                        className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 items-center justify-center"
                                    >
                                        <Trash2 size={16} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View className="flex-1 items-center justify-center pt-20">
                        <View className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-900 items-center justify-center mb-6">
                            <FileMinus size={40} color={isDark ? '#4B5563' : '#D1D5DB'} />
                        </View>
                        <Text className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">
                            {t('folder_empty_title') || 'Esta carpeta está vacía'}
                        </Text>
                        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center px-10">
                            {t('folder_empty_desc') || 'Añade documentos, imágenes o archivos importantes pulsando el botón +.'}
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* UPLOADING OVERLAY */}
            {uploadFileMutation.isPending && (
                <View className="absolute inset-0 bg-black/40 items-center justify-center z-50">
                    <View className="bg-white dark:bg-gray-900 p-6 rounded-2xl items-center shadow-xl">
                        <ActivityIndicator size="large" color="#2563EB" />
                        <Text className="text-gray-900 dark:text-white font-bold mt-4">
                            {t('uploading_file') || 'Subiendo archivo...'}
                        </Text>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}
