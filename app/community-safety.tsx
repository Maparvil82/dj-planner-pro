import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';
import { useTranslation } from '../src/i18n/useTranslation';
import { safetyService } from '../src/services/communitySafety';
import {
    useCommunitySafetyStatus,
    useInvalidateCommunitySafety,
} from '../src/hooks/useCommunitySafety';
import { CommunityRules } from '../src/components/community/CommunityTerms';
import {
    CommunityButton,
    CommunityMessage,
    useCommunityColors,
} from '../src/components/community/CommunityUI';
export default function CommunitySafetyScreen() {
    const c = useCommunityColors(),
        { t } = useTranslation(),
        router = useRouter(),
        client = useQueryClient(),
        status = useCommunitySafetyStatus(),
        invalidate = useInvalidateCommunitySafety();
    const user = useAuthStore((s) => s.session?.user.id);
    const blocked = useQuery({
        queryKey: ['community-safety', user, 'blocked'],
        queryFn: safetyService.blocked,
        enabled: !!user,
    });
    const mutation = useMutation({
        mutationFn: safetyService.unblock,
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ['community-safety'] });
            await invalidate();
        },
    });
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
            <ScrollView contentContainerStyle={{ padding: 24, gap: 22 }}>
                <CommunityButton
                    label={t('djPage.back')}
                    compact
                    secondary
                    onPress={() =>
                        router.canGoBack()
                            ? router.back()
                            : router.replace('/(tabs)/community')
                    }
                />
                <Text style={{ color: c.fg, fontSize: 27, fontWeight: '800' }}>
                    {t('safety.title')}
                </Text>
                {status.isError ? (
                    <CommunityMessage
                        title={t('safety.error')}
                        retry={() => void status.refetch()}
                    />
                ) : (
                    <CommunityRules contact={status.data?.contact} />
                )}
                {status.data?.restricted && (
                    <Text style={{ color: '#c44960', lineHeight: 22 }}>
                        {t('safety.restricted')}
                    </Text>
                )}
                <Text style={{ color: c.fg, fontWeight: '800', fontSize: 20 }}>
                    {t('safety.blockedTitle')}
                </Text>
                {blocked.isPending ? (
                    <CommunityMessage title={t('community.loading')} loading />
                ) : blocked.isError ? (
                    <CommunityMessage
                        title={t('safety.error')}
                        retry={() => void blocked.refetch()}
                    />
                ) : !blocked.data.length ? (
                    <Text style={{ color: c.muted }}>
                        {t('safety.noBlocked')}
                    </Text>
                ) : (
                    blocked.data.map((dj) => (
                        <View
                            key={dj.user_id}
                            style={{
                                padding: 16,
                                borderRadius: 18,
                                backgroundColor: c.card,
                                flexDirection: 'row',
                                gap: 10,
                                alignItems: 'center',
                            }}
                        >
                            <Text
                                style={[{
                                    color: c.fg,
                                    flex: 1,
                                    fontWeight: '700',
                                }, c.dark && { color: c.cardText }]}
                            >
                                {dj.artist_name}
                            </Text>
                            <CommunityButton
                                label={t('safety.unblock')}
                                compact
                                secondary
                                busy={
                                    mutation.isPending &&
                                    mutation.variables === dj.user_id
                                }
                                disabled={mutation.isPending}
                                onPress={() => mutation.mutate(dj.user_id)}
                            />
                        </View>
                    ))
                )}
                <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>
                    {t('safety.unblockHint')}
                </Text>
                {mutation.isError && (
                    <Text
                        accessibilityLiveRegion="polite"
                        style={{ color: '#c44960' }}
                    >
                        {t('safety.error')}
                    </Text>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
