export type ResearchInvitation = { updatesVisit?: string; shown?: boolean; interested?: boolean; submitted?: boolean };
export function eligibleForResearch(record: ResearchInvitation, visit: string, createdAt: string | undefined, hasCompleted: boolean, now = Date.now()) {
    const created = createdAt ? Date.parse(createdAt) : NaN;
    return !record.shown && !record.interested && !!record.updatesVisit && record.updatesVisit !== visit && Number.isFinite(created) && now - created >= 7 * 86400000 && hasCompleted;
}
