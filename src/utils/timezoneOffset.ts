/** Numeric date parts work on native engines that misreport shortOffset as GMT. */
export function formatTimezoneOffset(timeZone: string, date: string): string {
    try {
        const instant = new Date(`${date}T12:00:00Z`);
        const parts = Object.fromEntries(
            new Intl.DateTimeFormat('en-US-u-nu-latn', {
                timeZone,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false,
            }).formatToParts(instant).map((part) => [part.type, part.value]),
        );
        const localAsUTC = Date.UTC(Number(parts.year), Number(parts.month) - 1,
            Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
        const minutes = Math.round((localAsUTC - instant.getTime()) / 60000);
        if (!Number.isFinite(minutes)) return '';
        if (minutes === 0) return 'GMT';
        const absolute = Math.abs(minutes);
        const remainder = absolute % 60;
        return `GMT${minutes > 0 ? '+' : '-'}${Math.floor(absolute / 60)}${remainder ? `:${String(remainder).padStart(2, '0')}` : ''}`;
    } catch {
        return '';
    }
}
