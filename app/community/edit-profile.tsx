import { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    Switch,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTranslation } from '../../src/i18n/useTranslation';
import {
    SessionFormHeader,
    SessionFormSection,
} from '../../src/components/sessions/SessionFormLayout';
import { Avatar } from '../../src/components/ui/Avatar';
import {
    CommunityButton,
    CommunityMessage,
    useCommunityColors,
} from '../../src/components/community/CommunityUI';
import {
    useCommunityMutation,
    useCommunityProfile,
} from '../../src/hooks/useCommunityQuery';
export default function EditCommunityProfile() {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const router = useRouter();
    const { session, profile } = useAuthStore();
    const userId = session?.user.id;
    const own = useCommunityProfile(userId);
    const mutation = useCommunityMutation();
    const loaded = useRef(false);
    const [name, setName] = useState(profile?.artist_name || '');
    const [city, setCity] = useState('');
    const [bio, setBio] = useState('');
    const [genres, setGenres] = useState('');
    const [visible, setVisible] = useState(false);
    const [avatar, setAvatar] = useState<string | null>(
        profile?.avatar_url || null,
    );
    useEffect(() => {
        if (own.isPending || own.isError || loaded.current) return;
        loaded.current = true;
        if (own.data) {
            setName(own.data.artist_name);
            setCity(own.data.city);
            setBio(own.data.bio);
            setGenres(own.data.genres);
            setVisible(own.data.is_visible);
            setAvatar(profile?.avatar_url || own.data.avatar_url);
        }
    }, [own.data, own.isPending, own.isError]);
    const save = async () => {
        if (!name.trim()) return;
        try {
            await mutation.mutateAsync({
                kind: 'profile',
                input: {
                    artist_name: name.trim(),
                    city: city.trim(),
                    bio: bio.trim(),
                    genres: genres.trim(),
                    avatar_url: avatar,
                    is_visible: visible,
                },
            });
            router.replace(`/community/${userId}`);
        } catch {
            /* Error remains visible with editable fields. */
        }
    };
    const field = (
        label: string,
        value: string,
        setter: (value: string) => void,
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
                onChangeText={setter}
                maxLength={max}
                multiline={multiline}
                textAlignVertical={multiline ? 'top' : 'center'}
                style={{
                    padding: 14,
                    borderRadius: 14,
                    borderColor: c.border,
                    borderWidth: 1,
                    backgroundColor: c.field,
                    color: c.fg,
                    fontSize: 15,
                    minHeight: multiline ? 130 : 48,
                }}
            />
            <Text style={{ color: c.muted, textAlign: 'right', fontSize: 11 }}>
                {value.length}/{max}
            </Text>
        </View>
    );
    if (!session) return <Redirect href="/(auth)/login" />;
    return (
        <SafeAreaView
            edges={['top', 'bottom']}
            style={{ flex: 1, backgroundColor: c.bg }}
        >
            <SessionFormHeader
                title={t('community.editProfile')}
                subtitle={t('community.profileIntro')}
                onClose={() => {
                    if (!mutation.isPending) router.back();
                }}
            />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
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
                        {own.isPending ? (
                            <CommunityMessage
                                title={t('community.loading')}
                                loading
                            />
                        ) : own.isError ? (
                            <CommunityMessage
                                title={t('community.error')}
                                retry={() => {
                                    void own.refetch();
                                }}
                            />
                        ) : (
                            <>
                                <SessionFormSection
                                    title={t('community.identity')}
                                    kind="participants"
                                >
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            gap: 14,
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Avatar
                                            name={name}
                                            url={avatar}
                                            size="lg"
                                        />
                                        <Text
                                            style={{
                                                flex: 1,
                                                color: c.muted,
                                                lineHeight: 19,
                                                fontSize: 12,
                                            }}
                                        >
                                            {t('community.avatarHint')}
                                        </Text>
                                    </View>
                                    {field(t('artist_name'), name, setName, 80)}
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
                                </SessionFormSection>
                                <SessionFormSection
                                    title={t('community.visibility')}
                                    kind="participants"
                                >
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            gap: 14,
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Text
                                            style={{
                                                flex: 1,
                                                color: c.fg,
                                                fontWeight: '600',
                                                fontSize: 14,
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
                                </SessionFormSection>
                                {mutation.isError && (
                                    <CommunityMessage
                                        title={t('community.saveError')}
                                    />
                                )}
                                <CommunityButton
                                    label={t('community.saveProfile')}
                                    onPress={() => {
                                        void save();
                                    }}
                                    disabled={!name.trim()}
                                    busy={mutation.isPending}
                                />
                            </>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
