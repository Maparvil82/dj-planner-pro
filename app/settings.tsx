import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../src/i18n/useTranslation';
import { Stack } from 'expo-router';
import { Avatar } from '../src/components/ui/Avatar';
import { useAuthStore } from '../src/store/useAuthStore';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { profileService } from '../src/services/profile';
import { LogOut } from 'lucide-react-native';
import { cn } from '../src/theme/tw';

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
            <Stack.Screen options={{
                headerShown: true,
                title: t('settings_title'),
                headerBackTitle: t('home'),
                headerStyle: { backgroundColor: 'transparent' },
                headerShadowVisible: false,
                headerTintColor: '#3b82f6' // blue-500
            }} />

            <View className="flex-1 px-4 py-6">

                {/* Profile Card */}
                <View className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm shadow-black/5 border border-gray-100 dark:border-gray-800 items-center mb-8">
                    <View className="relative mb-4">
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

                    <Text className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        {session?.user?.email}
                    </Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        {t('session_status', { status: t('logged_in') })}
                    </Text>

                    <TouchableOpacity
                        className={cn(
                            "bg-blue-50 dark:bg-blue-900/30 px-6 py-3 rounded-full flex-row items-center",
                            uploading && "opacity-50"
                        )}
                        onPress={handlePickAvatar}
                        disabled={uploading}
                    >
                        <Text className="text-blue-600 dark:text-blue-400 font-bold">
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
