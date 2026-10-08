import { useState } from 'react';
import { SessionVenueSheet } from '../venues/SessionVenueSheet';
import {
    useVenuesQuery,
    useCreateVenueMutation,
} from '../../hooks/useVenuesQuery';
import { useUpdateSessionMutation } from '../../hooks/useSessionsQuery';
import { canUseDJProfile } from '../../utils/communityProfile';
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
    const [repair, setRepair] = useState(false);
    const venues = useVenuesQuery();
    const createVenue = useCreateVenueMutation();
    const updateSession = useUpdateSessionMutation();
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
        if (!share.data && !canUseDJProfile(profile.data)) {
            router.push('/edit-dj-profile?edit=1');
            return;
        }
        if (!share.data && !session.venue_city?.trim()) {
            setRepair(true);
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
        <>
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
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                    }}
                >
                    <Text
                        style={{ color: c.fg, fontWeight: '800', fontSize: 17 }}
                    >
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
                {!share.data && !session.venue_city?.trim() && (
                    <Text
                        style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}
                    >
                        {t('location.completeBeforeSharing')}
                    </Text>
                )}
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
                            : canUseDJProfile(profile.data)
                              ? session.venue_city?.trim()
                                  ? 'community.publish'
                                  : 'location.completeAction'
                              : 'socialProfile.completeAction',
                    )}
                    secondary={!!share.data}
                    disabled={failed || (!confirmed && !share.data)}
                    busy={busy}
                    onPress={() => {
                        void toggle();
                    }}
                />
            </View>
            <SessionVenueSheet
                visible={repair}
                venues={venues.data || []}
                selectedId={session.venue_id || null}
                onClose={() => setRepair(false)}
                onCreate={(input) => createVenue.mutateAsync(input)}
                onSelect={async (place) => {
                    if (!place.city?.trim()) {
                        setRepair(false);
                        router.push(`/venue/${place.id}`);
                        return;
                    }
                    await updateSession.mutateAsync({
                        sessionId: session.id,
                        input: { venue_id: place.id, venue: place.name },
                    });
                    setRepair(false);
                }}
            />
            {updateSession.isError && (
                <Text style={{ color: '#d76f7d', padding: 16 }}>
                    {t('location.repairError')}
                </Text>
            )}
        </>
    );
}
