import { useConditionalDraft } from '../src/store/useConditionalDraft';
import type { ConditionalAgreement } from '../src/utils/feeAgreement';
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
    const [draft, setDraft] = useState<ConditionalAgreement | null>(null);
    const [editing, setEditing] = useState(true);
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
    if (!usage.isPending && !usage.isError && !usage.data?.isPro)
        return <Redirect href="/paywall?reason=conditional" />;
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
                title={t('conditionalCosts.apply')}
                badge="PRO"
                subtitle={t('conditionalCosts.chooseSession')}
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
                                requirePro(() => {
                                    useConditionalDraft.getState().set(draft);
                                    router.replace(
                                        '/add-session?conditional=1',
                                    );
                                })
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
                                        setEditing(true);
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
            {editing && !!usage.data?.isPro && !usage.isError && (
                <ConditionalAgreementEditor
                    value={
                        selected?.fee_agreement?.version === 2
                            ? selected.fee_agreement
                            : draft
                    }
                    currency={selected?.currency || '€'}
                    names={selected?.djs || []}
                    canSettle={
                        !!selected && sessionPhase(selected) === 'finished'
                    }
                    onClose={() => {
                        setSelected(null);
                        setEditing(false);
                        if (!draft)
                            router.canGoBack()
                                ? router.back()
                                : router.replace('/home');
                    }}
                    onSave={async (a) => {
                        if (!selected) {
                            setDraft(a);
                            setEditing(false);
                            return;
                        }
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
                        setEditing(false);
                        router.replace(`/session/${selected.id}`);
                    }}
                />
            )}
        </SafeAreaView>
    );
}
