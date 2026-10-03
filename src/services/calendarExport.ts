import i18n from '../i18n';
import { sessionDisplayTitle } from '../utils/sessionNaming';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Session } from '../types/session';
import { buildSessionCalendar } from '../utils/sessionCalendar';

export async function exportSessionCalendar(session: Session): Promise<void> {
    const content = buildSessionCalendar(session, new Date(), sessionDisplayTitle(session, i18n.t));
    const filename = `dj-session-${session.id}.ics`;
    if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
    }
    if (!(await Sharing.isAvailableAsync())) throw new Error('calendar_export_unavailable');
    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true });
    file.write(content);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', UTI: 'public.calendar-event' });
}
