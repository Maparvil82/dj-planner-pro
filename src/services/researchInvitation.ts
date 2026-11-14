import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { ResearchInvitation } from '../utils/researchInvitation';
let visit = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let backgroundAt: number | null = null;
export const researchVisit = () => visit;
export function trackResearchVisits() {
    const listener = AppState.addEventListener('change', state => {
        if (state === 'background') backgroundAt = Date.now();
        if (state === 'active' && backgroundAt !== null) {
            if (Date.now() - backgroundAt >= 30 * 60000) visit = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            backgroundAt = null;
        }
    });
    return () => listener.remove();
}
const keyFor = (user: string) => `research-invitation:v1:${user}`;
export async function readResearchInvitation(user: string): Promise<ResearchInvitation> {
    const raw = await AsyncStorage.getItem(keyFor(user));
    return raw ? JSON.parse(raw) : {};
}
let queue: Promise<unknown> = Promise.resolve();
export function changeResearchInvitation(user: string, change: (record: ResearchInvitation) => ResearchInvitation): Promise<ResearchInvitation> {
    const result = queue.catch(() => {}).then(async () => {
        const next = change(await readResearchInvitation(user));
        await AsyncStorage.setItem(keyFor(user), JSON.stringify(next));
        return next;
    });
    queue = result;
    return result;
}
export function recordUpdatesVisit(user: string, force = false) {
    const current = researchVisit();
    return changeResearchInvitation(user, record => record.updatesVisit && !force ? record : { ...record, updatesVisit: current });
}
