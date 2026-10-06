import { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../src/store/useAuthStore';
import { useCommunityProfile } from '../src/hooks/useCommunityQuery';
import { isDJProfileComplete } from '../src/utils/communityProfile';
import { parseMixSource } from '../src/utils/profileMixes';
import { MixSourceFields } from '../src/components/community/MixSourceFields';
import { profileMixesService } from '../src/services/profileMixes';
import {
    CommunityButton,
    useCommunityColors,
} from '../src/components/community/CommunityUI';
import { useTranslation } from '../src/i18n/useTranslation';

export default function AddMixScreen() {
    const router = useRouter(),
        c = useCommunityColors(),
        { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const userId = useAuthStore((state) => state.session?.user.id);
    const profile = useCommunityProfile(userId);
    const client = useQueryClient();
    const [title, setTitle] = useState(''),
        [url, setUrl] = useState('');
    const canAdd = isDJProfileComplete(profile.data);
    let validUrl = false;
    try {
        validUrl = !!parseMixSource(url);
    } catch {
        /* Show link guidance below the field. */
    }
    const close = () =>
        router.canGoBack() ? router.back() : router.replace('/home');
    const mutation = useMutation({
        mutationFn: () => {
            if (!userId || !canAdd) throw new Error('Profile incomplete');
            return profileMixesService.save(userId, title, url);
        },
        onSuccess: () => {
            void client.invalidateQueries({ queryKey: ['community', 'mixes'] });
            void client.invalidateQueries({
                queryKey: ['community', 'activity'],
            });
            close();
        },
    });
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{
                flex: 1,
                justifyContent: 'flex-end',
                backgroundColor: '#00000066',
            }}
        >
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('accountMenu.close')}
                disabled={mutation.isPending}
                onPress={close}
                style={{ position: 'absolute', inset: 0 }}
            />
            <View
                accessibilityViewIsModal
                style={{
                    maxHeight: '90%',
                    backgroundColor: c.bg,
                    borderTopLeftRadius: 30,
                    borderTopRightRadius: 30,
                    paddingTop: 12,
                }}
            >
                <View
                    style={{
                        width: 34,
                        height: 4,
                        borderRadius: 2,
                        alignSelf: 'center',
                        backgroundColor: c.border,
                        marginBottom: 18,
                    }}
                />
                <View
                    style={{
                        paddingHorizontal: 24,
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 24,
                    }}
                >
                    <Text
                        style={{
                            flex: 1,
                            color: c.fg,
                            fontSize: 26,
                            fontWeight: '800',
                            letterSpacing: -0.6,
                        }}
                    >
                        {t('profileMixes.add')}
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('accountMenu.close')}
                        disabled={mutation.isPending}
                        onPress={close}
                        style={{
                            height: 44,
                            width: 44,
                            borderRadius: 22,
                            backgroundColor: c.field,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <X size={22} color={c.fg} />
                    </Pressable>
                </View>
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{
                        paddingHorizontal: 24,
                        paddingBottom: Math.max(insets.bottom, 24),
                        gap: 14,
                    }}
                >
                    {profile.isPending ? (
                        <ActivityIndicator color={c.accent} />
                    ) : profile.isError ? (
                        <>
                            <Text
                                accessibilityRole="alert"
                                style={{ color: c.fg }}
                            >
                                {t('community.error')}
                            </Text>
                            <CommunityButton
                                label={t('insights.retry')}
                                onPress={() => void profile.refetch()}
                            />
                        </>
                    ) : !canAdd ? (
                        <>
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 15,
                                    lineHeight: 22,
                                }}
                            >
                                {t('createMenu.profileRequired')}
                            </Text>
                            <CommunityButton
                                label={t('community.createProfile')}
                                onPress={() =>
                                    router.replace(
                                        '/edit-dj-profile?edit=1&setup=1',
                                    )
                                }
                            />
                        </>
                    ) : (
                        <>
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 14,
                                    lineHeight: 20,
                                }}
                            >
                                {t('createMenu.mixHint')}
                            </Text>
                            <MixSourceFields
                                title={title}
                                url={url}
                                busy={mutation.isPending}
                                onChange={(value) => {
                                    setTitle(value.title);
                                    setUrl(value.url);
                                }}
                            />
                            {mutation.isError && (
                                <Text
                                    accessibilityRole="alert"
                                    style={{ color: c.fg }}
                                >
                                    {t(
                                        (mutation.error as { code?: string })
                                            .code === '23505'
                                            ? 'profileMixes.duplicate'
                                            : 'profileMixes.saveError',
                                    )}
                                </Text>
                            )}
                            <CommunityButton
                                label={t('profileMixes.save')}
                                disabled={!validUrl || !title.trim()}
                                busy={mutation.isPending}
                                onPress={() => mutation.mutate()}
                            />
                        </>
                    )}
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    );
}
