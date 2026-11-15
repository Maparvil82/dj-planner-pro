import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useResearchOverlayStore } from '../../store/useResearchOverlayStore';
import { useEffect, useRef, useState } from 'react';
import { AppState, ImageBackground, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommunityColors } from '../community/communityColors';
import { useTranslation } from '../../i18n/useTranslation';
import { useAuthStore } from '../../store/useAuthStore';
import { changeResearchInvitation, readResearchInvitation, researchVisit } from '../../services/researchInvitation';
import { eligibleForResearch, type ResearchInvitation as InvitationState } from '../../utils/researchInvitation';
import { clearSurveyDraft, getSurveyResponse } from '../../services/researchSurvey';

export function useResearchInvitation(hasCompleted: boolean) {
    const user = useAuthStore(s => s.session?.user);
    const focused = useIsFocused();
    const router = useRouter();
    const surveyPending = useRef(false);
    const updatesVisible = useResearchOverlayStore(s => s.updatesVisible);
    const focusedRef = useRef(focused);
    focusedRef.current = focused;
    const [record, setRecord] = useState<InvitationState | null>(null);
    const [visible, setVisible] = useState(false);
    const [thanks, setThanks] = useState(false);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const locked = useRef(false);
    const currentUser = useRef(user?.id);
    currentUser.current = user?.id;
    const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
    useEffect(() => {
        let active = true;
        cancel(); setVisible(false); setRecord(null);
        if (focused && user?.id) {
            const id = user.id;
            void (async () => {
                const local = await readResearchInvitation(id);
                if (!active) return;
                setRecord(local);
                // A server reset or submission on another device must win over local history.
                const response = await getSurveyResponse(id);
                if (!active) return;
                if (!response && local.submitted) await clearSurveyDraft(id);
                if (!active) return;
                const next = await changeResearchInvitation(id, previous => ({
                    ...previous,
                    submitted: !!response,
                    interested: response || previous.submitted ? true : previous.interested,
                }));
                if (active) setRecord(next);
            })().catch(() => {});
        }
        return () => { active = false; cancel(); };
    }, [focused, user?.id]);
    useEffect(() => {
        const listener = AppState.addEventListener('change', state => { if (state !== 'active') { cancel(); setVisible(false); } });
        return () => listener.remove();
    }, []);
    useEffect(() => { if (updatesVisible) { cancel(); setVisible(false); } }, [updatesVisible]);
    const open = async (automatic = false) => {
        const id = user?.id;
        if (!id || locked.current || !focused || useResearchOverlayStore.getState().updatesVisible) return;
        cancel(); locked.current = true; setBusy(true); setFailed(false);
        try {
            const next = await readResearchInvitation(id);
            if (automatic && !eligibleForResearch(next, researchVisit(), user.created_at, hasCompleted)) return;
            if (!automatic && next.interested && !next.submitted) { router.push('/research-survey'); return; }
            const saved = await changeResearchInvitation(id, previous => ({ ...previous, shown: true }));
            if (currentUser.current !== id || !focusedRef.current || useResearchOverlayStore.getState().updatesVisible || AppState.currentState !== 'active') return;
            setRecord(saved); setThanks(!!saved.submitted); setVisible(true);
        } catch { if (!automatic) setFailed(true); }
        finally { locked.current = false; setBusy(false); }
    };
    const afterConsultation = () => {
        cancel();
        if (!user || !record || !focused || updatesVisible || !eligibleForResearch(record, researchVisit(), user.created_at, hasCompleted)) return;
        timer.current = setTimeout(() => { void open(true); }, 20000);
    };
    const participate = async () => {
        if (!user?.id || locked.current) return;
        const id = user.id;
        locked.current = true; setBusy(true); setFailed(false);
        try {
            const saved = await changeResearchInvitation(id, previous => ({ ...previous, shown: true, interested: true }));
            if (currentUser.current === id) { setRecord(saved); surveyPending.current = true; setVisible(false); }
        } catch { setFailed(true); }
        finally { locked.current = false; setBusy(false); }
    };
    const openSurveyAfterClose = () => {
        if (!surveyPending.current) return;
        surveyPending.current = false;
        router.push('/research-survey');
    };
    useEffect(() => { if (!visible && Platform.OS !== 'ios') openSurveyAfterClose(); }, [visible]);
    return { openSurveyAfterClose, visible: visible && focused, thanks, busy, failed, interested: !!record?.interested, submitted: !!record?.submitted, open: () => void open(), close: () => setVisible(false), participate: () => void participate(), cancel, afterConsultation };
}

export function ResearchInvitationCard({ invitation }: { invitation: ReturnType<typeof useResearchInvitation> }) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    if (invitation.submitted) return null;
    const background = c.accent;
    const foreground = c.onAccent;
    return <View testID="research-invitation-surface" style={{ borderRadius: 24, backgroundColor: background, padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: foreground }}>{t('research.cardTitle')}</Text>
        <Text style={{ color: foreground, fontSize: 14, lineHeight: 21 }}>{t(invitation.submitted ? 'research.thanksBody' : invitation.interested ? 'research.savedCard' : 'research.cardBody')}</Text>
        {!invitation.submitted && <Pressable testID="research-invitation-card" accessibilityRole="button" accessibilityLabel={t(invitation.interested ? 'research.viewInvitation' : 'research.participate')} disabled={invitation.busy} onPress={invitation.open} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', opacity: invitation.busy ? 0.6 : 1 }}>
            <Text style={{ color: foreground, fontWeight: '700', fontSize: 14, textDecorationLine: 'underline' }}>{t(invitation.interested ? 'research.viewInvitation' : 'research.participate')}</Text>
        </Pressable>}
        {invitation.failed && <Text accessibilityRole="alert" style={{ color: foreground }}>{t('research.error')}</Text>}
    </View>;
}

export function ResearchInvitationModal({ invitation }: { invitation: ReturnType<typeof useResearchInvitation> }) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const { height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    return <Modal visible={invitation.visible} transparent={false} presentationStyle="fullScreen" animationType="slide" statusBarTranslucent navigationBarTranslucent onDismiss={invitation.openSurveyAfterClose} onRequestClose={invitation.close}>
        {invitation.visible && <StatusBar style="light" />}
        <View style={{ flex: 1, backgroundColor: c.card, paddingLeft: insets.left, paddingRight: insets.right }}>
            <View accessibilityViewIsModal testID="research-invitation-modal" style={{ flex: 1, backgroundColor: c.card, width: '100%', overflow: 'hidden' }}>
                <ScrollView bounces={false} style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                    <ImageBackground testID="research-invitation-image" source={require('../../../assets/research/dj-collaboration-v1.png')} resizeMode="cover" style={{ width: '100%', height: Math.min(280, Math.max(190, height * 0.3)) + insets.top, backgroundColor: '#171717', padding: 16, paddingTop: insets.top + 12 }}>
                        <LinearGradient pointerEvents="none" colors={['#00000088', '#00000000']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, flex: 1, paddingLeft: 8 }}>DJ PLANNER</Text>
                        </View>
                    </ImageBackground>
                    <View style={{ backgroundColor: c.accent, padding: 24, paddingTop: 20, paddingBottom: 24 }}>
                        <View style={{ gap: 12 }}>
                            {invitation.thanks ? <Check size={28} color={c.onAccent} /> : <Text style={{ color: c.onAccent, fontSize: 13, lineHeight: 19, fontWeight: '600' }}>{t('research.eyebrow')}</Text>}
                            <Text accessibilityRole="header" style={{ color: c.onAccent, fontSize: 29, lineHeight: 34, fontWeight: '800', letterSpacing: -0.8 }}>{t(invitation.thanks ? 'research.thanksTitle' : 'research.title')}</Text>
                        </View>
                    </View>
                    <View style={{ padding: 24, gap: 20 }}>
                        <Text style={{ color: c.fg, fontSize: 16, lineHeight: 25 }}>{t(invitation.thanks ? 'research.thanksBody' : 'research.body')}</Text>
                        {invitation.failed && <Text accessibilityRole="alert" style={{ color: c.muted }}>{t('research.error')}</Text>}
                    </View>
                </ScrollView>
                <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16), gap: 6 }}>
                    {!invitation.thanks && <View style={{ paddingLeft: 14, borderLeftWidth: 3, borderColor: c.accent, marginBottom: 14 }}><Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>{t('research.purpose')}</Text></View>}
                    <Pressable testID="research-participate" accessibilityRole="button" disabled={invitation.busy} onPress={invitation.thanks ? invitation.close : invitation.participate} style={{ minHeight: 54, borderRadius: 17, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', padding: 14, opacity: invitation.busy ? 0.6 : 1 }}><Text style={{ color: c.onAccent, fontWeight: '700', fontSize: 15 }}>{t(invitation.thanks ? 'research.done' : 'research.join')}</Text></Pressable>
                    {!invitation.thanks && <Pressable accessibilityRole="button" onPress={invitation.close} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.muted, fontSize: 14 }}>{t('research.later')}</Text></Pressable>}
                </View>
            </View>
        </View>
    </Modal>;
}
