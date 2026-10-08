export const MUSIC_GENRES = [
    'House',
    'Deep House',
    'Tech House',
    'Progressive House',
    'Afro House',
    'Organic House',
    'Melodic House',
    'Disco House',
    'Soulful House',
    'Techno',
    'Melodic Techno',
    'Hard Techno',
    'Minimal',
    'Trance',
    'Progressive Trance',
    'Psytrance',
    'Drum & Bass',
    'Jungle',
    'Dubstep',
    'UK Garage',
    'Bass House',
    'Breakbeat',
    'Electro',
    'Electronica',
    'Ambient',
    'Downtempo',
    'Disco',
    'Nu Disco',
    'Funk',
    'Soul',
    'Hip Hop',
    'R&B',
    'Reggaeton',
    'Afrobeats',
    'Dancehall',
    'Latin',
    'Salsa',
    'Bachata',
    'Pop',
    'Rock',
    'Indie Dance',
    'Dance',
    'EDM',
    'Hardstyle',
    'Hardcore',
    'Open Format',
    'Jazz',
    'Nu Jazz',
    'Acid Jazz',
    'Jazz Funk',
    'Swing',
    'Blues',
    'Bossa Nova',
    'Chillout',
    'Trip Hop',
    'Italo Disco',
    'Electro Swing',
    'Baile Funk',
    'Flamenco',
    'World',
    'Classical',
] as const;
export const GENRE_ALIASES: Record<string, string> = {
    hause: 'House',
    haus: 'House',
    dnb: 'Drum & Bass',
    'drum and bass': 'Drum & Bass',
    'drum n bass': 'Drum & Bass',
    'hip-hop': 'Hip Hop',
    hiphop: 'Hip Hop',
    rnb: 'R&B',
    'r and b': 'R&B',
    reggaetón: 'Reggaeton',
    regueton: 'Reggaeton',
    'nu-disco': 'Nu Disco',
    'tech-house': 'Tech House',
    'deep-house': 'Deep House',
};
const fold = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
export function canonicalGenre(value: string): string | undefined {
    const key = fold(value);
    return (
        MUSIC_GENRES.find((name) => fold(name) === key) || GENRE_ALIASES[key]
    );
}
export function parseMusicGenres(value: string): string[] {
    return [
        ...new Set(
            value
                .split(/[,·;|]/)
                .map((name) => canonicalGenre(name) || name.trim())
                .filter(Boolean),
        ),
    ];
}
export function serializeMusicGenres(values: string[]): string {
    return [
        ...new Set(
            values
                .map((name) => canonicalGenre(name) || name.trim())
                .filter(Boolean),
        ),
    ].join(' · ');
}
function distance(a: string, b: string): number {
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
        const next = [i + 1];
        for (let j = 0; j < b.length; j++)
            next.push(
                Math.min(
                    next[j] + 1,
                    row[j + 1] + 1,
                    row[j] + (a[i] === b[j] ? 0 : 1),
                ),
            );
        row = next;
    }
    return row[b.length];
}
export function suggestMusicGenres(
    query: string,
    selected: string[] = [],
): string[] {
    const key = fold(query);
    const exact = canonicalGenre(query);
    return MUSIC_GENRES.filter((name) => !selected.includes(name))
        .map((name) => ({
            name,
            score:
                name === exact
                    ? -1
                    : fold(name).startsWith(key)
                      ? 0
                      : fold(name).includes(key)
                        ? 1
                        : key.length >= 3
                          ? distance(key, fold(name))
                          : 999,
        }))
        .filter((item) => item.score <= (key.length >= 5 ? 2 : 1))
        .sort((a, b) => a.score - b.score)
        .slice(0, 8)
        .map((item) => item.name);
}
