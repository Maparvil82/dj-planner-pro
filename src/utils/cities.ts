// Keep equality consistent with community_private.filter_key in Postgres.
const accented = 'áàâäãåéèêëíìîïóòôöõúùûüñç';
const plain = 'aaaaaaeeeeiiiiooooouuuunc';

export function normalizeCity(value: string): string {
    return value
        .normalize('NFC')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .replace(
            /(^|[\s\-'’])(\p{L})/gu,
            (_, separator, letter) => separator + letter.toUpperCase(),
        );
}

export function cityKey(value: string): string {
    return value
        .normalize('NFC')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .replace(
            /[áàâäãåéèêëíìîïóòôöõúùûüñç]/g,
            (letter) => plain[accented.indexOf(letter)],
        );
}

export function suggestCities(query: string, cities: string[]): string[] {
    const key = cityKey(query);
    if (key.length < 2) return [];
    const unique = new Map<string, string>();
    for (const city of cities) {
        const normalized = normalizeCity(city);
        const candidate = cityKey(normalized);
        if (candidate.includes(key) && !unique.has(candidate)) {
            unique.set(candidate, normalized);
        }
    }
    return [...unique.values()]
        .sort((a, b) => {
            const rank = (city: string) => {
                const candidate = cityKey(city);
                return candidate === key
                    ? 0
                    : candidate.startsWith(key)
                      ? 1
                      : 2;
            };
            return rank(a) - rank(b) || a.localeCompare(b);
        })
        .slice(0, 6);
}
