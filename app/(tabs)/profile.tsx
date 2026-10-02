import { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    TextInput,
    ScrollView,
    Switch,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Redirect,
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import {
    Pencil,
    Camera,
    Eye,
    LogOut,
    ChevronRight,
    Moon,
    Sun,
    ShieldCheck,
    Star,
    Trash2,
    Info,
    Monitor,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTranslation } from '../../src/i18n/useTranslation';
import { Avatar } from '../../src/components/ui/Avatar';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { SessionFormSection } from '../../src/components/sessions/SessionFormLayout';
import {
    CommunityButton,
    CommunityMessage,
    useCommunityColors,
} from '../../src/components/community/CommunityUI';
import {
    useCommunityMutation,
    useCommunityProfile,
} from '../../src/hooks/useCommunityQuery';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTheme } from '../../src/contexts/ThemeContext';
import { profileService } from '../../src/services/profile';
import { supabase } from '../../src/lib/supabase';

function SettingItem({
    icon: Icon,
    label,
    value,
    onPress,
    destructive = false,
}: {
    icon: LucideIcon;
    label: string;
    value?: string;
    onPress: () => void;
    destructive?: boolean;
}) {
    const c = useCommunityColors();
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={onPress}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
            }}
        >
            <View
                style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: c.field,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Icon size={19} color={destructive ? '#d76f7d' : c.accent} />
            </View>
            <View style={{ flex: 1 }}>
                <Text
                    style={{
                        color: destructive ? '#d76f7d' : c.fg,
                        fontSize: 14,
                        fontWeight: '600',
                    }}
                >
                    {label}
                </Text>
                {!!value && (
                    <Text
                        style={{ color: c.muted, fontSize: 12, marginTop: 4 }}
                    >
                        {value}
                    </Text>
                )}
            </View>
            <ChevronRight size={17} color={c.muted} />
        </TouchableOpacity>
    );
}
export default function ProfileScreen() {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const { theme, setTheme } = useTheme();
    const { session, profile, signOut, setProfile } = useAuthStore();
    const userId = session?.user.id;
    const router = useRouter();
    const params = useLocalSearchParams<{ edit?: string }>();
    const client = useQueryClient();
    const social = useCommunityProfile(userId);
    const mutation = useCommunityMutation();
    const account = useQuery({
        queryKey: ['account-profile', userId],
        enabled: !!userId,
        queryFn: async () => {
            const result = await profileService.getProfile(userId!);
            if (!result) throw new Error('Profile unavailable');
            return result;
        },
    });
    const [editing, setEditing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [notice, setNotice] = useState('');
    const [artistName, setArtistName] = useState(profile?.artist_name || '');
    const [city, setCity] = useState('');
    const [genres, setGenres] = useState('');
    const [bio, setBio] = useState('');
    const [visible, setVisible] = useState(false);
    const [email, setEmail] = useState(session?.user.email || '');
    const [password, setPassword] = useState('');
    const busy = saving || uploading;
    const ready =
        !account.isPending &&
        !social.isPending &&
        !account.isError &&
        !social.isError;
    const resetDraft = useCallback(() => {
        setArtistName(
            account.data?.artist_name ||
                profile?.artist_name ||
                social.data?.artist_name ||
                '',
        );
        setCity(social.data?.city || '');
        setGenres(social.data?.genres || '');
        setBio(social.data?.bio || '');
        setVisible(social.data?.is_visible || false);
        setEmail(session?.user.email || '');
        setPassword('');
    }, [account.data, profile?.artist_name, social.data, session?.user.email]);
    useEffect(() => {
        if (account.data) setProfile(account.data);
    }, [account.data, setProfile]);
    useEffect(() => {
        if (!editing) resetDraft();
    }, [editing, resetDraft]);
    useEffect(() => {
        if (params.edit === '1' && ready) {
            setEditing(true);
            router.setParams({ edit: undefined });
        }
    }, [params.edit, ready]);
    useFocusEffect(
        useCallback(() => {
            void account.refetch();
            void social.refetch();
        }, [account.refetch, social.refetch]),
    );
    const handleUpdateProfile = async () => {
        if (!userId || !artistName.trim() || busy) return;
        setSaving(true);
        setSaveError('');
        setNotice('');
        try {
            await mutation.mutateAsync({
                kind: 'profile',
                input: {
                    artist_name: artistName.trim(),
                    avatar_url: profile?.avatar_url || null,
                    city: city.trim(),
                    genres: genres.trim(),
                    bio: bio.trim(),
                    is_visible: visible,
                },
            });
            const authUpdates: { email?: string; password?: string } = {};
            if (email.trim() && email.trim() !== session?.user.email)
                authUpdates.email = email.trim();
            if (password) authUpdates.password = password;
            if (Object.keys(authUpdates).length) {
                const { error } = await supabase.auth.updateUser(authUpdates);
                if (error) throw error;
                if (authUpdates.email) setNotice(t('unifiedProfile.emailSent'));
            }
            setEditing(false);
            setPassword('');
        } catch (error) {
            setSaveError(
                error instanceof Error
                    ? error.message
                    : t('community.saveError'),
            );
        } finally {
            setSaving(false);
        }
    };
    const handlePickAvatar = async () => {
        if (!userId || busy) return;
        const permission =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert(t('settings_title'), t('permissions_required'), [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('open_settings'),
                    onPress: () => Linking.openSettings(),
                },
            ]);
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });
        if (result.canceled || !result.assets[0]) return;
        setUploading(true);
        setSaveError('');
        try {
            const avatar = await profileService.uploadAvatar(
                userId,
                result.assets[0].uri,
            );
            if (!avatar) throw new Error(t('error_uploading'));
            setProfile({
                id: userId,
                artist_name: profile?.artist_name || null,
                avatar_url: avatar,
                updated_at: new Date().toISOString(),
            });
            await Promise.all([
                client.invalidateQueries({
                    queryKey: ['account-profile', userId],
                }),
                client.invalidateQueries({ queryKey: ['community'] }),
            ]);
        } catch {
            setSaveError(t('error_uploading'));
        } finally {
            setUploading(false);
        }
    };
    const handleRateApp = async () => {
        const ITUNES_ID = '6444444444'; // PLACEHOLDER: Replace with real Apple ID
        const PACKAGE_NAME = 'com.djplannerpro.app';

        const url = Platform.select({
            ios: `itms-apps://itunes.apple.com/app/id${ITUNES_ID}?action=write-review`,
            android: `market://details?id=${PACKAGE_NAME}`,
            default: `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`,
        });

        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            // Fallback to web URLs
            const webUrl =
                Platform.OS === 'ios'
                    ? `https://apps.apple.com/app/id${ITUNES_ID}`
                    : `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`;
            await Linking.openURL(webUrl);
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(t('confirm_delete_account'), t('delete_account_warning'), [
            { text: t('cancel'), style: 'cancel' },
            {
                text: t('delete_permanently'),
                style: 'destructive',
                onPress: async () => {
                    if (session?.user?.id) {
                        const success = await profileService.deleteAccount(
                            session.user.id,
                        );
                        if (success) {
                            Alert.alert(
                                t('success'),
                                t('delete_account_success') ||
                                    'Account deleted.',
                            );
                            signOut();
                        } else {
                            Alert.alert(t('error'), t('error_saving_session'));
                        }
                    }
                },
            },
        ]);
    };

    const field = (
        label: string,
        value: string,
        onChange: (value: string) => void,
        max: number,
        multiline = false,
    ) => (
        <View style={{ gap: 8 }}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>
                {label}
            </Text>
            <TextInput
                accessibilityLabel={label}
                value={value}
                onChangeText={onChange}
                maxLength={max}
                multiline={multiline}
                textAlignVertical={multiline ? 'top' : 'center'}
                style={{
                    minHeight: multiline ? 120 : 48,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: c.field,
                    padding: 14,
                    color: c.fg,
                    fontSize: 15,
                }}
            />
        </View>
    );
    if (!session) return <Redirect href="/(auth)/login" />;
    return (
        <SafeAreaView
            edges={['top']}
            style={{ flex: 1, backgroundColor: c.bg }}
        >
            <PageHeader
                title={t('unifiedProfile.title')}
                subtitle={t('unifiedProfile.intro')}
                action={
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={t('edit_profile')}
                        disabled={!ready || busy || editing}
                        onPress={() => {
                            setEditing(true);
                            setSaveError('');
                        }}
                        style={{
                            width: 46,
                            height: 46,
                            borderRadius: 16,
                            backgroundColor: c.tint,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: !ready || busy || editing ? 0.5 : 1,
                        }}
                    >
                        <Pencil size={21} color={c.accent} />
                    </TouchableOpacity>
                }
            />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{
                        paddingHorizontal: 20,
                        paddingBottom: 32,
                    }}
                >
                    <View
                        style={{
                            maxWidth: 900,
                            width: '100%',
                            alignSelf: 'center',
                            gap: 16,
                        }}
                    >
                        {(account.isError || social.isError) && (
                            <CommunityMessage
                                title={t('community.error')}
                                retry={() => {
                                    void account.refetch();
                                    void social.refetch();
                                }}
                            />
                        )}
                        {!ready && !account.isError && !social.isError && (
                            <CommunityMessage
                                title={t('community.loading')}
                                loading
                            />
                        )}
                        <SessionFormSection
                            title={t('unifiedProfile.identity')}
                            kind="participants"
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 16,
                                }}
                            >
                                <View>
                                    <Avatar
                                        url={profile?.avatar_url}
                                        name={
                                            editing
                                                ? artistName
                                                : profile?.artist_name
                                        }
                                        size="lg"
                                    />
                                    {uploading ? (
                                        <ActivityIndicator
                                            style={{
                                                position: 'absolute',
                                                top: 20,
                                                left: 20,
                                            }}
                                            color={c.accent}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            accessibilityRole="button"
                                            accessibilityLabel={t(
                                                'unifiedProfile.changePhoto',
                                            )}
                                            disabled={busy || !ready}
                                            onPress={handlePickAvatar}
                                            style={{
                                                position: 'absolute',
                                                right: -5,
                                                bottom: -4,
                                                width: 30,
                                                height: 30,
                                                borderRadius: 11,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: '#6554df',
                                            }}
                                        >
                                            <Camera size={15} color="#fff" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <View style={{ flex: 1, gap: 5 }}>
                                    <Text
                                        style={{
                                            color: c.fg,
                                            fontSize: 23,
                                            fontWeight: '800',
                                        }}
                                    >
                                        {editing
                                            ? artistName || t('artist_name')
                                            : profile?.artist_name ||
                                              t('artist_name')}
                                    </Text>
                                    {!!city && (
                                        <Text
                                            style={{
                                                color: c.muted,
                                                fontSize: 13,
                                            }}
                                        >
                                            {city}
                                        </Text>
                                    )}
                                    <Text
                                        style={{
                                            color: c.accent,
                                            fontSize: 12,
                                        }}
                                    >
                                        {t(
                                            visible
                                                ? 'unifiedProfile.public'
                                                : 'unifiedProfile.private',
                                        )}
                                    </Text>
                                </View>
                            </View>
                            {editing ? (
                                <>
                                    {field(
                                        t('artist_name'),
                                        artistName,
                                        setArtistName,
                                        80,
                                    )}
                                    {field(t('venue_city'), city, setCity, 100)}
                                    {field(
                                        t('community.genres'),
                                        genres,
                                        setGenres,
                                        120,
                                    )}
                                    {field(
                                        t('community.bio'),
                                        bio,
                                        setBio,
                                        500,
                                        true,
                                    )}
                                </>
                            ) : (
                                <>
                                    {!!genres && (
                                        <Text
                                            style={{
                                                color: c.accent,
                                                fontSize: 13,
                                            }}
                                        >
                                            {genres}
                                        </Text>
                                    )}
                                    {!!bio && (
                                        <Text
                                            style={{
                                                color: c.muted,
                                                lineHeight: 21,
                                                fontSize: 14,
                                            }}
                                        >
                                            {bio}
                                        </Text>
                                    )}
                                    <CommunityButton
                                        label={t('edit_profile')}
                                        secondary
                                        onPress={() => {
                                            setEditing(true);
                                            setSaveError('');
                                        }}
                                        disabled={!ready || busy}
                                    />
                                </>
                            )}
                        </SessionFormSection>
                        <SessionFormSection
                            title={t('community.title')}
                            kind="participants"
                        >
                            {editing ? (
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 12,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: c.fg,
                                            flex: 1,
                                            fontSize: 14,
                                            fontWeight: '600',
                                        }}
                                    >
                                        {t('community.visible')}
                                    </Text>
                                    <Switch
                                        accessibilityLabel={t(
                                            'community.visible',
                                        )}
                                        value={visible}
                                        onValueChange={setVisible}
                                        trackColor={{
                                            false: c.border,
                                            true: '#6554df',
                                        }}
                                    />
                                </View>
                            ) : (
                                <Text
                                    style={{
                                        color: c.fg,
                                        fontWeight: '600',
                                        fontSize: 14,
                                    }}
                                >
                                    {t(
                                        visible
                                            ? 'unifiedProfile.public'
                                            : 'unifiedProfile.private',
                                    )}
                                </Text>
                            )}
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 12,
                                    lineHeight: 19,
                                }}
                            >
                                {t('community.visibilityHint')}
                            </Text>
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 12,
                                    lineHeight: 19,
                                }}
                            >
                                {t('community.privacyHint')}
                            </Text>
                            {!editing && social.data?.is_visible && (
                                <CommunityButton
                                    label={t('unifiedProfile.preview')}
                                    secondary
                                    onPress={() =>
                                        router.push(
                                            `/community/${userId}?preview=1`,
                                        )
                                    }
                                />
                            )}
                            {!editing && !social.data?.is_visible && (
                                <CommunityButton
                                    label={t('unifiedProfile.activate')}
                                    secondary
                                    disabled={!ready || busy}
                                    onPress={() => setEditing(true)}
                                />
                            )}
                        </SessionFormSection>
                        <SessionFormSection
                            title={t('settings_account_section')}
                            kind="account"
                        >
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 12,
                                    lineHeight: 19,
                                }}
                            >
                                {t('unifiedProfile.accountHint')}
                            </Text>
                            {editing ? (
                                <>
                                    <View style={{ gap: 8 }}>
                                        <Text
                                            style={{
                                                color: c.muted,
                                                fontSize: 12,
                                            }}
                                        >
                                            {t('email_placeholder')}
                                        </Text>
                                        <TextInput
                                            accessibilityLabel={t(
                                                'email_placeholder',
                                            )}
                                            value={email}
                                            onChangeText={setEmail}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            style={{
                                                padding: 14,
                                                borderRadius: 14,
                                                backgroundColor: c.field,
                                                color: c.fg,
                                                minHeight: 48,
                                            }}
                                        />
                                    </View>
                                    <TextInput
                                        accessibilityLabel={t(
                                            'password_placeholder',
                                        )}
                                        placeholder={t('password_placeholder')}
                                        placeholderTextColor={c.muted}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                        style={{
                                            padding: 14,
                                            borderRadius: 14,
                                            backgroundColor: c.field,
                                            color: c.fg,
                                            minHeight: 48,
                                        }}
                                    />
                                </>
                            ) : (
                                <Text style={{ color: c.fg, fontSize: 14 }}>
                                    {session.user.email}
                                </Text>
                            )}
                        </SessionFormSection>
                        {!!saveError && (
                            <CommunityMessage
                                title={t('community.saveError')}
                                hint={saveError === t('community.saveError') ? undefined : saveError}
                            />
                        )}
                        {!!notice && <CommunityMessage title={notice} />}
                        {editing && (
                            <View style={{ gap: 10 }}>
                                <CommunityButton
                                    label={t('save_changes')}
                                    onPress={() => {
                                        void handleUpdateProfile();
                                    }}
                                    busy={saving}
                                    disabled={
                                        !ready ||
                                        uploading ||
                                        !artistName.trim()
                                    }
                                />
                                <CommunityButton
                                    label={t('cancel')}
                                    secondary
                                    disabled={busy}
                                    onPress={() => {
                                        setEditing(false);
                                        setSaveError('');
                                    }}
                                />
                            </View>
                        )}
                        <SessionFormSection
                            title={t('settings_app_section')}
                            kind="settings"
                        >
                            <SettingItem
                                icon={
                                    theme === 'dark'
                                        ? Moon
                                        : theme === 'light'
                                          ? Sun
                                          : Monitor
                                }
                                label={t('appearance')}
                                value={t(`theme_${theme}`)}
                                onPress={() => {
                                    Alert.alert(
                                        t('appearance'),
                                        t('appearance'),
                                        [
                                            {
                                                text: t('theme_light'),
                                                onPress: () =>
                                                    setTheme('light'),
                                            },
                                            {
                                                text: t('theme_dark'),
                                                onPress: () => setTheme('dark'),
                                            },
                                            {
                                                text: t('theme_system'),
                                                onPress: () =>
                                                    setTheme('system'),
                                            },
                                            {
                                                text: t('cancel'),
                                                style: 'cancel',
                                            },
                                        ],
                                    );
                                }}
                            />
                            <SettingItem
                                icon={Star}
                                label={t('rate_app')}
                                onPress={handleRateApp}
                            />
                        </SessionFormSection>
                        <SessionFormSection
                            title={t('settings_legal_section')}
                            kind="account"
                        >
                            <SettingItem
                                icon={ShieldCheck}
                                label={t('privacy_policy')}
                                onPress={() =>
                                    Linking.openURL(t('privacy_policy_url'))
                                }
                            />
                            <SettingItem
                                icon={Info}
                                label={t('terms_of_use')}
                                onPress={() =>
                                    Linking.openURL(t('terms_of_use_url'))
                                }
                            />
                        </SessionFormSection>
                        <View style={{ paddingHorizontal: 18 }}>
                            <SettingItem
                                icon={LogOut}
                                label={t('log_out')}
                                onPress={() => {
                                    void signOut();
                                }}
                            />
                            <SettingItem
                                icon={Trash2}
                                label={t('delete_account')}
                                onPress={handleDeleteAccount}
                                destructive
                            />
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
