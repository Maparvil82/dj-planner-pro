import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { Stack } from 'expo-router';
import { Avatar } from '../../src/components/ui/Avatar';
import { useAuthStore } from '../../src/store/useAuthStore';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { profileService } from '../../src/services/profile';
import { LogOut } from 'lucide-react-native';
import { cn } from '../../src/theme/tw';

export default function SettingsScreen() {
    const { t } = useTranslation();
    const { session, profile, signOut, setProfile } = useAuthStore();
    const [uploading, setUploading] = useState(false);

    const handlePickAvatar = async () => {
        // Request permissions
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permissionResult.granted === false) {
            Alert.alert(
                t('settings_title'),
                t('permissions_required'),
                [
                    { text: t('cancel', { defaultValue: 'Cancelar' }), style: 'cancel' },
                    { text: t('open_settings', { defaultValue: 'Abrir Configuración' }), onPress: () => Linking.openSettings() }
                ]
            );
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1, // Will be compressed by ImageManipulator in Service
        });

        if (!result.canceled && result.assets[0] && session?.user?.id) {
            setUploading(true);
            const uri = result.assets[0].uri;

            const newAvatarUrl = await profileService.uploadAvatar(session.user.id, uri);

            if (newAvatarUrl) {
                setProfile({
                    id: session.user.id,
                    avatar_url: newAvatarUrl,
                    updated_at: new Date().toISOString()
                });
                Alert.alert(t('settings_title'), t('avatar_upload_success'));
            } else {
                Alert.alert("Error", "There was an issue uploading the avatar.");
            }
            setUploading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['bottom', 'left', 'right']}>
            {/* Header */}
            <View className="px-6 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 justify-center">
                <View className="flex-row items-center justify-center h-10">
                    <View className="absolute left-0 right-0 items-center justify-center">
                        <Text className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
                            {t('settings_title')}
                        </Text>
                    </View>
                </View>
            </View>

            <View className="flex-1 px-4 py-8">
                {/* Profile Card */}
                <View className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-sm shadow-black/5 border border-gray-100 dark:border-gray-800 items-center mb-8">
                    <View className="relative mb-6">
                        <Avatar
                            url={profile?.avatar_url}
                            name={session?.user?.email}
                            size="lg"
                        />
                        {uploading && (
                            <View className="absolute inset-0 bg-black/40 rounded-full items-center justify-center">
                                <ActivityIndicator color="white" />
                            </View>
                        )}
                    </View>

                    <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                        {session?.user?.email?.split('@')[0]}
                    </Text>
                    <Text className="text-base text-gray-500 dark:text-gray-400 mb-8">
                        {session?.user?.email}
                    </Text>

                    <TouchableOpacity
                        className={cn(
                            "bg-blue-600 px-8 py-3.5 rounded-full flex-row items-center",
                            uploading && "opacity-50"
                        )}
                        onPress={handlePickAvatar}
                        disabled={uploading}
                    >
                        <Text className="text-white font-bold text-lg">
                            {t('change_avatar')}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Global Actions */}
                <TouchableOpacity
                    className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl flex-row items-center justify-center border border-red-100 dark:border-red-900/50"
                    onPress={() => signOut()}
                >
                    {/* @ts-ignore */}
                    <LogOut size={20} color="#EF4444" className="mr-2" />
                    <Text className="text-red-500 dark:text-red-400 font-bold text-lg">
                        {t('log_out')}
                    </Text>
                </TouchableOpacity>

            </View>
        </SafeAreaView>
    );
}
