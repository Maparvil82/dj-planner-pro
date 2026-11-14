import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { useSessionUsage } from '../../hooks/useSessionUsage';
import { useAuthStore } from '../../store/useAuthStore';
import { useCommunityColors } from '../community/communityColors';
import { voiceNotes, type VoiceNote } from '../../services/voiceNotes';
import { requestVoiceNotifications } from '../../services/voiceNotifications';
import { confirmAction } from '../../utils/confirmAction';
import { voiceReminderPlan } from '../../utils/voiceReminders';
import { showError } from '../../utils/showError';
import type { Session } from '../../types/session';
const Recorder = lazy(() => import('./VoiceRecorder'));

function VoiceNoteRow({ note, target, selected, changed, pro, canSchedule = true }: { note: VoiceNote; target?: string; selected?: boolean; changed: () => void; pro: boolean; canSchedule?: boolean }) {
    const { t, dateLocale } = useTranslation();
    const c = useCommunityColors();
    const [busy, setBusy] = useState(false);
    const [playing, setPlaying] = useState(false);
    const player = useRef<import('expo-audio').AudioPlayer | null>(null);
    useEffect(() => () => { player.current?.remove(); }, []);
    const action = async (fn: () => Promise<void>) => {
        if (busy) return;
        setBusy(true);
        try { await fn(); changed(); } catch { showError(t('error'), t('voiceNotes.actionError')); }
        finally { setBusy(false); }
    };
    const play = async () => {
        if (busy) return;
        if (playing) { player.current?.pause(); setPlaying(false); return; }
        setBusy(true);
        try {
            const audio = await import('expo-audio');
            await audio.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
            player.current?.remove();
            player.current = audio.createAudioPlayer(await voiceNotes.url(note));
            player.current.addListener('playbackStatusUpdate', status => { if (status.didJustFinish) setPlaying(false); });
            player.current.play(); setPlaying(true);
        } catch { showError(t('error'), t('voiceNotes.playError')); }
        finally { setBusy(false); }
    };
    const button = (label: string, fn: () => void) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={fn} style={{ minHeight: 44, justifyContent: 'center', paddingVertical: 8 }}>
        <Text style={{ color: c.accent, fontWeight: '700' }}>{label}</Text></Pressable>;
    return <View style={{ borderTopWidth: 1, borderColor: c.border, paddingTop: 12, gap: 4 }}>
        <Text style={{ color: c.fg, fontWeight: '700' }}>{note.title || t('voiceNotes.untitled')}</Text>
        <Text style={{ color: c.muted }}>{new Date(note.created_at).toLocaleDateString(dateLocale)} · {Math.ceil(note.duration_ms / 1000)} s</Text>
        {button(t(playing ? 'voiceNotes.pause' : 'voiceNotes.play'), () => void play())}
        {pro && target && !note.resolved_at && (canSchedule || selected) && button(t(selected ? 'voiceNotes.cancelReminder' : 'voiceNotes.dayBefore'), () => void action(async () => {
            if (!selected && !(await requestVoiceNotifications())) { showError(t('voiceNotes.title'), t('voiceNotes.notificationsPermission')); return; }
            await voiceNotes.remind(note.id, target, !selected);
        }))}
        {!target && button(t('voiceNotes.delete'), () => void action(async () => {
            if (await confirmAction(t('voiceNotes.delete'), t('voiceNotes.deleteConfirm'), t('cancel'), t('voiceNotes.delete'))) await voiceNotes.remove(note);
        }))}
    </View>;
}

export function VoiceNotesCard({ session, openPending = false, showTitle = true }: { session: Session; openPending?: boolean; showTitle?: boolean }) {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const router = useRouter();
    const userId = useAuthStore(s => s.session?.user.id);
    const usage = useSessionUsage();
    const pro = usage.data?.isPro === true;
    const client = useQueryClient();
    const [open, setOpen] = useState(openPending);
    const supported = Platform.OS !== 'web' && !!requireOptionalNativeModule('ExpoAudio');
    const notes = useQuery({ queryKey: ['voice-notes', userId, session.id], queryFn: () => voiceNotes.list(session.id), retry: false });
    const pending = useQuery({ queryKey: ['voice-notes', 'pending', userId, session.id], enabled: pro && !!session.venue_id,
        queryFn: () => voiceNotes.pending(session.id), retry: false });
    const selected = useQuery({ queryKey: ['voice-schedule', userId], enabled: pro, queryFn: () => voiceNotes.schedule(), retry: false });
    const changed = () => {
        void client.invalidateQueries({ queryKey: ['voice-notes'] });
        void client.invalidateQueries({ queryKey: ['voice-schedule'] });
    };
    return <View testID="session-voice-notes" style={{ backgroundColor: c.card, borderColor: c.border, borderWidth: c.dark ? 0 : 1, borderRadius: 24, padding: 20, gap: 14 }}>
        {showTitle && <Text accessibilityRole="header" style={{ color: c.cardText, fontSize: 19, fontWeight: '800' }}>🎙️ {t('voiceNotes.title')} · PRO</Text>}
        <Text style={{ color: c.muted, fontSize: 15, lineHeight: 22 }}>{t('voiceNotes.proHint')}</Text>
        {usage.isPending ? <ActivityIndicator color={c.accent} /> : pro ? supported ?
            <Suspense fallback={<ActivityIndicator color={c.accent} />}><Recorder sessionId={session.id} hasVenue={!!session.venue_id} venueName={session.venue} onSaved={changed} /></Suspense>
            : <Text style={{ color: c.muted }}>{t(Platform.OS === 'web' ? 'voiceNotes.mobileOnly' : 'voiceNotes.updateRequired')}</Text>
            : <Pressable accessibilityRole="button" onPress={() => router.push('/paywall')} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ color: c.accent }}>{t('voiceNotes.proAction')}</Text>
            </Pressable>}
        {notes.isError && <Pressable accessibilityRole="button" onPress={() => void notes.refetch()} style={{ minHeight: 44 }}><Text style={{ color: c.muted }}>{t('voiceNotes.loadError')}</Text></Pressable>}
        {supported && notes.data?.map(note => <VoiceNoteRow key={note.id} note={note} changed={changed} pro={pro} />)}
        {!!pending.data?.length && <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: c.accent, fontWeight: '700' }}>{t('voiceNotes.pending', { count: pending.data.length, venue: session.venue })}</Text>
        </Pressable>}
        <Modal visible={open && pro} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
            <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 20 }}>
                <View accessibilityViewIsModal style={{ backgroundColor: c.card, borderRadius: 24, padding: 20, maxHeight: '85%', gap: 12 }}>
                    <Text accessibilityRole="header" style={{ color: c.cardText, fontSize: 20, fontWeight: '800' }}>{t('voiceNotes.pendingTitle', { venue: session.venue })}</Text>
                    <ScrollView>{pending.isPending ? <ActivityIndicator /> : pending.isError ? <Text style={{ color: c.muted }} onPress={() => void pending.refetch()}>{t('voiceNotes.loadError')}</Text> : !pending.data?.length ? <Text style={{ color: c.muted }}>{t('voiceNotes.noPending')}</Text> : pending.data.map(note =>
                        <VoiceNoteRow key={note.id} note={note} target={session.id} pro={pro} canSchedule={voiceReminderPlan([{ note_id: note.id, session_id: session.id, title: note.title, venue: session.venue, date: session.date, start_time: session.start_time, booking_timezone: session.booking_timezone || null }]).length > 0} selected={selected.data?.some(x => x.note_id === note.id && x.session_id === session.id)} changed={changed} />)}</ScrollView>
                    <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.accent, fontWeight: '700' }}>{t('voiceNotes.close')}</Text></Pressable>
                </View>
            </View>
        </Modal>
    </View>;
}
