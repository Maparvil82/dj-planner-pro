import { useQuery } from '@tanstack/react-query';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import {
    useSessionCollaborators,
    useInvitationReply,
} from '../../hooks/useCollaborations';
import { useTranslation } from '../../i18n/useTranslation';
import {
    useCommunityColors,
    CommunityButton,
    CommunityMessage,
} from '../community/CommunityUI';
import { confirmAction } from '../../utils/confirmAction';
import type { Session } from '../../types/session';
export function SessionCollaborationDetails({ session }: { session: Session }) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const router = useRouter();
    const people = useSessionCollaborators(
        session.is_guest ? undefined : session.id,
    );
    const reply = useInvitationReply();
    const ids = people.data?.map((person) => person.dj_id) || [];
    const profiles = useQuery({
        queryKey: [
            'community',
            'session-participant-profiles',
            session.id,
            ids,
        ],
        enabled: !session.is_guest && !!ids.length,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('community_profiles')
                .select('user_id,artist_name')
                .in('user_id', ids)
                .eq('is_visible', true);
            if (error) throw error;
            return data || [];
        },
    });
    if (!session.is_guest && !session.dj_profile_ids?.length) return null;
    return (
        <View
            style={{
                padding: 20,
                marginTop: 20,
                gap: 12,
                borderRadius: 24,
                backgroundColor: c.card,
                borderColor: c.border,
                borderWidth: 1,
            }}
        >
            <Text style={{ color: c.fg, fontSize: 17, fontWeight: '800' }}>
                {t('collaboration.sessionTeam')}
            </Text>
            {session.is_guest ? (
                <>
                    <Text style={{ color: c.muted, lineHeight: 21 }}>
                        {t('collaboration.guestHint', {
                            name: session.owner_name || 'DJ',
                        })}
                    </Text>
                    {reply.isError && (
                        <CommunityMessage title={t('collaboration.error')} />
                    )}
                    <CommunityButton
                        label={t('collaboration.leave')}
                        secondary
                        busy={reply.isPending}
                        onPress={async () => {
                            if (
                                await confirmAction(
                                    t('collaboration.leave'),
                                    t('collaboration.leaveHint'),
                                    t('cancel'),
                                    t('collaboration.leave'),
                                )
                            )
                                reply.mutate(
                                    {
                                        sessionId: session.id,
                                        status: 'declined',
                                    },
                                    {
                                        onSuccess: () =>
                                            router.replace('/(tabs)/home'),
                                    },
                                );
                        }}
                    />
                </>
            ) : people.isError ? (
                <CommunityMessage
                    title={t('collaboration.error')}
                    retry={() => {
                        void people.refetch();
                    }}
                />
            ) : (
                people.data?.map((person) => {
                    const profile = profiles.data?.find(
                        (profile) => profile.user_id === person.dj_id,
                    );
                    return (
                        <View
                            key={person.dj_id}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 10,
                            }}
                        >
                            {profile ? (
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel={`${t('community.viewProfile')}: ${profile.artist_name}`}
                                    onPress={() =>
                                        router.push(
                                            `/community/${person.dj_id}`,
                                        )
                                    }
                                    style={{ flex: 1, paddingVertical: 10 }}
                                >
                                    <Text
                                        style={{
                                            color: c.accent,
                                            fontSize: 14,
                                            fontWeight: '600',
                                        }}
                                    >
                                        {profile.artist_name}
                                    </Text>
                                </TouchableOpacity>
                            ) : (
                                <Text
                                    style={{
                                        color: c.fg,
                                        fontSize: 14,
                                        flex: 1,
                                    }}
                                >
                                    {person.artist_name}
                                </Text>
                            )}
                            <Text style={{ color: c.muted, fontSize: 11 }}>
                                {t(`collaboration.${person.status}`)}
                            </Text>
                        </View>
                    );
                })
            )}
        </View>
    );
}
