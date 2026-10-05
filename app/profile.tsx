import { DJProfileEditor } from '../src/components/profile/DJProfileEditor';
import type { CityLocation } from '../src/utils/cities';
import {
    canUseDJProfile,
    isDJProfileComplete,
} from '../src/utils/communityProfile';
import { ProfileMixes } from '../src/components/community/ProfileMixes';
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
    Image,
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
import { ChevronRight, ArrowLeft } from 'lucide-react-native';
import { useTranslation } from '../src/i18n/useTranslation';
import { PageHeader } from '../src/components/ui/PageHeader';
import { SessionFormSection } from '../src/components/sessions/SessionFormLayout';
import {
    CommunityButton,
    CommunityMessage,
    useCommunityColors,
} from '../src/components/community/CommunityUI';
import {
    useCommunityMutation,
    useCommunityProfile,
} from '../src/hooks/useCommunityQuery';
import { useAuthStore } from '../src/store/useAuthStore';
import { useTheme } from '../src/contexts/ThemeContext';
import { profileService } from '../src/services/profile';
import { DJ_PLATFORMS, normalizeDJLink } from '../src/utils/communityLinks';
import { SubscriptionPlan } from '../src/components/profile/SubscriptionPlan';
import { AccountEditor } from '../src/components/profile/AccountEditor';
import { MusicGenrePicker } from '../src/components/profile/MusicGenrePicker';
import {
    serializeMusicGenres,
    parseMusicGenres,
} from '../src/utils/musicGenres';

function SettingItem({
    label,
    value,
    onPress,
    destructive = false,
}: {
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
export default function ProfileScreen({
    editorOnly = false,
}: {
    editorOnly?: boolean;
}) {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const { theme, setTheme } = useTheme();
    const { session, profile, signOut, setProfile } = useAuthStore();
    const userId = session?.user.id;
    const router = useRouter();
    const params = useLocalSearchParams<{
        edit?: string;
        section?: string;
        setup?: string;
    }>();
    const communitySetup = params.setup === '1';
    const settingsPage = params.section === 'settings';
    const planPage = params.section === 'plan';
    const profilePage = !settingsPage && !planPage;
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
    const [editingDraft, setEditing] = useState(false);
    const editing = editorOnly || editingDraft;
    const [draftHydrated, setDraftHydrated] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [notice, setNotice] = useState('');
    const [artistName, setArtistName] = useState(profile?.artist_name || '');
    const [city, setCity] = useState('');
    const [cityLocation, setCityLocation] = useState<CityLocation | null>(null);
    const [genres, setGenres] = useState('');
    const [bio, setBio] = useState('');
    const [cover, setCover] = useState<string | null>(null);
    const [links, setLinks] = useState({
        mixcloud: '',
        soundcloud: '',
        instagram: '',
    });
    const [visible, setVisible] = useState(false);
    const [accountEditing, setAccountEditing] = useState(false);
    const [avatar, setAvatar] = useState<string | null>(
        profile?.avatar_url || null,
    );
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
        setCityLocation(social.data?.city_location || null);
        setGenres(
            serializeMusicGenres(parseMusicGenres(social.data?.genres || '')),
        );
        setBio(social.data?.bio || '');
        setCover(social.data?.cover_url || null);
        setLinks({
            mixcloud: social.data?.mixcloud_url || '',
            soundcloud: social.data?.soundcloud_url || '',
            instagram: social.data?.instagram_url || '',
        });
        setVisible(social.data?.is_visible || false);
        setAvatar(account.data?.avatar_url || profile?.avatar_url || null);
    }, [account.data, profile?.artist_name, social.data, session?.user.email]);
    useEffect(() => {
        if (account.data) setProfile(account.data);
    }, [account.data, setProfile]);
    useEffect(() => {
        if (!editing) resetDraft();
    }, [editing, resetDraft]);
    useEffect(() => {
        if (editorOnly && ready && !draftHydrated) {
            resetDraft();
            setDraftHydrated(true);
        }
    }, [editorOnly, ready, draftHydrated, resetDraft]);
    useEffect(() => {
        setEditing(false);
        setAccountEditing(false);
        setSaveError('');
        setNotice('');
    }, [params.section]);
    useEffect(() => {
        if (editorOnly && params.edit === '1' && ready) {
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
        if (
            (visible || communitySetup) &&
            !isDJProfileComplete({ avatar_url: avatar, city, genres })
        ) {
            setSaveError(t('socialProfile.completeHint'));
            return;
        }
        setSaving(true);
        setSaveError('');
        setNotice('');
        try {
            const normalized = { ...links };
            for (const platform of DJ_PLATFORMS) {
                try {
                    normalized[platform] = normalizeDJLink(
                        links[platform],
                        platform,
                    );
                } catch {
                    throw new Error(
                        t('djPage.invalidLink', {
                            platform:
                                platform === 'mixcloud'
                                    ? 'Mixcloud'
                                    : platform === 'soundcloud'
                                      ? 'SoundCloud'
                                      : 'Instagram',
                        }),
                    );
                }
            }
            const savedAvatar =
                avatar && !avatar.startsWith('https://')
                    ? await profileService.uploadProfilePhoto(userId, avatar)
                    : avatar;
            setAvatar(savedAvatar);
            const savedCover =
                cover && !cover.startsWith('https://')
                    ? await profileService.uploadCover(userId, cover)
                    : cover;
            setCover(savedCover);
            await mutation.mutateAsync({
                kind: 'profile',
                input: {
                    artist_name: artistName.trim(),
                    avatar_url: savedAvatar,
                    city: city.trim(),
                    city_location: cityLocation,
                    genres: genres.trim(),
                    bio: bio.trim(),
                    is_visible: communitySetup || visible,
                    cover_url: savedCover,
                    mixcloud_url: normalized.mixcloud,
                    soundcloud_url: normalized.soundcloud,
                    instagram_url: normalized.instagram,
                },
            });
            setEditing(false);
            if (editorOnly) {
                if (router.canGoBack()) router.back();
                else
                    router.replace(
                        communitySetup ? '/(tabs)/community' : '/profile',
                    );
            }
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
    const handlePickCover = async () => {
        if (busy) return;
        const permission =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert(t('settings_title'), t('permissions_required'));
            return;
        }
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [16, 9],
                quality: 1,
            });
            if (!result.canceled && result.assets[0])
                setCover(result.assets[0].uri);
        } catch {
            setSaveError(t('error_uploading'));
        }
    };
    const handlePickAvatar = async () => {
        if (!userId || busy) return;
        setEditing(true);
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
        setUploading(true);
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 1,
            });
            if (!result.canceled && result.assets[0])
                setAvatar(result.assets[0].uri);
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
        url = false,
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
                editable={!busy}
                autoCapitalize={url ? 'none' : 'sentences'}
                autoCorrect={!url}
                keyboardType={url ? 'url' : 'default'}
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
    if (!editorOnly && profilePage && params.edit === '1')
        return (
            <Redirect
                href={
                    communitySetup
                        ? '/edit-dj-profile?edit=1&setup=1'
                        : '/edit-dj-profile?edit=1'
                }
            />
        );
    if (editorOnly && (!ready || !draftHydrated))
        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: 'rgba(9,6,22,.5)',
                    justifyContent: 'center',
                    padding: 24,
                }}
            >
                <CommunityMessage
                    title={t(
                        account.isError || social.isError
                            ? 'community.error'
                            : 'community.loading',
                    )}
                    loading={!account.isError && !social.isError}
                    retry={
                        account.isError || social.isError
                            ? () => {
                                  void account.refetch();
                                  void social.refetch();
                              }
                            : undefined
                    }
                />
                <CommunityButton
                    label={t('cancel')}
                    secondary
                    onPress={() =>
                        router.canGoBack()
                            ? router.back()
                            : router.replace('/(tabs)/community')
                    }
                />
            </View>
        );

    if (profilePage && editing && ready)
        return (
            <DJProfileEditor
                artistName={artistName}
                city={city}
                cityLocation={cityLocation}
                genres={genres}
                bio={bio}
                avatar={avatar}
                cover={cover}
                links={links}
                visible={visible}
                busy={busy}
                setup={communitySetup}
                linksEnabled={!communitySetup && canUseDJProfile(social.data)}
                error={saveError}
                onName={setArtistName}
                onCity={setCity}
                onCityLocation={setCityLocation}
                onGenres={setGenres}
                onBio={setBio}
                onLinks={setLinks}
                onAvatar={handlePickAvatar}
                onCover={handlePickCover}
                onRemoveCover={() => setCover(null)}
                onVisible={(next) => {
                    if (
                        next &&
                        !isDJProfileComplete({
                            avatar_url: avatar,
                            city,
                            genres,
                        })
                    ) {
                        setSaveError(t('socialProfile.completeHint'));
                        return;
                    }
                    setSaveError('');
                    setVisible(next);
                }}
                onSave={() => {
                    void handleUpdateProfile();
                }}
                onClose={() => {
                    setSaveError('');
                    setEditing(false);
                    if (editorOnly) {
                        if (router.canGoBack()) router.back();
                        else
                            router.replace(
                                communitySetup
                                    ? '/(tabs)/community'
                                    : '/profile',
                            );
                    }
                }}
            />
        );
    return (
        <SafeAreaView
            edges={['top', 'bottom']}
            style={{ flex: 1, backgroundColor: c.bg }}
        >
            <PageHeader
                showPlaces={false}
                title={t(
                    settingsPage
                        ? 'accountMenu.settings'
                        : planPage
                          ? 'accountMenu.plan'
                          : editing
                            ? 'edit_profile'
                            : 'unifiedProfile.title',
                )}
                subtitle={t(
                    settingsPage
                        ? 'accountMenu.settingsHint'
                        : planPage
                          ? 'accountMenu.planHint'
                          : editing
                            ? 'profileUX.editIntro'
                            : 'accountMenu.profileHint',
                )}
                leading={
                    !editing ? (
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={t('back')}
                            onPress={() =>
                                router.canGoBack()
                                    ? router.back()
                                    : router.replace('/(tabs)/home')
                            }
                            style={{
                                width: 44,
                                height: 44,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <ArrowLeft size={22} color={c.fg} />
                        </TouchableOpacity>
                    ) : null
                }
                action={null}
            />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    scrollEventThrottle={16}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{
                        paddingHorizontal: 20,
                        paddingBottom: 28,
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
                        {profilePage && (
                            <>
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
                                        <TouchableOpacity
                                            accessibilityRole="button"
                                            accessibilityLabel={t(
                                                'unifiedProfile.changePhoto',
                                            )}
                                            disabled={busy || !ready}
                                            onPress={() =>
                                                router.push(
                                                    '/edit-dj-profile?edit=1',
                                                )
                                            }
                                            style={{
                                                width: 104,
                                                height: 104,
                                                borderRadius: 32,
                                                backgroundColor: c.tint,
                                                borderWidth: 2,
                                                borderColor: c.border,
                                                overflow: 'hidden',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            {(
                                                editing
                                                    ? avatar
                                                    : profile?.avatar_url
                                            ) ? (
                                                <Image
                                                    source={{
                                                        uri: (editing
                                                            ? avatar
                                                            : profile?.avatar_url)!,
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                    }}
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <Text
                                                    style={{
                                                        color: c.accent,
                                                        fontSize: 36,
                                                        fontWeight: '800',
                                                    }}
                                                >
                                                    {(
                                                        artistName.trim()[0] ||
                                                        'DJ'
                                                    ).toUpperCase()}
                                                </Text>
                                            )}
                                            {uploading && (
                                                <ActivityIndicator
                                                    color={c.accent}
                                                    style={{
                                                        position: 'absolute',
                                                    }}
                                                />
                                            )}
                                        </TouchableOpacity>
                                        <View style={{ flex: 1, gap: 5 }}>
                                            <Text
                                                style={{
                                                    color: c.fg,
                                                    fontSize: 23,
                                                    fontWeight: '800',
                                                }}
                                            >
                                                {editing
                                                    ? artistName ||
                                                      t('artist_name')
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
                                    {editing && (
                                        <CommunityButton
                                            label={t(
                                                avatar
                                                    ? 'unifiedProfile.changePhoto'
                                                    : 'socialProfile.addPhoto',
                                            )}
                                            secondary
                                            disabled={busy || !ready}
                                            onPress={() =>
                                                router.push(
                                                    '/edit-dj-profile?edit=1',
                                                )
                                            }
                                        />
                                    )}
                                    {!isDJProfileComplete({
                                        avatar_url: avatar,
                                        city,
                                        genres,
                                    }) && (
                                        <View
                                            style={{
                                                backgroundColor: c.tint,
                                                borderRadius: 16,
                                                padding: 14,
                                                gap: 10,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: c.fg,
                                                    fontSize: 14,
                                                    fontWeight: '700',
                                                }}
                                            >
                                                {t(
                                                    'socialProfile.completeTitle',
                                                )}
                                            </Text>
                                            <Text
                                                style={{
                                                    color: c.muted,
                                                    fontSize: 12,
                                                    lineHeight: 18,
                                                }}
                                            >
                                                {t(
                                                    'socialProfile.completeHint',
                                                )}
                                            </Text>
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    flexWrap: 'wrap',
                                                    gap: 8,
                                                }}
                                            >
                                                {[
                                                    [
                                                        t(
                                                            'socialProfile.photo',
                                                        ),
                                                        !!avatar,
                                                    ],
                                                    [
                                                        t('venue_city'),
                                                        !!city.trim(),
                                                    ],
                                                    [
                                                        t('community.genres'),
                                                        !!parseMusicGenres(
                                                            genres,
                                                        ).length,
                                                    ],
                                                ].map(([label, done]) => (
                                                    <Text
                                                        key={String(label)}
                                                        style={{
                                                            color: done
                                                                ? c.accent
                                                                : c.muted,
                                                            fontSize: 12,
                                                            fontWeight: '600',
                                                            paddingVertical: 6,
                                                            paddingHorizontal: 10,
                                                            borderRadius: 12,
                                                            backgroundColor:
                                                                c.card,
                                                        }}
                                                    >
                                                        {String(label)} ·{' '}
                                                        {t(
                                                            done
                                                                ? 'socialProfile.done'
                                                                : 'socialProfile.missing',
                                                        )}
                                                    </Text>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                    {editing ? (
                                        <>
                                            {field(
                                                t('artist_name'),
                                                artistName,
                                                setArtistName,
                                                80,
                                            )}
                                            {field(
                                                t('venue_city') + ' *',
                                                city,
                                                setCity,
                                                100,
                                            )}
                                            <MusicGenrePicker
                                                value={genres}
                                                onChange={setGenres}
                                                disabled={busy}
                                            />
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
                                                    router.push(
                                                        '/edit-dj-profile?edit=1',
                                                    );
                                                    setSaveError('');
                                                }}
                                                disabled={!ready || busy}
                                            />
                                        </>
                                    )}
                                </SessionFormSection>
                                {editing && (
                                    <SessionFormSection
                                        title={t('djPage.customize')}
                                        kind="participants"
                                    >
                                        <Text
                                            style={{
                                                color: c.muted,
                                                fontSize: 13,
                                                lineHeight: 20,
                                            }}
                                        >
                                            {t('djPage.coverHint')}
                                        </Text>
                                        <View
                                            style={{
                                                height: 150,
                                                borderRadius: 18,
                                                overflow: 'hidden',
                                                backgroundColor: c.tint,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            {cover ? (
                                                <Image
                                                    source={{ uri: cover }}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                    }}
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <Text
                                                    style={{
                                                        color: c.muted,
                                                        fontSize: 13,
                                                    }}
                                                >
                                                    {t('djPage.cover')}
                                                </Text>
                                            )}
                                        </View>
                                        <CommunityButton
                                            label={t('djPage.changeCover')}
                                            secondary
                                            disabled={busy}
                                            onPress={handlePickCover}
                                        />
                                        {!!cover && (
                                            <CommunityButton
                                                label={t('djPage.removeCover')}
                                                secondary
                                                disabled={busy}
                                                onPress={() => setCover(null)}
                                            />
                                        )}
                                        <Text
                                            style={{
                                                color: c.muted,
                                                fontSize: 13,
                                                lineHeight: 20,
                                            }}
                                        >
                                            {t('djPage.linksHint')}
                                        </Text>
                                        {DJ_PLATFORMS.map((platform) => (
                                            <View key={platform}>
                                                {field(
                                                    platform === 'mixcloud'
                                                        ? 'Mixcloud'
                                                        : platform ===
                                                            'soundcloud'
                                                          ? 'SoundCloud'
                                                          : 'Instagram',
                                                    links[platform],
                                                    (value) =>
                                                        setLinks((current) => ({
                                                            ...current,
                                                            [platform]: value,
                                                        })),
                                                    500,
                                                    false,
                                                    true,
                                                )}
                                            </View>
                                        ))}
                                    </SessionFormSection>
                                )}
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
                                                onValueChange={(next) => {
                                                    if (
                                                        next &&
                                                        !isDJProfileComplete({
                                                            avatar_url: avatar,
                                                            city,
                                                            genres,
                                                        })
                                                    ) {
                                                        setSaveError(
                                                            t(
                                                                'socialProfile.completeHint',
                                                            ),
                                                        );
                                                        return;
                                                    }
                                                    setSaveError('');
                                                    setVisible(next);
                                                }}
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
                                    {!editing &&
                                        social.data?.is_visible &&
                                        isDJProfileComplete(social.data) && (
                                            <CommunityButton
                                                label={t(
                                                    'unifiedProfile.preview',
                                                )}
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
                                            onPress={() =>
                                                router.push(
                                                    '/edit-dj-profile?edit=1',
                                                )
                                            }
                                        />
                                    )}
                                </SessionFormSection>
                                {!editing && userId && (
                                    <ProfileMixes
                                        userId={userId}
                                        editable
                                        canAdd={isDJProfileComplete(
                                            social.data,
                                        )}
                                    />
                                )}
                            </>
                        )}
                        {settingsPage && !editing && (
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
                                <Text style={{ color: c.fg, fontSize: 14 }}>
                                    {session.user.email}
                                </Text>
                                <CommunityButton
                                    label={t('profileUX.manageAccount')}
                                    secondary
                                    onPress={() => {
                                        setNotice('');
                                        setAccountEditing(true);
                                    }}
                                />
                            </SessionFormSection>
                        )}
                        {planPage && <SubscriptionPlan />}
                        {!!saveError && (
                            <CommunityMessage
                                title={t('community.saveError')}
                                hint={
                                    saveError === t('community.saveError')
                                        ? undefined
                                        : saveError
                                }
                            />
                        )}
                        {!!notice && <CommunityMessage title={notice} />}
                        {settingsPage && !editing && (
                            <>
                                <SessionFormSection
                                    title={t('settings_app_section')}
                                    kind="settings"
                                >
                                    <SettingItem
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
                                                        onPress: () =>
                                                            setTheme('dark'),
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
                                        label={t('rate_app')}
                                        onPress={handleRateApp}
                                    />
                                </SessionFormSection>
                                <SessionFormSection
                                    title={t('settings_legal_section')}
                                    kind="account"
                                >
                                    <SettingItem
                                        label={t('privacy_policy')}
                                        onPress={() =>
                                            Linking.openURL(
                                                t('privacy_policy_url'),
                                            )
                                        }
                                    />
                                    <SettingItem
                                        label={t('terms_of_use')}
                                        onPress={() =>
                                            Linking.openURL(
                                                t('terms_of_use_url'),
                                            )
                                        }
                                    />
                                </SessionFormSection>
                                <View style={{ paddingHorizontal: 18 }}>
                                    <SettingItem
                                        label={t('log_out')}
                                        onPress={() => {
                                            void signOut();
                                        }}
                                    />
                                    <SettingItem
                                        label={t('delete_account')}
                                        onPress={handleDeleteAccount}
                                        destructive
                                    />
                                </View>
                            </>
                        )}
                    </View>
                </ScrollView>
                {editing && (
                    <View
                        style={{
                            paddingHorizontal: 20,
                            paddingVertical: 14,
                            borderTopWidth: 1,
                            borderColor: c.border,
                            backgroundColor: c.bg,
                        }}
                    >
                        <View
                            style={{
                                width: '100%',
                                maxWidth: 900,
                                alignSelf: 'center',
                                gap: 10,
                            }}
                        >
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 11,
                                    lineHeight: 16,
                                }}
                            >
                                {t('profileUX.saveScope')}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
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
                                <View style={{ flex: 2 }}>
                                    <CommunityButton
                                        label={t('profileUX.saveProfile')}
                                        busy={saving}
                                        disabled={
                                            !ready ||
                                            uploading ||
                                            !artistName.trim()
                                        }
                                        onPress={() => {
                                            void handleUpdateProfile();
                                        }}
                                    />
                                </View>
                            </View>
                        </View>
                    </View>
                )}
            </KeyboardAvoidingView>
            {accountEditing && (
                <AccountEditor
                    currentEmail={session.user.email || ''}
                    onClose={() => setAccountEditing(false)}
                    onSaved={(message) => {
                        setNotice(message);
                        setAccountEditing(false);
                    }}
                />
            )}
        </SafeAreaView>
    );
}
