import { captureAnalytics } from '../src/analytics';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, AppState, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, Stack, useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useCommunityColors } from '../src/components/community/communityColors';
import { useTranslation } from '../src/i18n/useTranslation';
import { useAuthStore } from '../src/store/useAuthStore';
import { clearSurveyDraft, getSurveyResponse, readSurveyDraft, saveSurveyDraft, submitSurveyResponse } from '../src/services/researchSurvey';
import { changeResearchInvitation } from '../src/services/researchInvitation';
import { RESEARCH_SURVEY_VERSION, normalizeSurveyAnswers, surveyAnswersValid, surveyOptionGroup, surveyOptionsFor, surveyQuestionsFor, surveyQuestionValid, toggleSurveyOption, type SurveyAnswers } from '../src/utils/researchSurvey';

export default function ResearchSurveyScreen() {
    const c = useCommunityColors(), { t, currentLanguage } = useTranslation(), router = useRouter();
    const user = useAuthStore(s => s.session?.user.id);
    const [answers, setAnswers] = useState<SurveyAnswers>({});
    const [step, setStep] = useState(0), [readyUser, setReadyUser] = useState<string | null>(null);
    const [loadError, setLoadError] = useState(false), [retry, setRetry] = useState(0);
    const [sent, setSent] = useState(false), [busy, setBusy] = useState(false);
    const [saveError, setSaveError] = useState(false), [saving, setSaving] = useState(false), [sendError, setSendError] = useState(false);
    const questions = surveyQuestionsFor(answers), index = Math.min(step, questions.length), review = index === questions.length;
    const question = questions[Math.min(index, questions.length - 1)];
    const scroll = useRef<ComponentRef<typeof ScrollView>>(null), lock = useRef(false), activeUser = useRef(user);
    const latest = useRef({ answers, step, sent });
    activeUser.current = user; latest.current = { answers, step, sent };
    useEffect(() => {
        let active = true;
        setReadyUser(null); setAnswers({}); setStep(0); setSent(false); setLoadError(false);
        if (user) void Promise.all([readSurveyDraft(user), getSurveyResponse(user).catch(() => null)]).then(([draft, submitted]) => {
            if (!active) return;
            setAnswers(draft.answers); setStep(draft.step); setSent(!!submitted); setReadyUser(user);
            if (submitted) void changeResearchInvitation(user, previous => ({ ...previous, shown: true, interested: true, submitted: true })).catch(() => {});
        }).catch(() => { if (active) setLoadError(true); });
        return () => { active = false; };
    }, [user, retry]);
    useEffect(() => {
        if (!user || readyUser !== user || sent) return;
        let active = true; setSaving(true);
        const timer = setTimeout(() => {
            void saveSurveyDraft(user, { answers, step }).then(() => { if (active) setSaveError(false); }).catch(() => { if (active) setSaveError(true); }).finally(() => { if (active) setSaving(false); });
        }, 300);
        return () => { active = false; clearTimeout(timer); };
    }, [user, readyUser, answers, step, sent]);
    useEffect(() => {
        if (!user || readyUser !== user) return;
        const flush = () => {
            const draft = latest.current;
            if (!draft.sent) void saveSurveyDraft(user, { answers: draft.answers, step: draft.step }).catch(() => {});
        };
        const listener = AppState.addEventListener('change', state => { if (state !== 'active') flush(); });
        return () => { listener.remove(); flush(); };
    }, [user, readyUser]);
    const close = async () => {
        if (lock.current) return;
        if (user && readyUser === user && !sent) {
            lock.current = true; setBusy(true);
            try { await saveSurveyDraft(user, { answers, step }); }
            catch { setSaveError(true); setBusy(false); lock.current = false; return; }
            lock.current = false; setBusy(false);
        }
        if (router.canGoBack()) router.back(); else router.replace('/dashboard');
    };
    useEffect(() => {
        const listener = BackHandler.addEventListener('hardwareBackPress', () => { void close(); return true; });
        return () => listener.remove();
    });
    useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [index]);
    const submit = async () => {
        if (!user || lock.current || latest.current.sent || !surveyAnswersValid(answers)) return;
        const id = user;
        lock.current = true; setBusy(true); setSendError(false);
        try {
            await submitSurveyResponse(id, currentLanguage, answers);
            if (activeUser.current !== id) return;
            latest.current = { ...latest.current, sent: true }; setSent(true);
            captureAnalytics('research_survey_submitted', { survey_version: RESEARCH_SURVEY_VERSION }, id);
            await Promise.allSettled([clearSurveyDraft(id), changeResearchInvitation(id, previous => ({ ...previous, shown: true, interested: true, submitted: true }))]);
        } catch { if (activeUser.current === id) setSendError(true); }
        finally { lock.current = false; if (activeUser.current === id) setBusy(false); }
    };
    const update = (id: keyof SurveyAnswers, value: string | string[]) => { setAnswers(previous => ({ ...previous, [id]: value })); setSendError(false); };
    if (!user) return <Redirect href="/(auth)/login" />;
    const button = (label: string, onPress: () => void, disabled = false, id?: string) => <Pressable testID={id} accessibilityRole="button" accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress} style={{ minHeight: 52, borderRadius: 17, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', padding: 14, opacity: disabled ? 0.45 : 1 }}><Text style={{ color: c.onAccent, fontWeight: '700', fontSize: 15, textAlign: 'center' }}>{label}</Text></Pressable>;
    return <SafeAreaView testID="research-survey-screen" style={{ flex: 1, backgroundColor: c.bg }}>
        <Stack.Screen options={{ gestureEnabled: false }} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{ paddingHorizontal: 24, paddingVertical: 12, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <Text style={{ color: c.fg, fontSize: 12, letterSpacing: 1, fontWeight: '800' }}>DJ PLANNER</Text>
                    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void close()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.accent, fontWeight: '600' }}>{t(sent ? 'researchSurvey.close' : 'researchSurvey.saveExit')}</Text></Pressable>
                </View>
                {readyUser === user && !sent && <>
                    <View accessible={false} style={{ height: 4, borderRadius: 2, backgroundColor: c.border, overflow: 'hidden' }}><View style={{ height: 4, width: `${((Math.min(index + 1, questions.length)) / questions.length) * 100}%`, backgroundColor: c.accent }} /></View>
                    <Text accessibilityLiveRegion="polite" style={{ color: c.muted, fontSize: 12 }}>{review ? t('researchSurvey.reviewTitle') : t('researchSurvey.progress', { current: index + 1, total: questions.length })}</Text>
                </>}
            </View>
            {readyUser !== user ? <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 20 }}>{loadError ? <><Text style={{ color: c.fg }}>{t('researchSurvey.loadError')}</Text>{button(t('researchSurvey.retry'), () => setRetry(v => v + 1))}</> : <ActivityIndicator color={c.accent} />}</View> : sent ? <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 24 }}>
                <View style={{ width: 64, height: 64, borderRadius: 24, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' }}><Check size={30} color={c.accent} /></View>
                <Text accessibilityRole="header" style={{ color: c.fg, fontWeight: '800', fontSize: 29 }}>{t('researchSurvey.sentTitle')}</Text>
                <Text style={{ color: c.muted, fontSize: 16, lineHeight: 25 }}>{t('researchSurvey.sentBody')}</Text>
                {button(t('researchSurvey.finish'), () => void close(), busy)}
            </View> : <>
                <ScrollView ref={scroll} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingTop: 12, gap: 20 }}>
                    {review ? <>
                        <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 27, fontWeight: '800' }}>{t('researchSurvey.reviewTitle')}</Text>
                        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>{t('researchSurvey.submitNotice')}</Text>
                        {researchSurveyQuestionsForReview(answers).map(({ id, group, value, other }) => <View key={id} style={{ backgroundColor: c.card, borderRadius: 20, padding: 18, gap: 10 }}>
                            <Text style={{ color: c.fg, fontWeight: '700', lineHeight: 21 }}>{t(`researchSurvey.${id}`)}</Text>
                            <Text style={{ color: c.muted, lineHeight: 22 }}>{Array.isArray(value) ? value.map(v => t(`researchSurvey.${group}.${v}`)).join('\n') : group ? t(`researchSurvey.${group}.${value}`) : value || t('researchSurvey.noAnswer')}</Text>
                            {typeof other === 'string' && <Text style={{ color: c.muted }}>{other}</Text>}
                            <Pressable accessibilityRole="button" onPress={() => { const target = id === 'first' && !questions.some(q => q.id === 'first') ? 'priorities' : id; setStep(Math.max(0, questions.findIndex(q => q.id === target))); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.accent, fontWeight: '600' }}>{t('researchSurvey.edit')}</Text></Pressable>
                        </View>)}
                    </> : <>
                        <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 25, lineHeight: 32, fontWeight: '800' }}>{t(`researchSurvey.${question.id}`)}</Text>
                        {index === 0 && <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22 }}>{t('researchSurvey.intro')}</Text>}
                        <Text style={{ color: c.muted, fontSize: 13 }}>{t(question.kind === 'text' ? 'researchSurvey.optional' : question.id === 'priorities' ? 'researchSurvey.upToThree' : question.kind === 'multiple' ? 'researchSurvey.multiple' : 'researchSurvey.single')}</Text>
                        {question.kind === 'text' ? <TextInput testID="survey-text-answer" multiline maxLength={question.maxLength} accessibilityLabel={t(`researchSurvey.${question.id}`)} placeholder={t('researchSurvey.textPlaceholder')} placeholderTextColor={c.muted} value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''} onChangeText={value => update(question.id, value)} style={{ minHeight: 160, borderWidth: 1, borderColor: c.border, borderRadius: 20, backgroundColor: c.card, padding: 18, color: c.fg, fontSize: 16, lineHeight: 24, textAlignVertical: 'top' }} /> : <View style={{ gap: 10 }}>
                            {surveyOptionsFor(question, answers).map(option => {
                                const value = answers[question.id], multiple = question.kind === 'multiple';
                                const selected = multiple ? Array.isArray(value) && value.includes(option) : value === option;
                                const disabled = question.id === 'priorities' && Array.isArray(value) && value.length >= 3 && !selected && option !== 'none';
                                return <Pressable key={option} testID={`survey-option-${option}`} accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={() => update(question.id, multiple ? toggleSurveyOption(Array.isArray(value) ? value : [], option, question.id === 'priorities' ? 3 : Infinity) : option)} style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, borderWidth: selected ? 2 : 1, borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.tint : c.card, opacity: disabled ? 0.45 : 1 }}>
                                    <View style={{ width: 22, height: 22, borderRadius: multiple ? 6 : 11, borderWidth: selected ? 0 : 1.5, borderColor: c.muted, backgroundColor: selected ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{selected && <Check size={15} color={c.onAccent} />}</View>
                                    <Text style={{ flex: 1, color: c.fg, fontSize: 15, lineHeight: 22 }}>{t(`researchSurvey.${surveyOptionGroup(question)}.${option}`)}</Text>
                                </Pressable>;
                            })}
                        </View>}
                        {(question.id === 'tools' || question.id === 'priorities') && Array.isArray(answers[question.id]) && (answers[question.id] as string[]).includes('other') && <TextInput testID="survey-other-answer" maxLength={300} multiline accessibilityLabel={t('researchSurvey.otherPlaceholder')} placeholder={t('researchSurvey.otherPlaceholder')} placeholderTextColor={c.muted} value={typeof answers[`${question.id}Other`] === 'string' ? answers[`${question.id}Other`] as string : ''} onChangeText={value => update(`${question.id}Other`, value)} style={{ minHeight: 80, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 16, color: c.fg, textAlignVertical: 'top' }} />}
                        {question.kind === 'text' && <Text style={{ color: c.muted, fontSize: 12 }}>{t('researchSurvey.privacy')}</Text>}
                    </>}
                </ScrollView>
                <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, gap: 8 }}>
                    {(saveError || sendError) && <Text accessibilityRole="alert" style={{ color: c.fg, fontSize: 13, lineHeight: 20 }}>{t(sendError ? 'researchSurvey.sendError' : 'researchSurvey.saveError')}</Text>}
                    <Text accessibilityLiveRegion="polite" style={{ color: c.muted, fontSize: 11 }}>{t(saving ? 'researchSurvey.saving' : saveError ? 'researchSurvey.saveError' : 'researchSurvey.draftSaved')}</Text>
                    {button(t(busy ? 'researchSurvey.sending' : review ? 'researchSurvey.send' : index === questions.length - 1 ? 'researchSurvey.review' : 'researchSurvey.next'), () => { if (review) void submit(); else setStep(index + 1); }, busy || (review ? !surveyAnswersValid(answers) : !surveyQuestionValid(question, answers)), 'survey-next')}
                    {index > 0 && <Pressable accessibilityRole="button" disabled={busy} onPress={() => setStep(index - 1)} style={{ minHeight: 44, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 }}><ChevronLeft size={16} color={c.muted} /><Text style={{ color: c.muted }}>{t('researchSurvey.previous')}</Text></Pressable>}
                </View>
            </>}
        </KeyboardAvoidingView>
    </SafeAreaView>;
}

function researchSurveyQuestionsForReview(answers: SurveyAnswers) {
    const normalized = normalizeSurveyAnswers(answers);
    const visible = surveyQuestionsFor(normalized);
    const first = normalized.first;
    const result = visible.map(q => ({ id: q.id, group: q.kind === 'text' ? '' : surveyOptionGroup(q), value: normalized[q.id], other: q.id === 'tools' || q.id === 'priorities' ? normalized[`${q.id}Other`] : undefined }));
    if (typeof first === 'string' && !visible.some(q => q.id === 'first')) result.splice(result.length - 1, 0, { id: 'first', group: 'features', value: first, other: undefined });
    return result;
}
