import { captureAnalytics } from '../analytics';
import { useAuthStore } from '../store/useAuthStore';
import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';

export const VOICE_MAX_MS = 20000;
export const VOICE_MAX_BYTES = 204800;
export const VOICE_BUCKET = 'session-voice-notes';
export interface VoiceNote {
    id: string; user_id: string; session_id: string; venue_id: string | null;
    title: string; audio_path: string; duration_ms: number; ready: boolean;
    remind_next: boolean; resolved_at: string | null; created_at: string;
}
export interface VoiceSchedule {
    note_id: string; session_id: string; title: string; venue: string;
    date: string; start_time: string; booking_timezone: string | null;
}
export const voiceNotes = {
    async list(sessionId: string): Promise<VoiceNote[]> {
        const { data, error } = await supabase.from('session_voice_notes').select('*')
            .eq('session_id', sessionId).eq('ready', true).order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },
    async pending(sessionId: string): Promise<VoiceNote[]> {
        const { data, error } = await supabase.rpc('pending_voice_notes', { target_session: sessionId });
        if (error) throw error;
        return data || [];
    },
    async save(sessionId: string, uri: string, durationMs: number, title: string, remindNext: boolean): Promise<void> {
        const actorId = useAuthStore.getState().session?.user.id;
        if (Platform.OS === 'web') throw new Error('voiceNotes.mobileOnly');
        const bytes = await new File(uri).bytes();
        if (!bytes.length || bytes.length > VOICE_MAX_BYTES || durationMs < 1 || durationMs > VOICE_MAX_MS + 500)
            throw new Error('voiceNotes.invalidAudio');
        const { data: note, error } = await supabase.from('session_voice_notes').insert({
            session_id: sessionId, title: title.trim(), duration_ms: Math.min(VOICE_MAX_MS, Math.round(durationMs)), remind_next: remindNext,
        }).select('*').single();
        if (error) throw error;
        try {
            const upload = await supabase.storage.from(VOICE_BUCKET).upload(note.audio_path, bytes, { contentType: 'audio/mp4', upsert: false });
            if (upload.error) throw upload.error;
            const ready = await supabase.from('session_voice_notes').update({ ready: true }).eq('id', note.id).select('id').single();
            if (ready.error) throw ready.error;
            captureAnalytics('audio_note_saved', { reminder_enabled: remindNext }, actorId);
        } catch (failure) {
            await supabase.storage.from(VOICE_BUCKET).remove([note.audio_path]);
            await supabase.from('session_voice_notes').delete().eq('id', note.id);
            throw failure;
        }
    },
    async url(note: VoiceNote) {
        const { data, error } = await supabase.storage.from(VOICE_BUCKET).createSignedUrl(note.audio_path, 300);
        if (error) throw error;
        return data.signedUrl;
    },
    async remove(note: VoiceNote) {
        // Delete the file first; on failure leave its note available for retry.
        const { error } = await supabase.storage.from(VOICE_BUCKET).remove([note.audio_path]);
        if (error) throw error;
        const result = await supabase.from('session_voice_notes').delete().eq('id', note.id);
        if (result.error) throw result.error;
    },
    async remind(noteId: string, sessionId: string, enabled: boolean) {
        if (enabled) {
            const { error } = await supabase.from('session_voice_reminders').upsert({ note_id: noteId, session_id: sessionId }, { onConflict: 'note_id,session_id', ignoreDuplicates: true });
            if (error) throw error;
        } else {
            const { error } = await supabase.from('session_voice_reminders').delete().eq('note_id', noteId).eq('session_id', sessionId);
            if (error) throw error;
        }
    },
    async schedule(): Promise<VoiceSchedule[]> {
        const { data, error } = await supabase.rpc('voice_reminder_schedule');
        if (error) throw error;
        return data || [];
    },
};
