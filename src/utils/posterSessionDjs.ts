/** The owner DJs even when solo sessions store an empty djs array. */
export function posterSessionDjs(ownerArtistName: string | null | undefined, sessionDjs: string[] | null | undefined): string[] {
    const seen = new Set<string>();
    return [ownerArtistName || '', ...(sessionDjs || [])]
        .map(name => name.trim())
        .filter(name => {
            const key = name.normalize('NFKC').toLocaleLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}
