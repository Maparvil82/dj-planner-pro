import { useState } from 'react';
import {
    Image,
    Modal,
    Platform,
    ScrollView,
    Share,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { Link2, MessageCircle, MoreHorizontal, X } from 'lucide-react-native';
import type { CommunityProfile } from '../../services/community';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from './CommunityUI';
export function ProfileShareSheet({
    person,
    visible,
    onClose,
}: {
    person: CommunityProfile;
    visible: boolean;
    onClose: () => void;
}) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false);
    const [failedPhoto, setFailedPhoto] = useState(false);
    const url = Linking.createURL(`community/${person.user_id}`);
    const message = `${person.artist_name} · DJ Planner\n${url}`;
    const action = async (kind: 'copy' | 'whatsapp' | 'x' | 'more') => {
        setBusy(true);
        setStatus('');
        try {
            if (kind === 'copy') {
                const copied = await Clipboard.setStringAsync(url);
                setStatus(
                    t(copied ? 'profileShare.copied' : 'profileShare.error'),
                );
            } else if (kind === 'whatsapp')
                await Linking.openURL(
                    `https://wa.me/?text=${encodeURIComponent(message)}`,
                );
            else if (kind === 'x')
                await Linking.openURL(
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`,
                );
            else if (Platform.OS === 'web') {
                if (navigator.share)
                    await navigator.share({
                        title: person.artist_name,
                        text: message,
                    });
                else {
                    const copied = await Clipboard.setStringAsync(url);
                    setStatus(
                        t(
                            copied
                                ? 'profileShare.copied'
                                : 'profileShare.error',
                        ),
                    );
                }
            } else
                await Share.share(
                    Platform.OS === 'ios'
                        ? { message: `${person.artist_name} · DJ Planner`, url }
                        : { message },
                );
        } catch (error) {
            if (!(error instanceof Error && error.name === 'AbortError'))
                setStatus(t('profileShare.error'));
        } finally {
            setBusy(false);
        }
    };
    const options = [
        { key: 'copy' as const, label: t('profileShare.copy'), icon: Link2 },
        { key: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle },
        { key: 'x' as const, label: 'X', icon: null },
        {
            key: 'more' as const,
            label: t('profileShare.more'),
            icon: MoreHorizontal,
        },
    ];
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            onShow={() => setStatus('')}
        >
            <View
                style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    justifyContent: 'flex-end',
                }}
            >
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('profileShare.close')}
                    onPress={onClose}
                    style={{ flex: 1 }}
                />
                <View
                    accessibilityViewIsModal
                    style={{
                        backgroundColor: c.card,
                        borderTopLeftRadius: 30,
                        borderTopRightRadius: 30,
                        paddingTop: 12,
                        paddingBottom: insets.bottom + 20,
                        paddingHorizontal: 20,
                        gap: 22,
                    }}
                >
                    <View
                        style={{
                            width: 36,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: c.border,
                            alignSelf: 'center',
                        }}
                    />
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                        }}
                    >
                        <Text
                            style={{
                                flex: 1,
                                color: c.fg,
                                fontSize: 20,
                                fontWeight: '700',
                            }}
                        >
                            {t('profileShare.title')}
                        </Text>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={t('profileShare.close')}
                            onPress={onClose}
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 22,
                                backgroundColor: c.field,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <X size={21} color={c.fg} />
                        </TouchableOpacity>
                    </View>
                    <View
                        style={{
                            alignItems: 'center',
                            gap: 10,
                            paddingVertical: 6,
                        }}
                    >
                        <View
                            style={{
                                width: 136,
                                height: 136,
                                borderRadius: 68,
                                overflow: 'hidden',
                                backgroundColor: c.tint,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {person.avatar_url && !failedPhoto ? (
                                <Image
                                    source={{ uri: person.avatar_url }}
                                    onError={() => setFailedPhoto(true)}
                                    resizeMode="cover"
                                    style={{ width: '100%', height: '100%' }}
                                />
                            ) : (
                                <Text
                                    style={{
                                        color: c.accent,
                                        fontSize: 40,
                                        fontWeight: '700',
                                    }}
                                >
                                    {person.artist_name.charAt(0).toUpperCase()}
                                </Text>
                            )}
                        </View>
                        <Text
                            style={{
                                color: c.fg,
                                fontSize: 22,
                                fontWeight: '700',
                                textAlign: 'center',
                            }}
                        >
                            {person.artist_name}
                        </Text>
                        <Text style={{ color: c.muted, fontSize: 13 }}>
                            {person.city}
                        </Text>
                    </View>
                    {Platform.OS !== 'web' && (
                        <Text
                            style={{
                                color: c.muted,
                                fontSize: 12,
                                lineHeight: 18,
                                textAlign: 'center',
                            }}
                        >
                            {t(
                                url.startsWith('exp')
                                    ? 'profileShare.expoHint'
                                    : 'profileShare.appHint',
                            )}
                        </Text>
                    )}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{
                            flexGrow: 1,
                            justifyContent: 'space-around',
                            gap: 14,
                        }}
                    >
                        {options.map((option) => (
                            <TouchableOpacity
                                key={option.key}
                                accessibilityRole="button"
                                accessibilityLabel={option.label}
                                disabled={busy}
                                onPress={() => {
                                    void action(option.key);
                                }}
                                style={{
                                    width: 68,
                                    alignItems: 'center',
                                    gap: 8,
                                    opacity: busy ? 0.5 : 1,
                                }}
                            >
                                <View
                                    style={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: 28,
                                        backgroundColor:
                                            option.key === 'whatsapp'
                                                ? '#25b95e'
                                                : c.tint,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    {option.icon ? (
                                        <option.icon
                                            size={23}
                                            color={
                                                option.key === 'whatsapp'
                                                    ? '#fff'
                                                    : c.accent
                                            }
                                        />
                                    ) : (
                                        <Text
                                            style={{
                                                color: c.fg,
                                                fontSize: 24,
                                                fontWeight: '700',
                                            }}
                                        >
                                            X
                                        </Text>
                                    )}
                                </View>
                                <Text
                                    numberOfLines={2}
                                    style={{
                                        color: c.muted,
                                        fontSize: 11,
                                        textAlign: 'center',
                                    }}
                                >
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    {!!status && (
                        <Text
                            accessibilityLiveRegion="polite"
                            style={{
                                color: c.accent,
                                fontSize: 13,
                                textAlign: 'center',
                            }}
                        >
                            {status}
                        </Text>
                    )}
                </View>
            </View>
        </Modal>
    );
}
