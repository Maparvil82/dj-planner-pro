import { sessionRange } from './sessionPlanning';
import type { VoiceSchedule } from '../services/voiceNotes';

export const VOICE_NOTIFICATION_PREFIX = 'dj-voice:';
export function voiceReminderPlan(rows: VoiceSchedule[], now = Date.now()) {
    return rows.map(row => {
        const start = sessionRange({ ...row, end_time: row.start_time }).start;
        // Previous calendar day at the same venue-local time, including DST changes.
        const previous = new Date(`${row.date}T12:00:00Z`);
        previous.setUTCDate(previous.getUTCDate() - 1);
        const date = previous.toISOString().slice(0, 10);
        const at = sessionRange({ ...row, date, end_time: row.start_time }).start;
        return { ...row, at, start, identifier: `${VOICE_NOTIFICATION_PREFIX}${row.note_id}:${row.session_id}` };
    }).filter(row => row.at.getTime() > now && row.start.getTime() > now)
        .sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 50);
}
