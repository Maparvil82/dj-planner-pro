import { useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TextInput,
    View,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';
import { useSessionUsage } from '../src/hooks/useSessionUsage';
import { useUpdateSessionMutation } from '../src/hooks/useSessionsQuery';
import { sessionService } from '../src/services/sessions';
import { type Session } from '../src/types/session';
import { sessionDisplayTitle } from '../src/utils/sessionNaming';
import { sessionPhase } from '../src/utils/sessionWorkflow';
import { agreementAmount } from '../src/utils/feeAgreement';
import { useTranslation } from '../src/i18n/useTranslation';
import { SessionFormHeader } from '../src/components/sessions/SessionFormLayout';
import {
    CommunityButton,
    CommunityMessage,
    useCommunityColors,
} from '../src/components/community/CommunityUI';
import { ConditionalAgreementEditor } from '../src/components/sessions/ConditionalAgreementEditor';

export default function ConditionalSessionScreen() {
    const c = useCommunityColors(),
        { t } = useTranslation(),
        router = useRouter();
    const userId = useAuthStore((s) => s.session?.user.id);
    const usage = useSessionUsage();
    const mutation = useUpdateSessionMutation();
    const [choosing, setChoosing] = useState(false),
        [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Session | null>(null);
    const sessions = useQuery({
        queryKey: ['sessions', 'all', userId],
        queryFn: () => sessionService.getAllSessions(userId!),
        enabled: !!userId && !!usage.data?.isPro && choosing,
        staleTime: 0,
    });
    if (!userId) return <Redirect href="/(auth)/login" />;
    const requirePro = (action: () => void) => {
        if (usage.isError || usage.isPending) return;
        if (!usage.data?.isPro) router.push('/paywall?reason=conditional');
        else action();
    };
    const rows =
        sessions.data
            ?.filter(
                (s) =>
                    !s.is_guest &&
                    s.user_id === userId &&
                    s.status !== 'cancelled' &&
                    s.fee_agreement?.version !== 1 &&
                    `${sessionDisplayTitle(s, t)} ${s.venue} ${s.date}`
                        .toLocaleLowerCase()
                        .includes(search.toLocaleLowerCase()),
            )
            .sort((a, b) => b.date.localeCompare(a.date)) || [];
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
            <SessionFormHeader
                title={t('conditional.title')}
                badge="PRO"
                subtitle={t('conditional.intro')}
                onClose={() =>
                    router.canGoBack() ? router.back() : router.replace('/home')
                }
            />
            <ScrollView
                contentContainerStyle={{
                    padding: 20,
                    paddingTop: 0,
                    gap: 18,
                    paddingBottom: 32,
                }}
                keyboardShouldPersistTaps="handled"
            >
                <View
                    style={{
                        backgroundColor: c.tint,
                        borderRadius: 24,
                        padding: 22,
                        gap: 12,
                    }}
                >
                    <Text
                        style={{
                            color: c.fg,
                            fontWeight: '800',
                            fontSize: 24,
                            lineHeight: 30,
                        }}
                    >
                        {t('conditional.hero')}
                    </Text>
                    <Text
                        style={{ color: c.muted, fontSize: 14, lineHeight: 22 }}
                    >
                        {t('conditional.proBenefit')}
                    </Text>
                    <Text
                        style={{
                            color: c.accent,
                            fontWeight: '700',
                            lineHeight: 22,
                        }}
                    >
                        {t('conditional.example')}
                    </Text>
                </View>
                {usage.isPending ? (
                    <ActivityIndicator color={c.accent} />
                ) : usage.isError ? (
                    <CommunityMessage
                        title={t('billing.verificationError')}
                        retry={() => void usage.refetch()}
                    />
                ) : (
                    <>
                        <CommunityButton
                            label={t('conditional.newSession')}
                            onPress={() =>
                                requirePro(() =>
                                    router.push('/add-session?conditional=1'),
                                )
                            }
                        />
                        <CommunityButton
                            secondary
                            label={t('conditional.existingSession')}
                            onPress={() => requirePro(() => setChoosing(true))}
                        />
                    </>
                )}
                {choosing && (
                    <>
                        <TextInput
                            accessibilityLabel={t('conditional.search')}
                            placeholder={t('conditional.search')}
                            placeholderTextColor={c.muted}
                            value={search}
                            onChangeText={setSearch}
                            style={{
                                backgroundColor: c.field,
                                color: c.fg,
                                padding: 16,
                                borderRadius: 16,
                                minHeight: 50,
                            }}
                        />
                        {sessions.isPending ? (
                            <CommunityMessage
                                title={t('community.loading')}
                                loading
                            />
                        ) : sessions.isError ? (
                            <CommunityMessage
                                title={t('community.error')}
                                retry={() => void sessions.refetch()}
                            />
                        ) : !rows.length ? (
                            <CommunityMessage
                                title={t('conditional.noSessions')}
                            />
                        ) : (
                            rows.map((s) => (
                                <TouchableOpacity
                                    key={s.id}
                                    accessibilityRole="button"
                                    onPress={() => {
                                        setSelected(s);
                                    }}
                                    style={{
                                        padding: 18,
                                        gap: 6,
                                        borderRadius: 18,
                                        backgroundColor: c.card,
                                        borderWidth: 1,
                                        borderColor: c.border,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: c.fg,
                                            fontWeight: '700',
                                            fontSize: 16,
                                        }}
                                    >
                                        {sessionDisplayTitle(s, t)}
                                    </Text>
                                    <Text style={{ color: c.muted }}>
                                        {s.date} · {s.venue}
                                    </Text>
                                    <Text
                                        style={{
                                            color: c.accent,
                                            fontSize: 12,
                                        }}
                                    >
                                        {t(
                                            s.fee_agreement?.version === 2
                                                ? 'conditional.editExisting'
                                                : 'conditional.replaceFee',
                                        )}
                                    </Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </>
                )}
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                    {t('conditional.privateHint')}
                </Text>
            </ScrollView>
            {selected && (
                <ConditionalAgreementEditor
                    value={
                        selected.fee_agreement?.version === 2
                            ? selected.fee_agreement
                            : null
                    }
                    currency={selected.currency}
                    names={selected.djs || []}
                    canSettle={sessionPhase(selected) === 'finished'}
                    onClose={() => setSelected(null)}
                    onSave={async (a) => {
                        await mutation.mutateAsync({
                            sessionId: selected.id,
                            input: {
                                earning_type: 'agreement',
                                fee_agreement: {
                                    ...a,
                                    timezone:
                                        selected.booking_timezone || a.timezone,
                                },
                                earning_amount: agreementAmount(a),
                            },
                            updateAll: false,
                        });
                        setSelected(null);
                        router.replace(`/session/${selected.id}`);
                    }}
                />
            )}
        </SafeAreaView>
    );
}
