import type { Session } from '../types/session';

const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

// RFC 5545 limits content lines to 75 UTF-8 octets. Never split a code point.
function foldLine(line: string): string {
    const lines: string[] = [];
    let current = '';
    let bytes = 0;
    for (const character of line) {
        const point = character.codePointAt(0)!;
        const size = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
        if (bytes + size > 75) { lines.push(current); current = ' '; bytes = 1; }
        current += character;
        bytes += size;
    }
    lines.push(current);
    return lines.join('\r\n');
}

export function buildSessionCalendar(session: Session, now = new Date(), displayTitle = session.title.trim() || session.venue): string {
    const startTime = session.start_time || '00:00';
    const endTime = session.end_time || '00:00';
    const start = `${session.date.replace(/-/g, '')}T${startTime.slice(0, 5).replace(':', '')}00`;
    const endDate = new Date(`${session.date}T12:00:00Z`);
    if (endTime.slice(0, 5) <= startTime.slice(0, 5)) endDate.setUTCDate(endDate.getUTCDate() + 1);
    const end = `${endDate.toISOString().slice(0, 10).replace(/-/g, '')}T${endTime.slice(0, 5).replace(':', '')}00`;
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    return [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DJ Planner Pro//Sessions//EN', 'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT', `UID:${session.id}@djplannerpro`, `DTSTAMP:${stamp}`,
        // Floating local times preserve the hours entered in the app, which has no venue timezone field.
        `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${escapeText(displayTitle)}`, `LOCATION:${escapeText(session.venue)}`,
        `STATUS:${session.status === 'cancelled' ? 'CANCELLED' : session.status === 'pending' ? 'TENTATIVE' : 'CONFIRMED'}`,
        ...(session.status === 'cancelled' ? [] : ['BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(displayTitle)}`, 'END:VALARM']),
        'END:VEVENT', 'END:VCALENDAR', ''
    ].map(foldLine).join('\r\n');
}
