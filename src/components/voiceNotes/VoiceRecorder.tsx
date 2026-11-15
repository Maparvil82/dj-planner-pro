import { type ComponentRef, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Square, X } from 'lucide-react-native';
import { File } from 'expo-file-system';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useCommunityColors } from '../community/communityColors';
import { useTranslation } from '../../i18n/useTranslation';
import { voiceNotes, VOICE_MAX_MS } from '../../services/voiceNotes';
import { voiceRecordingTransition } from '../../utils/voiceRecordingFlow';
import { confirmAction } from '../../utils/confirmAction';
import { RecordingWaveform } from './RecordingWaveform';
import { showError } from '../../utils/showError';

export default function VoiceRecorder({ sessionId, hasVenue, venueName, onSaved }: {
    sessionId: string; hasVenue: boolean; venueName: string; onSaved: () => void;
}) {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const [step, send] = useReducer(voiceRecordingTransition, 'closed');
    const [uri, setUri] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const [title, setTitle] = useState('');
    const [saveError, setSaveError] = useState(false);
    const lock = useRef(false);
    const uriRef = useRef<string | null>(null);
    const elapsed = useRef(0);
    const capturing = useRef(false);
    const mounted = useRef(true);
    const nameInput = useRef<ComponentRef<typeof TextInput>>(null);
    const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY,
        sampleRate: 22050, numberOfChannels: 1, bitRate: 48000, isMeteringEnabled: true });
    const state = useAudioRecorderState(recorder, 100);
    const player = useAudioPlayer(uri);
    const recordingDuration = state.isRecording ? state.durationMillis : 0;

    const finish = useCallback(async () => {
        if (lock.current || !capturing.current) return;
        capturing.current = false;
        lock.current = true;
        try {
            elapsed.current = Math.max(elapsed.current, recorder.getStatus().durationMillis);
            if (recorder.isRecording) await recorder.stop();
            const recording = recorder.uri;
            if (!recording) throw new Error('Missing recording');
            if (mounted.current) {
                uriRef.current = recording;
                setUri(recording);
                setDuration(Math.max(1, Math.min(VOICE_MAX_MS, elapsed.current)));
                send('STOPPED');
            }
        } catch {
            if (mounted.current) { send('FAILED'); showError(t('error'), t('voiceNotes.recordError')); }
        } finally {
            await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
            lock.current = false;
        }
    }, [recorder, t]);
    useEffect(() => {
        if (step !== 'recording' || !capturing.current) return;
        const current = recorder.getStatus();
        elapsed.current = Math.max(elapsed.current, current.durationMillis);
        if (current.durationMillis >= VOICE_MAX_MS || (!current.isRecording && current.durationMillis > 0)) void finish();
    }, [step, state.durationMillis, state.isRecording, finish, recorder]);
    useEffect(() => {
        const sub = AppState.addEventListener('change', value => {
            if (value !== 'active' && capturing.current) void finish();
        });
        return () => sub.remove();
    }, [finish]);
    useEffect(() => {
        if (step !== 'name') return;
        const timer = setTimeout(() => nameInput.current?.focus(), 150);
        return () => clearTimeout(timer);
    }, [step]);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
            if (uriRef.current) try { new File(uriRef.current).delete(); } catch {}
        };
    }, []);
    const discard = () => {
        player.pause(); player.replace(null);
        if (uriRef.current) try { new File(uriRef.current).delete(); } catch {}
        uriRef.current = null; setUri(null); elapsed.current = 0; setDuration(0);
        setTitle(''); setSaveError(false); send('DISCARD');
    };
    const start = async () => {
        if (lock.current || step !== 'closed') return;
        lock.current = true; send('START');
        try {
            if (!(await AudioModule.requestRecordingPermissionsAsync()).granted) throw new Error('voiceNotes.microphonePermission');
            if (!mounted.current) return;
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
            await recorder.prepareToRecordAsync();
            if (!mounted.current) return;
            elapsed.current = 0;
            capturing.current = true;
            recorder.record({ forDuration: 20 });
            send('READY');
        } catch (error) {
            capturing.current = false;
            if (mounted.current) {
                send('FAILED');
                showError(t('error'), t(error instanceof Error && error.message === 'voiceNotes.microphonePermission' ? error.message : 'voiceNotes.recordError'));
            }
            await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
        } finally { lock.current = false; }
    };
    const save = async (remind: boolean) => {
        if (!uri || lock.current || step !== 'reminder' || !title.trim()) return;
        lock.current = true; send('SAVE'); setSaveError(false); player.pause();
        try {
            await voiceNotes.save(sessionId, uri, duration, title.trim(), hasVenue && remind);
            if (mounted.current) { discard(); onSaved(); }
        } catch {
            if (mounted.current) { send('FAILED'); setSaveError(true); }
        } finally { lock.current = false; }
    };
    const close = async () => {
        if (lock.current || step === 'preparing' || step === 'saving') return;
        if (step === 'recording') { await finish(); return; }
        if (await confirmAction(t('voiceNotes.discard'), t('voiceNotes.discardConfirm'), t('cancel'), t('voiceNotes.discard'))) discard();
    };
    const next = () => {
        if (!title.trim()) return;
        Keyboard.dismiss(); player.pause(); send('NAMED');
    };
    const button = (label: string, action: () => void, secondary = false, disabled = false) => <Pressable
        accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={action}
        style={{ minHeight: 54, padding: 16, borderRadius: 16, backgroundColor: secondary ? c.field : c.accent,
            borderWidth: secondary ? 1 : 0, borderColor: c.border, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1 }}>
        <Text style={{ color: secondary ? c.fg : c.onAccent, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
    </Pressable>;
    return <View style={{ gap: 12 }}>
        <Text style={{ color: c.muted }}>{t('voiceNotes.limit')}</Text>
        {button(t('voiceNotes.record'), () => void start())}
        <Modal visible={step !== 'closed'} animationType="slide" transparent statusBarTranslucent onRequestClose={() => void close()}>
            <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <Pressable accessible={false} importantForAccessibility="no-hide-descendants"
                    disabled={step === 'preparing' || step === 'saving'} onPress={() => void close()}
                    style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
                <SafeAreaView testID="voice-recording-sheet" accessibilityViewIsModal edges={['bottom']}
                    style={{ maxHeight: '90%', backgroundColor: c.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 10 }}>
                    <View accessible={false} style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center', marginBottom: 16 }} />
                    <View style={{ paddingHorizontal: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 44 }} />
                        <View style={{ flex: 1, gap: 5, alignItems: 'center' }}>
                            <Text accessibilityRole="header" style={{ color: c.fg, fontWeight: '800', fontSize: 20, textAlign: 'center' }}>{t('voiceNotes.title')}</Text>
                            <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>{venueName} · PRO</Text>
                        </View>
                        <Pressable accessibilityRole="button" accessibilityLabel={t('voiceNotes.close')}
                            accessibilityState={{ disabled: step === 'preparing' || step === 'saving' }} disabled={step === 'preparing' || step === 'saving'}
                            onPress={() => void close()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.field, alignItems: 'center', justifyContent: 'center' }}>
                            <X size={22} color={c.muted} />
                        </Pressable>
                    </View>
                    <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ padding: 24, gap: 24 }}>
                        {step === 'preparing' ? <><ActivityIndicator size="large" color={c.accent} /><Text style={{ color: c.fg, textAlign: 'center' }}>{t('voiceNotes.preparing')}</Text></> :
                        step === 'recording' ? <View style={{ alignItems: 'center', gap: 24 }}>
                            <Text style={{ color: c.muted, fontSize: 14 }}>{t('voiceNotes.recordingTitle')}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                                <Text style={{ color: c.fg, fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] }}>00:{String(Math.min(20, Math.floor(recordingDuration / 1000))).padStart(2, '0')}</Text>
                                <Text style={{ color: c.muted, fontSize: 15 }}>/ 00:20</Text>
                            </View>
                            <RecordingWaveform metering={state.isRecording ? state.metering : undefined} durationMillis={recordingDuration} maxDurationMillis={VOICE_MAX_MS}
                                color={c.fg} inactiveColor={c.border} label={t('voiceNotes.waveform')} />
                            <Text style={{ color: c.muted, textAlign: 'center', fontSize: 13 }}>{t('voiceNotes.autoStop')}</Text>
                            <Pressable accessibilityRole="button" accessibilityLabel={t('voiceNotes.stop')} onPress={() => void finish()}
                                style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}><Square size={26} fill={c.onAccent} color={c.onAccent} /></Pressable>
                        </View> : step === 'review' ? <>
                            <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 28, fontWeight: '800', textAlign: 'center' }}>{t('voiceNotes.keepQuestion')}</Text>
                            <Text style={{ color: c.muted, textAlign: 'center' }}>{t('voiceNotes.recordedDuration', { seconds: Math.ceil(duration / 1000) })}</Text>
                            {button(t('voiceNotes.preview'), () => { void player.seekTo(0).then(() => player.play()).catch(() => showError(t('error'), t('voiceNotes.playError'))); }, true)}
                            {button(t('voiceNotes.keepYes'), () => { player.pause(); send('KEEP'); })}
                            {button(t('voiceNotes.keepNo'), discard, true)}
                        </> : step === 'name' ? <>
                            <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 28, fontWeight: '800' }}>{t('voiceNotes.nameQuestion')}</Text>
                            <TextInput ref={nameInput} value={title} onChangeText={setTitle} maxLength={120}
                                placeholder={t('voiceNotes.namePlaceholder')} accessibilityLabel={t('voiceNotes.nameQuestion')}
                                placeholderTextColor={c.muted} returnKeyType="next" onSubmitEditing={next}
                                style={{ color: c.fg, backgroundColor: c.field, borderColor: c.border, borderWidth: 1, borderRadius: 16, padding: 18, fontSize: 18, minHeight: 58 }} />
                            {button(t('voiceNotes.continue'), next, false, !title.trim())}
                        </> : step === 'reminder' ? <>
                            <Text style={{ color: c.accent, fontSize: 18, fontWeight: '700' }}>{title.trim()}</Text>
                            <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 28, fontWeight: '800' }}>{t(hasVenue ? 'voiceNotes.reminderQuestion' : 'voiceNotes.noVenue', { venue: venueName })}</Text>
                            {saveError && <Text accessibilityRole="alert" style={{ color: c.fg }}>{t('voiceNotes.saveError')}</Text>}
                            {hasVenue && button(t('voiceNotes.reminderYes'), () => void save(true))}
                            {button(t(hasVenue ? 'voiceNotes.reminderNo' : 'voiceNotes.save'), () => void save(false), hasVenue)}
                        </> : <><ActivityIndicator size="large" color={c.accent} /><Text accessibilityLiveRegion="polite" style={{ color: c.fg, textAlign: 'center', fontSize: 20 }}>{t('voiceNotes.saving')}</Text></>}
                    </ScrollView>
                </SafeAreaView>
            </KeyboardAvoidingView>
        </Modal>
    </View>;
}
