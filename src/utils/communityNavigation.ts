export function sharedDJDestination(
    id: unknown,
): `/community/${string}` | null {
    return typeof id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            id,
        )
        ? `/community/${id}`
        : null;
}
