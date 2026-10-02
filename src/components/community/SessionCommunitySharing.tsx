import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../store/useAuthStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
    useCommunityMutation,
    useCommunityProfile,
    useCommunityShare,
} from '../../hooks/useCommunityQuery';
import { CommunityButton, useCommunityColors } from './CommunityUI';
import { confirmAction } from '../../utils/confirmAction';
import type { Session } from '../../types/session';
export function SessionCommunitySharing({ session }: { session: Session }) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const router = useRouter();
    const userId = useAuthStore((state) => state.session?.user.id);
    const profile = useCommunityProfile(userId);
    const share = useCommunityShare(session.id);
    const mutation = useCommunityMutation();
    const confirmed = session.status === 'confirmed';
    const busy = profile.isPending || share.isPending || mutation.isPending;
    const failed = profile.isError || share.isError || mutation.isError;
    const active = share.data && profile.data?.is_visible && confirmed;
    const toggle = async () => {
        if (!share.data && !profile.data?.is_visible) {
            router.push('/(tabs)/profile?edit=1');
            return;
        }
        if (
            !share.data &&
            !(await confirmAction(
                t('community.publish'),
                t('community.publishMessage'),
                t('cancel'),
                t('community.publish'),
            ))
        )
            return;
        mutation.mutate({
            kind: 'share',
            sessionId: session.id,
            enabled: !share.data,
        });
    };
    return (
        <View
            style={{
                marginTop: 24,
                padding: 20,
                backgroundColor: c.card,
                borderColor: c.border,
                borderWidth: 1,
                borderRadius: 24,
                gap: 13,
            }}
        >
            <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
                <Text style={{ color: c.fg, fontWeight: '800', fontSize: 17 }}>
                    {t('community.title')}
                </Text>
            </View>
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>
                {t(
                    active
                        ? 'community.sessionPublic'
                        : share.data
                          ? 'community.sessionHidden'
                          : 'community.sessionPrivate',
                )}
            </Text>
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>
                {t('community.publishMessage')}
            </Text>
            {!confirmed && (
                <Text style={{ color: c.accent, fontSize: 12 }}>
                    {t('community.confirmFirst')}
                </Text>
            )}
            {failed && (
                <>
                    <Text
                        accessibilityLiveRegion="polite"
                        style={{ color: '#d76f7d', fontSize: 12 }}
                    >
                        {t('community.error')}
                    </Text>
                    <CommunityButton
                        label={t('insights.retry')}
                        secondary
                        onPress={() => {
                            mutation.reset();
                            void profile.refetch();
                            void share.refetch();
                        }}
                    />
                </>
            )}
            <CommunityButton
                label={t(
                    share.data
                        ? 'community.unpublish'
                        : profile.data?.is_visible
                          ? 'community.publish'
                          : 'community.createProfile',
                )}
                secondary={!!share.data}
                disabled={failed || (!confirmed && !share.data)}
                busy={busy}
                onPress={() => {
                    void toggle();
                }}
            />
        </View>
    );
}
