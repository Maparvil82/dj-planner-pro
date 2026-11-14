import { VoiceReminderSync } from '../voiceNotes/VoiceReminderSync';
import { useUnreadNotifications } from '../../hooks/useNotifications';
export function NotificationSync() {
    useUnreadNotifications(true);
    return <VoiceReminderSync />;
}
