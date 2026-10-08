// Keep equality consistent with community_private.filter_key in Postgres.
const accented = 'áàâäãåéèêëíìîïóòôöõúùûüñç';
const plain = 'aaaaaaeeeeiiiiooooouuuunc';

export type CityLocation = {
    id: string;
    name: string;
    region: string;
    country: string;
    countryCode: string;
};
export type CitySuggestion = {
    city: string;
    city_location: CityLocation | null;
};
export function cityLabel(
    city: string,
    location?: CityLocation | null,
): string {
    return [city, location?.region, location?.country]
        .filter(Boolean)
        .join(' · ');
}

export function parsePhotonCities(data: unknown): CitySuggestion[] {
    const features = (data as { features?: unknown[] } | null)?.features;
    if (!Array.isArray(features)) throw new Error('Invalid city response');
    const result: CitySuggestion[] = [];
    const ids = new Set<string>();
    for (const feature of features) {
        const p = (feature as { properties?: Record<string, unknown> } | null)
            ?.properties;
        if (
            !p ||
            p.osm_key !== 'place' ||
            !['city', 'town', 'village', 'hamlet', 'locality'].includes(
                String(p.osm_value),
            )
        )
            continue;
        const text = (key: string) =>
            typeof p[key] === 'string'
                ? (p[key] as string).trim().slice(0, 100)
                : '';
        const name = text('name'),
            country = text('country'),
            countryCode = text('countrycode').toUpperCase();
        const id = `photon:${p.osm_type}:${p.osm_id}`;
        if (
            !name ||
            !country ||
            !/^[A-Z]{2}$/.test(countryCode) ||
            !/^photon:[NRW]:[0-9]{1,20}$/.test(id) ||
            ids.has(id)
        )
            continue;
        ids.add(id);
        result.push({
            city: name,
            city_location: {
                id,
                name,
                region: text('state'),
                country,
                countryCode,
            },
        });
    }
    return result.slice(0, 6);
}

export function mergeCitySuggestions(
    local: CitySuggestion[],
    external: CitySuggestion[],
): CitySuggestion[] {
    const result: CitySuggestion[] = [];
    const ids = new Set<string>(),
        labels = new Set<string>();
    for (const item of [...local, ...external]) {
        const label = cityKey(cityLabel(item.city, item.city_location));
        const id = item.city_location?.id;
        if (labels.has(label) || (id && ids.has(id))) continue;
        labels.add(label);
        if (id) ids.add(id);
        result.push(item);
    }
    return result.slice(0, 10);
}

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
