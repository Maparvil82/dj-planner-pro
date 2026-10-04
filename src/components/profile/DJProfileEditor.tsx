import {
    View,
    Text,
    Image,
    ScrollView,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../../i18n/useTranslation';
import { DJ_PLATFORMS } from '../../utils/communityLinks';
import { isDJProfileComplete } from '../../utils/communityProfile';
import { CommunityButton, useCommunityColors } from '../community/CommunityUI';
import { MusicGenrePicker } from './MusicGenrePicker';
import { CityInput } from './CityInput';

type Props = {
    artistName: string;
    city: string;
    genres: string;
    bio: string;
    avatar: string | null;
    cover: string | null;
    links: Record<(typeof DJ_PLATFORMS)[number], string>;
    visible: boolean;
    busy: boolean;
    setup: boolean;
    linksEnabled: boolean;
    error: string;
    onName: (value: string) => void;
    onCity: (value: string) => void;
    onGenres: (value: string) => void;
    onBio: (value: string) => void;
    onLinks: (value: Props['links']) => void;
    onVisible: (value: boolean) => void;
    onAvatar: () => void;
    onCover: () => void;
    onRemoveCover: () => void;
    onSave: () => void;
    onClose: () => void;
};
export function DJProfileEditor(p: Props) {
    const c = useCommunityColors(),
        { t } = useTranslation();
    const insets = useSafeAreaInsets();
    // Display the artist name as a handle; this is not a unique account username.
    const profileLabel = p.artistName
        .trim()
        .replace(/^@+/, '')
        .replace(/\s+/g, '')
        .toLowerCase();
    const complete = isDJProfileComplete({
        avatar_url: p.avatar,
        city: p.city,
        genres: p.genres,
    });
    const field = (
        label: string,
        value: string,
        change: (value: string) => void,
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
                onChangeText={change}
                editable={!p.busy}
                maxLength={max}
                multiline={multiline}
                autoCapitalize={url ? 'none' : 'sentences'}
                autoCorrect={!url}
                keyboardType={url ? 'url' : 'default'}
                textAlignVertical={multiline ? 'top' : 'center'}
                style={{
                    minHeight: multiline ? 120 : 52,
                    color: c.fg,
                    fontSize: 15,
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: c.field,
                    borderRadius: 15,
                    padding: 15,
                }}
            />
        </View>
    );
    // Fields sit directly on the sheet surface; only each input has its own fill.
    const fieldGroup = { gap: 20 };
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: 'rgba(9,6,22,.5)',
                paddingTop: Math.max(insets.top + 12, 32),
            }}
        >
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('cancel')}
                disabled={p.busy}
                onPress={p.onClose}
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                }}
            />
            <View
                style={{
                    flex: 1,
                    width: '100%',
                    maxWidth: 700,
                    alignSelf: 'center',
                    backgroundColor: c.bg,
                    borderTopLeftRadius: 32,
                    borderTopRightRadius: 32,
                    overflow: 'hidden',
                }}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        contentContainerStyle={{ paddingBottom: 24 }}
                    >
                        <View
                            style={{
                                maxWidth: 700,
                                width: '100%',
                                alignSelf: 'center',
                            }}
                        >
                            <View
                                style={{
                                    height: 258,

                                    overflow: 'hidden',
                                    backgroundColor: '#6554df',
                                }}
                            >
                                {p.cover ? (
                                    <Image
                                        source={{ uri: p.cover }}
                                        resizeMode="cover"
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                        }}
                                    />
                                ) : (
                                    <LinearGradient
                                        colors={['#9b83ec', '#6554df', c.bg]}
                                        style={{ flex: 1 }}
                                    />
                                )}
                                <LinearGradient
                                    colors={['transparent', c.bg]}
                                    style={{
                                        position: 'absolute',
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        height: 190,
                                    }}
                                />
                                <View
                                    pointerEvents="none"
                                    style={{
                                        position: 'absolute',
                                        top: 10,
                                        width: 36,
                                        height: 4,
                                        borderRadius: 2,
                                        backgroundColor: 'rgba(255,255,255,.6)',
                                        alignSelf: 'center',
                                    }}
                                />
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel={t('cancel')}
                                    onPress={p.onClose}
                                    disabled={p.busy}
                                    style={{
                                        position: 'absolute',
                                        top: 26,
                                        left: 20,
                                        width: 44,
                                        height: 44,
                                        borderRadius: 22,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: 'rgba(25,16,48,.45)',
                                    }}
                                >
                                    <ChevronDown size={24} color="#fff" />
                                </TouchableOpacity>
                                <Text
                                    style={{
                                        position: 'absolute',
                                        top: 39,
                                        left: 80,
                                        color: '#fff',
                                        fontSize: 13,
                                        fontWeight: '600',
                                    }}
                                >
                                    {t(
                                        p.setup
                                            ? 'socialProfile.completeAction'
                                            : 'edit_profile',
                                    )}
                                </Text>
                                <View
                                    style={{
                                        position: 'absolute',
                                        bottom: 24,
                                        left: 24,
                                        right: 24,
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
                                        onPress={p.onAvatar}
                                        disabled={p.busy}
                                        style={{
                                            width: 100,
                                            height: 100,
                                            borderRadius: 50,
                                            borderWidth: 3,
                                            borderColor: 'rgba(255,255,255,.6)',
                                            backgroundColor: '#ded5fa',
                                            overflow: 'hidden',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {p.avatar ? (
                                            <Image
                                                source={{ uri: p.avatar }}
                                                resizeMode="cover"
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                }}
                                            />
                                        ) : (
                                            <Text
                                                style={{
                                                    color: '#6554df',
                                                    fontSize: 36,
                                                    fontWeight: '800',
                                                }}
                                            >
                                                {(
                                                    p.artistName.trim()[0] ||
                                                    'DJ'
                                                ).toUpperCase()}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                    <View style={{ flex: 1, gap: 6 }}>
                                        <Text
                                            style={{
                                                color: c.fg,
                                                fontSize: 26,
                                                fontWeight: '800',
                                                letterSpacing: -0.6,
                                            }}
                                            numberOfLines={2}
                                        >
                                            {p.artistName || t('artist_name')}
                                        </Text>
                                        <Text
                                            numberOfLines={1}
                                            style={{
                                                color: c.muted,
                                                fontSize: 13,
                                            }}
                                        >
                                            {profileLabel
                                                ? `@${profileLabel}`
                                                : t('communityEntry.yourSound')}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <View style={{ padding: 20, gap: 18 }}>
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <View style={{ flex: 1 }}>
                                        <CommunityButton
                                            label={
                                                t(
                                                    'communityEntry.photoButton',
                                                ) + ' *'
                                            }
                                            secondary
                                            disabled={p.busy}
                                            onPress={p.onAvatar}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <CommunityButton
                                            label={t(
                                                'communityEntry.coverButton',
                                            )}
                                            secondary
                                            disabled={p.busy}
                                            onPress={p.onCover}
                                        />
                                    </View>
                                </View>
                                {!!p.cover && (
                                    <CommunityButton
                                        label={t('djPage.removeCover')}
                                        secondary
                                        disabled={p.busy}
                                        onPress={p.onRemoveCover}
                                    />
                                )}
                                <Text
                                    style={{
                                        color: c.muted,
                                        fontSize: 13,
                                        lineHeight: 20,
                                    }}
                                >
                                    {t(
                                        p.setup
                                            ? 'communityEntry.setupHint'
                                            : 'communityEntry.requiredHint',
                                    )}
                                </Text>
                                <View style={fieldGroup}>
                                    {field(
                                        t('artist_name') + ' *',
                                        p.artistName,
                                        p.onName,
                                        80,
                                    )}
                                    <CityInput
                                        value={p.city}
                                        onChange={p.onCity}
                                        disabled={p.busy}
                                    />
                                    <MusicGenrePicker
                                        value={p.genres}
                                        onChange={p.onGenres}
                                        disabled={p.busy}
                                    />
                                </View>
                                <View style={fieldGroup}>
                                    {field(
                                        t('community.bio'),
                                        p.bio,
                                        p.onBio,
                                        500,
                                        true,
                                    )}
                                </View>
                                {p.linksEnabled && (
                                    <View style={fieldGroup}>
                                        <Text
                                            style={{
                                                color: c.fg,
                                                fontSize: 16,
                                                fontWeight: '700',
                                            }}
                                        >
                                            {t('communityEntry.links')}
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
                                                    p.links[platform],
                                                    (value) =>
                                                        p.onLinks({
                                                            ...p.links,
                                                            [platform]: value,
                                                        }),
                                                    500,
                                                    false,
                                                    true,
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                )}
                                {!p.setup && (
                                    <View style={fieldGroup}>
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
                                                    fontWeight: '600',
                                                    flex: 1,
                                                }}
                                            >
                                                {t('community.visible')}
                                            </Text>
                                            <Switch
                                                accessibilityLabel={t(
                                                    'community.visible',
                                                )}
                                                value={p.visible}
                                                onValueChange={p.onVisible}
                                                disabled={p.busy}
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
                                    </View>
                                )}
                            </View>
                        </View>
                    </ScrollView>
                    <View
                        style={{
                            paddingHorizontal: 20,
                            paddingTop: 12,
                            paddingBottom: Math.max(insets.bottom, 12),
                            borderTopWidth: 1,
                            borderColor: c.border,
                            gap: 10,
                            backgroundColor: c.bg,
                        }}
                    >
                        <View
                            style={{
                                width: '100%',
                                maxWidth: 660,
                                alignSelf: 'center',
                                gap: 10,
                            }}
                        >
                            {!!p.error && (
                                <Text
                                    accessibilityRole="alert"
                                    style={{
                                        color: '#d76f7d',
                                        fontSize: 12,
                                        lineHeight: 18,
                                    }}
                                >
                                    {p.error}
                                </Text>
                            )}
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 11,
                                    lineHeight: 16,
                                }}
                            >
                                {t(
                                    p.setup
                                        ? 'communityEntry.consent'
                                        : 'profileUX.saveScope',
                                )}
                            </Text>
                            <CommunityButton
                                label={t(
                                    p.setup
                                        ? 'communityEntry.publish'
                                        : 'profileUX.saveProfile',
                                )}
                                busy={p.busy}
                                disabled={
                                    !p.artistName.trim() ||
                                    ((p.setup || p.visible) && !complete)
                                }
                                onPress={p.onSave}
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </View>
    );
}
