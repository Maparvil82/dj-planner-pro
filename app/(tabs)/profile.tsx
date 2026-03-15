import { View, Text, TouchableOpacity, Alert, ActivityIndicator, TextInput, ScrollView, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { Stack, useRouter } from 'expo-router';
import { Avatar } from '../../src/components/ui/Avatar';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTheme } from '../../src/contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useState, useEffect } from 'react';
import { profileService, UserProfile } from '../../src/services/profile';
import { LogOut, ChevronRight, Globe, Moon, Sun, ShieldCheck, Star, Trash2, Info, Monitor, Camera } from 'lucide-react-native';
import { cn } from '../../src/theme/tw';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export default function SettingsScreen() {
    const { t, currentLanguage } = useTranslation();
    const { theme, setTheme, activeTheme } = useTheme();
    const { session, profile, signOut, setProfile } = useAuthStore();
    const router = useRouter();

    const [uploading, setUploading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [artistName, setArtistName] = useState(profile?.artist_name || '');

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
                    ...profile,
                    id: session.user.id,
                    avatar_url: newAvatarUrl,
                    updated_at: new Date().toISOString()
                } as UserProfile);
                Alert.alert(t('settings_title'), t('avatar_upload_success'));
            } else {
                Alert.alert("Error", "There was an issue uploading the avatar.");
            }
            setUploading(false);
        }
    };

    const handleUpdateProfile = async () => {
        if (!session?.user?.id) return;

        const updated = await profileService.updateProfile(session.user.id, {
            artist_name: artistName.trim()
        });

        if (updated) {
            setProfile(updated);
            setEditing(false);
            Alert.alert(t('success'), t('avatar_upload_success'));
        } else {
            Alert.alert(t('error'), t('error_saving_session'));
        }
    };

    const handleRateApp = async () => {
        const ITUNES_ID = '6444444444'; // PLACEHOLDER: Replace with real Apple ID
        const PACKAGE_NAME = 'com.djplannerpro.app';

        const url = Platform.select({
            ios: `itms-apps://itunes.apple.com/app/id${ITUNES_ID}?action=write-review`,
            android: `market://details?id=${PACKAGE_NAME}`,
            default: `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`
        });

        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            // Fallback to web URLs
            const webUrl = Platform.OS === 'ios'
                ? `https://apps.apple.com/app/id${ITUNES_ID}`
                : `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`;
            await Linking.openURL(webUrl);
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            t('confirm_delete_account'),
            t('delete_account_warning'),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('delete_permanently'),
                    style: 'destructive',
                    onPress: async () => {
                        if (session?.user?.id) {
                            const success = await profileService.deleteAccount(session.user.id);
                            if (success) {
                                Alert.alert(t('success'), t('delete_account_success') || "Account deleted.");
                                signOut();
                            } else {
                                Alert.alert(t('error'), t('error_saving_session'));
                            }
                        }
                    }
                }
            ]
        );
    };

    const SettingItem = ({ icon: Icon, label, value, onPress, children, last }: any) => (
        <TouchableOpacity
            onPress={onPress}
            disabled={!onPress}
            className={cn(
                "flex-row items-center py-4",
                !last && "border-b border-gray-50 dark:border-gray-800"
            )}
        >
            <View className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 items-center justify-center mr-4">
                <Icon size={20} color={activeTheme === 'dark' ? '#9CA3AF' : '#6B7280'} />
            </View>
            <View className="flex-1">
                <Text className="text-gray-900 dark:text-white font-medium text-base">{label}</Text>
                {value && <Text className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{value}</Text>}
            </View>
            {children || <ChevronRight size={20} color="#D1D5DB" />}
        </TouchableOpacity>
    );

    const SectionHeader = ({ title }: { title: string }) => (
        <Text className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 mt-8 ml-2">
            {title}
        </Text>
    );

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top', 'bottom', 'left', 'right']}>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                <View className="max-w-3xl w-full mx-auto px-4 pt-6">
                    {/* Profile Card */}
                    <View className="bg-white dark:bg-gray-800/50 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 items-center mb-6">
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
                            {!editing && (
                                <TouchableOpacity
                                    className="absolute bottom-0 right-0 bg-blue-600 w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 items-center justify-center"
                                    onPress={handlePickAvatar}
                                >
                                    <Camera size={14} color="white" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {editing ? (
                            <View className="w-full mb-4">
                                <TextInput
                                    value={artistName}
                                    onChangeText={setArtistName}
                                    placeholder={t('artist_name_placeholder')}
                                    placeholderTextColor="#9CA3AF"
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-center text-lg font-bold text-gray-900 dark:text-white"
                                    autoFocus
                                />
                            </View>
                        ) : (
                            <View className="items-center">
                                <Text className="text-2xl font-black text-gray-900 dark:text-white mb-1">
                                    {profile?.artist_name || session?.user?.email?.split('@')[0]}
                                </Text>
                                <Text className="text-base font-medium text-gray-500 dark:text-gray-400">
                                    {session?.user?.email}
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            className={cn(
                                "mt-6 px-10 py-3 rounded-2xl",
                                editing ? "bg-blue-600" : "bg-gray-100 dark:bg-gray-800"
                            )}
                            onPress={editing ? handleUpdateProfile : () => setEditing(true)}
                        >
                            <Text className={cn(
                                "font-bold",
                                editing ? "text-white" : "text-gray-900 dark:text-white"
                            )}>
                                {editing ? t('save_changes') : t('edit_profile')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* APP SETTINGS */}
                    <SectionHeader title={t('settings_app_section')} />
                    <View className="bg-white dark:bg-gray-800/50 rounded-3xl px-5 border border-gray-100 dark:border-gray-800">

                        <SettingItem
                            icon={theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor}
                            label={t('appearance')}
                            value={t(`theme_${theme}`)}
                            onPress={() => {
                                Alert.alert(
                                    t('appearance'),
                                    t('appearance'),
                                    [
                                        { text: t('theme_light'), onPress: () => setTheme('light') },
                                        { text: t('theme_dark'), onPress: () => setTheme('dark') },
                                        { text: t('theme_system'), onPress: () => setTheme('system') },
                                        { text: t('cancel'), style: 'cancel' }
                                    ]
                                );
                            }}
                        />
                        <SettingItem
                            icon={Star}
                            label={t('rate_app')}
                            onPress={handleRateApp}
                            last
                        />
                    </View>

                    {/* LEGAL */}
                    <SectionHeader title={t('settings_legal_section')} />
                    <View className="bg-white dark:bg-gray-800/50 rounded-3xl px-5 border border-gray-100 dark:border-gray-800">
                        <SettingItem
                            icon={ShieldCheck}
                            label={t('privacy_policy')}
                            onPress={() => Linking.openURL(t('privacy_policy_url'))}
                        />
                        <SettingItem
                            icon={Info}
                            label={t('terms_of_use')}
                            onPress={() => Linking.openURL(t('terms_of_use_url'))}
                            last
                        />
                    </View>

                    {/* ACCOUNT */}
                    <SectionHeader title={t('settings_account_section')} />
                    <View className="bg-white dark:bg-gray-800/50 rounded-3xl px-5 border border-gray-100 dark:border-gray-800">
                        <SettingItem
                            icon={LogOut}
                            label={t('log_out')}
                            onPress={() => signOut()}
                        />
                        <SettingItem
                            icon={Trash2}
                            label={t('delete_account')}
                            onPress={handleDeleteAccount}
                            last
                        >
                            <Text className="text-red-500 font-medium">{t('delete_account')}</Text>
                        </SettingItem>
                    </View>

                    {/* VERSION */}
                    <View className="mt-8 mb-4 items-center">
                        <Text className="text-gray-400 dark:text-gray-600 text-xs">
                            {t('version')} 1.2.0 • Build 2534
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
