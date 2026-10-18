import { useScrollHeader } from '../src/hooks/useScrollHeader';
import { useConditionalDraft } from '../src/store/useConditionalDraft';
import type { ConditionalAgreement } from '../src/utils/feeAgreement';
import { useRef, useState } from 'react';
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
import { conditionalSummary } from '../src/utils/conditionalPresentation';
import { useTranslation } from '../src/i18n/useTranslation';
import { SessionFormHeader } from '../src/components/sessions/SessionFormLayout';
import {
    CommunityButton,
    CommunityMessage,
    useCommunityColors,
} from '../src/components/community/CommunityUI';
import { ConditionalAgreementEditor } from '../src/components/sessions/ConditionalAgreementEditor';

export default function ConditionalSessionScreen() {
    const { progress: headerProgress, onScroll: onHeaderScroll, onScrollBeginDrag: onHeaderScrollBeginDrag } = useScrollHeader('compact');
    const c = useCommunityColors(),
        { t, formatMoney } = useTranslation(),
        router = useRouter();
    const userId = useAuthStore((s) => s.session?.user.id);
    const usage = useSessionUsage();
    const mutation = useUpdateSessionMutation();
    const [draft, setDraft] = useState<ConditionalAgreement | null>(null);
    const [editing, setEditing] = useState(true);
    const [choosing, setChoosing] = useState(false),
        [search, setSearch] = useState('');
    const [applyError, setApplyError] = useState('');
    const applying = useRef(false);
    const scroll = useRef<ScrollView>(null);
    const [selected, setSelected] = useState<Session | null>(null);
    const sessions = useQuery({
        queryKey: ['sessions', 'all', userId],
        queryFn: () => sessionService.getAllSessions(userId!),
        enabled: !!userId && !!usage.data?.isPro && choosing,
        staleTime: 0,
    });
    if (!userId) return <Redirect href="/(auth)/login" />;
    const requirePro = (action: () => void) => {
        if (usage.isError || usage.isPending || mutation.isPending) return;
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
    // Render a single screen: presenting a native Modal while the + menu
    // dismisses can leave an invisible touch-blocking window on iOS.
    if (usage.isPending || usage.isError)
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
                <SessionFormHeader progress={headerProgress}
                    title={t('conditional.title')}
                    badge="PRO"
                    subtitle={t('conditionalFlow.intro')}
                    onClose={() =>
                        router.canGoBack()
                            ? router.back()
                            : router.replace('/home')
                    }
                />
                {usage.isPending ? (
                    <ActivityIndicator color={c.accent} />
                ) : (
                    <CommunityMessage
                        title={t('billing.verificationError')}
                        retry={() => void usage.refetch()}
                    />
                )}
            </SafeAreaView>
        );
    if (editing)
        return (
            <ConditionalAgreementEditor
                presentation="screen"
                value={draft}
                termsActionLabel={t('continue')}
                currency={selected?.currency || '€'}
                names={selected?.djs || []}
                canSettle={!!selected && sessionPhase(selected) === 'finished'}
                onClose={() => {
                    setSelected(null);
                    setEditing(false);
                    if (!draft)
                        router.canGoBack()
                            ? router.back()
                            : router.replace('/home');
                }}
                onSave={(a) => {
                    setDraft(a);
                    setSelected(null);
                    setEditing(false);
                }}
            />
        );
    const apply = async () => {
        if (!draft || !selected || applying.current) return;
        applying.current = true;
        setApplyError('');
        try {
            await mutation.mutateAsync({
                sessionId: selected.id,
                input: {
                    earning_type: 'agreement',
                    fee_agreement: {
                        ...draft,
                        settled: false,
                        timezone: selected.booking_timezone || draft.timezone,
                    },
                    earning_amount: 0,
                },
                updateAll: false,
            });
            router.replace(`/session/${selected.id}`);
        } catch (e) {
            const key =
                e instanceof Error
                    ? e.message
                    : (e as { message?: string })?.message;
            setApplyError(
                key?.startsWith('conditional') || key?.startsWith('agreement.')
                    ? key
                    : 'error_saving_session',
            );
        } finally {
            applying.current = false;
        }
    };
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
            <SessionFormHeader progress={headerProgress}
                title={t('conditionalCosts.apply')}
                badge="PRO"
                subtitle={t('conditionalFlow.draftHint')}
                onClose={() =>
                    router.canGoBack() ? router.back() : router.replace('/home')
                }
            />
            <ScrollView scrollEventThrottle={16} onScrollBeginDrag={onHeaderScrollBeginDrag} onTouchStart={onHeaderScrollBeginDrag} onScroll={onHeaderScroll}
                ref={scroll}
                contentContainerStyle={{
                    padding: 20,
                    paddingTop: 0,
                    gap: 18,
                    paddingBottom: 32,
                }}
                keyboardShouldPersistTaps="handled"
            >
                {draft && (
                    <View
                        style={{
                            padding: 18,
                            borderRadius: 18,
                            backgroundColor: c.tint,
                            gap: 10,
                        }}
                    >
                        <Text style={{ color: c.fg, lineHeight: 23 }}>
                            {conditionalSummary(
                                draft,
                                t,
                                (n) => formatMoney(n, selected?.currency || '€'),
                            )}
                        </Text>
                        <CommunityButton
                            secondary
                            compact
                            label={t('conditionalFlow.editAgreement')}
                            onPress={() => {
                                setSelected(null);
                                setEditing(true);
                            }}
                        />
                    </View>
                )}
                <CommunityButton
                    label={t('conditional.newSession')}
                    onPress={() =>
                        requirePro(() => {
                            useConditionalDraft.getState().set(draft);
                            router.replace('/add-session?conditional=1');
                        })
                    }
                />
                <CommunityButton
                    secondary
                    label={t('conditional.existingSession')}
                    onPress={() => requirePro(() => setChoosing(true))}
                />
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
                                    disabled={mutation.isPending}
                                    onPress={() => {
                                        setSelected(s);
                                        setApplyError('');
                                        requestAnimationFrame(() =>
                                            scroll.current?.scrollToEnd({
                                                animated: true,
                                            }),
                                        );
                                    }}
                                    style={{
                                        padding: 18,
                                        gap: 6,
                                        borderRadius: 18,
                                        backgroundColor: c.card,
                                        borderWidth: c.dark ? 0 : 1,
                                        borderColor: c.border,
                                    }}
                                >
                                    <Text
                                        style={[{
                                            color: c.fg,
                                            fontWeight: '700',
                                            fontSize: 16,
                                        }, c.dark && { color: c.cardText }]}
                                    >
                                        {sessionDisplayTitle(s, t)}
                                    </Text>
                                    <Text style={[{ color: c.muted }, c.dark && { color: c.cardText }]}>
                                        {s.date} · {s.venue}
                                    </Text>
                                    <Text
                                        style={[{
                                            color: c.accent,
                                            fontSize: 12,
                                        }, c.dark && { color: c.cardText }]}
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
                {selected && draft && (
                    <View
                        style={{
                            borderWidth: c.dark ? 0 : 1,
                            borderColor: c.accent,
                            backgroundColor: c.card,
                            borderRadius: 18,
                            padding: 18,
                            gap: 12,
                        }}
                    >
                        <Text
                            style={[{
                                color: c.fg,
                                fontWeight: '800',
                                fontSize: 18,
                            }, c.dark && { color: c.cardText }]}
                        >
                            {sessionDisplayTitle(selected, t)}
                        </Text>
                        <Text style={[{ color: c.muted }, c.dark && { color: c.cardText }]}>
                            {selected.date} · {selected.venue}
                        </Text>
                        <Text style={[{ color: c.muted, lineHeight: 21 }, c.dark && { color: c.cardText }]}>
                            {t('conditionalFlow.applyHint')}
                        </Text>
                        {selected.fee_agreement && (
                            <Text style={[{ color: c.fg, lineHeight: 21 }, c.dark && { color: c.cardText }]}>
                                {t('conditionalFlow.replaceHint')}
                            </Text>
                        )}
                        {!!applyError && (
                            <Text
                                accessibilityRole="alert"
                                style={[{ color: '#dc4545' }, c.dark && { color: c.cardText }]}
                            >
                                {t(applyError)}
                            </Text>
                        )}
                        <CommunityButton
                            label={t('conditionalFlow.applyAndSave')}
                            busy={mutation.isPending}
                            disabled={mutation.isPending}
                            onPress={() => void apply()}
                        />
                    </View>
                )}
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                    {t('conditional.privateHint')}
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}
