import type { ComponentRef } from 'react';
import { useState, type RefObject } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { StickyNote } from 'lucide-react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { useUpdateSessionMutation } from '../../hooks/useSessionsQuery';
import { useCommunityColors } from '../community/communityColors';
import { showError } from '../../utils/showError';
import { SessionNotesField } from './SessionNotesField';

export function SessionNotesCard({ sessionId, notes, scrollRef }: { sessionId: string; notes?: string | null; scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null> }) {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const update = useUpdateSessionMutation();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const save = async () => {
        if (update.isPending) return;
        try {
            await update.mutateAsync({ sessionId, input: { notes: draft.trim() || null } });
            setEditing(false);
        } catch (error) {
            showError(t('error'), t(error instanceof Error && error.message === 'sessionNotes.tooLong'
                ? error.message : 'error_saving_session'));
        }
    };
    return <View testID="session-notes-card" style={{ backgroundColor: c.card, borderColor: c.border,
        borderWidth: c.dark ? 0 : 1, borderRadius: 24, padding: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <StickyNote size={19} color={c.accent} />
            <Text accessibilityRole="header" style={{ color: c.cardText, fontSize: 19, fontWeight: '800' }}>
                {t('sessionNotes.title')}
            </Text>
        </View>
        {editing ? <>
            <SessionNotesField value={draft} onChange={setDraft} disabled={update.isPending} scrollRef={scrollRef} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}>
                <Pressable accessibilityRole="button" disabled={update.isPending} onPress={() => setEditing(false)}
                    style={{ minHeight: 46, padding: 12, justifyContent: 'center' }}>
                    <Text style={{ color: c.muted, fontWeight: '600' }}>{t('cancel')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={update.isPending}
                    accessibilityState={{ busy: update.isPending, disabled: update.isPending }}
                    onPress={() => void save()} style={{ minHeight: 46, padding: 12, borderRadius: 14,
                        backgroundColor: c.accent, justifyContent: 'center' }}>
                    {update.isPending ? <ActivityIndicator color={c.onAccent} />
                        : <Text style={{ color: c.onAccent, fontWeight: '700' }}>{t('sessionNotes.save')}</Text>}
                </Pressable>
            </View>
        </> : <>
            <Text testID="session-notes-content" selectable style={{ color: notes ? c.fg : c.muted, fontSize: 15, lineHeight: 23 }}>
                {notes || t('sessionNotes.empty')}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => { setDraft(notes || ''); setEditing(true); }}
                style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingVertical: 10 }}>
                <Text style={{ color: c.accent, fontWeight: '700' }}>{t(notes ? 'sessionNotes.edit' : 'sessionNotes.add')}</Text>
            </Pressable>
        </>}
    </View>;
}
