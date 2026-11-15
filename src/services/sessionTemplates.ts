import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import type { Session } from '../types/session';
import { sessionTemplateFields, templateName, validTemplate, type SessionTemplate } from '../utils/sessionTemplates';

const pending = new Map<string, Promise<unknown>>();
const key = (userId: string) => {
    if (!userId) throw new Error('templates.storageError');
    return `djplanner-session-templates-v1:${encodeURIComponent(userId)}`;
};
async function read(userId: string): Promise<SessionTemplate[]> {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return [];
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows) || !rows.every(validTemplate)) throw new Error('templates.storageError');
    return rows;
}
async function change(userId: string, update: (rows: SessionTemplate[]) => SessionTemplate[]) {
    const storageKey = key(userId);
    const next = (pending.get(storageKey) || Promise.resolve()).catch(() => {}).then(async () => {
        const rows = update(await read(userId));
        await AsyncStorage.setItem(storageKey, JSON.stringify(rows));
        return rows;
    });
    pending.set(storageKey, next);
    try { return await next; } finally { if (pending.get(storageKey) === next) pending.delete(storageKey); }
}
function uniqueName(rows: SessionTemplate[], name: string, exceptId?: string) {
    if (rows.some(row => row.id !== exceptId && row.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('templates.duplicateName');
}
export const sessionTemplates = {
    async list(userId: string) { await pending.get(key(userId))?.catch(() => {}); return read(userId); },
    async save(userId: string, name: string, session: Session) {
        name = templateName(name);
        if (session.user_id !== userId || session.is_guest) throw new Error('templates.storageError');
        const fields = sessionTemplateFields(session);
        const row: SessionTemplate = { id: randomUUID(), name, fields };
        if (!validTemplate(row)) throw new Error('templates.invalidSession');
        return change(userId, rows => { uniqueName(rows, name); return [...rows, row]; });
    },
    async rename(userId: string, id: string, name: string) {
        name = templateName(name);
        return change(userId, rows => {
            if (!rows.some(row => row.id === id)) throw new Error('templates.storageError');
            uniqueName(rows, name, id);
            return rows.map(row => row.id === id ? { ...row, name } : row);
        });
    },
    async remove(userId: string, id: string) { return change(userId, rows => rows.filter(row => row.id !== id)); },
};
