import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { BookmarkPlus, ChevronRight, Pencil, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommunityColors } from '../community/communityColors';
import { CommunityButton } from '../community/CommunityUI';
import { useTranslation } from '../../i18n/useTranslation';
import { useSessionTemplates } from '../../hooks/useSessionTemplates';
import { useAuthStore } from '../../store/useAuthStore';
import { confirmAction } from '../../utils/confirmAction';
import { sessionTemplateFields, type SessionTemplate } from '../../utils/sessionTemplates';
import type { Session } from '../../types/session';

function TemplateSheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
    const c = useCommunityColors(), insets = useSafeAreaInsets(), { t } = useTranslation();
    return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' }}>
            <Pressable accessibilityLabel={t('templates.close')} onPress={onClose} style={{ flex: 1 }} />
            <View accessibilityViewIsModal style={{ maxHeight: '85%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: c.card, paddingBottom: Math.max(insets.bottom, 16) }}>
                <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginTop: 10 }} />
                <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text accessibilityRole="header" style={{ flex: 1, fontSize: 23, fontWeight: '800', color: c.fg }}>{title}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('templates.close')} onPress={onClose} style={{ padding: 10 }}><X color={c.fg} size={22} /></Pressable>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 16 }}>{children}</ScrollView>
            </View>
        </KeyboardAvoidingView>
    </Modal>;
}
function NameField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    const c = useCommunityColors(), { t } = useTranslation();
    return <TextInput accessibilityLabel={t('templates.name')} placeholder={t('templates.namePlaceholder')} placeholderTextColor={c.muted} value={value} onChangeText={onChange} maxLength={80} autoCapitalize="sentences" style={{ minHeight: 50, padding: 14, borderRadius: 14, backgroundColor: c.field, color: c.fg, borderWidth: 1, borderColor: c.border, fontSize: 16 }} />;
}
function ErrorText({ error }: { error: unknown }) {
    const { t } = useTranslation(), c = useCommunityColors();
    if (!error) return null;
    const key = error instanceof Error && error.message.startsWith('templates.') ? error.message : 'templates.storageError';
    return <Text accessibilityRole="alert" style={{ color: c.fg, fontSize: 14, lineHeight: 20 }}>{t(key)}</Text>;
}
export function SaveSessionTemplateButton({ session }: { session: Session }) {
    const [open, setOpen] = useState(false), [name, setName] = useState(''), [failure, setFailure] = useState<unknown>(null), [saved, setSaved] = useState(false);
    const { mutation, userId } = useSessionTemplates(false);
    const c = useCommunityColors(), { t, formatMoney } = useTranslation();
    const lock = useRef(false);
    useEffect(() => { setOpen(false); }, [userId]);
    const start = () => { setName(session.title.trim() || session.venue); setFailure(null); setSaved(false); setOpen(true); };
    const save = async () => {
        if (lock.current) return;
        lock.current = true; setFailure(null);
        try {
            sessionTemplateFields(session);
            await mutation.mutateAsync({ kind: 'save', name, session });
            if (useAuthStore.getState().session?.user.id === userId) setSaved(true);
        } catch (error) { setFailure(error); } finally { lock.current = false; }
    };
    return <>
        <Pressable testID="save-session-template" accessibilityRole="button" accessibilityLabel={t('templates.saveAs')} onPress={start} style={{ flexDirection: 'row', gap: 12, padding: 18, borderRadius: 18, backgroundColor: c.card, alignItems: 'center', borderWidth: 1, borderColor: c.border }}>
            <BookmarkPlus size={21} color={c.accent} /><Text style={{ flex: 1, fontWeight: '700', color: c.fg, fontSize: 15 }}>{t('templates.saveAs')}</Text><ChevronRight size={18} color={c.muted} />
        </Pressable>
        <TemplateSheet visible={open} onClose={() => setOpen(false)} title={t(saved ? 'templates.saved' : 'templates.saveAs')}>
            {saved ? <><Text style={{ color: c.muted, lineHeight: 21 }}>{t('templates.savedHint')}</Text><CommunityButton label={t('templates.done')} onPress={() => setOpen(false)} /></> : <>
                <Text style={{ color: c.muted, lineHeight: 21 }}>{t('templates.saveHint')}</Text>
                <NameField value={name} onChange={setName} />
                <View style={{ backgroundColor: c.field, padding: 16, borderRadius: 16, gap: 6 }}>
                    <Text style={{ color: c.fg, fontWeight: '700' }}>{session.venue}</Text>
                    <Text style={{ color: c.muted }}>{session.start_time.slice(0, 5)} – {session.end_time.slice(0, 5)}</Text>
                    <Text style={{ color: c.muted }}>{session.earning_type === 'agreement' ? t('templates.agreementUnsupported') : `${formatMoney(session.earning_amount, session.currency)}${session.earning_type === 'hourly' ? ` · ${t('templates.hourly')}` : ''}`}</Text>
                </View>
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{t('templates.localOnly')}</Text>
                <ErrorText error={failure} />
                <CommunityButton busy={mutation.isPending} disabled={!name.trim() || session.earning_type === 'agreement'} label={t('templates.save')} onPress={() => void save()} />
            </>}
        </TemplateSheet>
    </>;
}
export function SessionTemplatePicker({ onApply, disabled = false }: { onApply: (template: SessionTemplate) => void | Promise<void>; disabled?: boolean }) {
    const [open, setOpen] = useState(false), [renaming, setRenaming] = useState<SessionTemplate | null>(null), [name, setName] = useState(''), [failure, setFailure] = useState<unknown>(null);
    const { query, mutation, userId } = useSessionTemplates(true);
    const [availableWidth, setAvailableWidth] = useState(0);
    const c = useCommunityColors(), { t, formatMoney } = useTranslation();
    const lock = useRef(false);
    useEffect(() => { setOpen(false); setRenaming(null); }, [userId]);
    const act = async (action: Parameters<typeof mutation.mutateAsync>[0]) => {
        if (lock.current) return;
        lock.current = true; setFailure(null);
        try { await mutation.mutateAsync(action); setRenaming(null); } catch (error) { setFailure(error); } finally { lock.current = false; }
    };
    const remove = async (row: SessionTemplate) => {
        if (await confirmAction(t('templates.remove'), t('templates.removeHint', { name: row.name }), t('templates.cancel'), t('templates.remove'))) await act({ kind: 'remove', id: row.id });
    };
    const templates = query.data ?? [];
    if (!templates.length) return null;
    const columns = Math.min(templates.length, 3);
    const gap = 10;
    const cardWidth = availableWidth > 0 ? (availableWidth - gap * (columns - 1)) / columns : undefined;
    const pastels = ['#F9E8A0', '#D9EBC9', '#E4DDF5', '#F7D9CE', '#D5EAF2'];
    const apply = async (row: SessionTemplate) => {
        if (lock.current || disabled || mutation.isPending) return;
        lock.current = true;
        setFailure(null);
        try { await onApply(row); } catch (error) { setFailure(error); } finally { lock.current = false; }
    };
    return <>
        <View testID="session-template-cards" onLayout={event => setAvailableWidth(event.nativeEvent.layout.width)} style={{ gap: 12 }}>
            <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 18, fontWeight: '800' }}>{t('templates.title')}</Text>
            <ScrollView horizontal scrollEnabled={templates.length > 3} showsHorizontalScrollIndicator={templates.length > 3} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap, paddingBottom: 6 }}>
                {templates.map((row, index) => <View key={row.id} style={{ width: cardWidth, minHeight: 112, borderRadius: 16, backgroundColor: pastels[index % pastels.length], overflow: 'hidden' }}>
                    <Pressable testID="use-session-template" accessibilityRole="button" accessibilityLabel={t('templates.applyName', { name: row.name })} disabled={disabled || mutation.isPending} onPress={() => void apply(row)} style={{ flex: 1, minHeight: 126, padding: 12, gap: 8, opacity: disabled ? 0.5 : 1 }}>
                        <Text style={{ color: '#292636', fontSize: 15, lineHeight: 21, fontWeight: '700' }}>{row.name}</Text>
                        {row.fields.venue.trim() !== row.name.trim() && <Text numberOfLines={2} style={{ color: '#514963', fontSize: 12, lineHeight: 17 }}>{row.fields.venue}</Text>}
                        <Text style={{ color: '#514963', fontSize: 12, lineHeight: 17 }}>{row.fields.start_time} – {row.fields.end_time}</Text>
                        <Text style={{ color: '#292636', fontSize: 14, lineHeight: 20, fontWeight: '700' }}>{row.fields.earning_type === 'free' ? t('earning_free') : formatMoney(row.fields.earning_amount, row.fields.currency)}{row.fields.earning_type === 'hourly' ? ` · ${t('templates.hourly')}` : ''}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('templates.renameName', { name: row.name })} onPress={() => { setOpen(true); setRenaming(row); setName(row.name); setFailure(null); }} style={{ alignSelf: 'flex-end', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <Pencil size={16} color="#514963" />
                    </Pressable>
                </View>)}
            </ScrollView>
            <ErrorText error={failure} />
        </View>
        <TemplateSheet visible={open} onClose={() => setOpen(false)} title={t(renaming ? 'templates.rename' : 'templates.use')}>
            {renaming ? <><NameField value={name} onChange={setName} /><CommunityButton label={t('templates.save')} busy={mutation.isPending} disabled={!name.trim()} onPress={() => void act({ kind: 'rename', id: renaming.id, name })} /><CommunityButton secondary label={t('templates.remove')} disabled={mutation.isPending} onPress={() => void remove(renaming)} /><CommunityButton secondary label={t('templates.cancel')} onPress={() => setOpen(false)} /></> : <>
                <Text style={{ color: c.muted, lineHeight: 21 }}>{t('templates.applyHint')}</Text>
                {query.isPending ? <ActivityIndicator color={c.accent} /> : query.isError ? <CommunityButton secondary label={t('templates.retry')} onPress={() => void query.refetch()} /> : !query.data?.length ? <Text style={{ color: c.fg, lineHeight: 22 }}>{t('templates.empty')}</Text> : query.data.map(row => <View key={row.id} style={{ borderRadius: 18, backgroundColor: c.field, padding: 12, gap: 8 }}>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('templates.applyName', { name: row.name })} disabled={mutation.isPending} onPress={async () => {
                        if (lock.current) return;
                        lock.current = true;
                        try { await onApply(row); setOpen(false); } catch (error) { setFailure(error); } finally { lock.current = false; }
                    }} style={{ minHeight: 58, gap: 6, justifyContent: 'center', paddingHorizontal: 4 }}>
                        <Text style={{ color: c.fg, fontSize: 17, fontWeight: '700' }}>{row.name}</Text>
                        <Text style={{ color: c.muted, fontSize: 13 }}>{row.fields.venue} · {row.fields.start_time}–{row.fields.end_time}</Text>
                    </Pressable>
                    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                        <Pressable accessibilityRole="button" accessibilityLabel={t('templates.renameName', { name: row.name })} disabled={mutation.isPending} onPress={() => { setRenaming(row); setName(row.name); setFailure(null); }} style={{ padding: 12 }}><Pencil size={19} color={c.accent} /></Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel={t('templates.removeName', { name: row.name })} disabled={mutation.isPending} onPress={() => void remove(row)} style={{ padding: 12 }}><Trash2 size={19} color={c.muted} /></Pressable>
                    </View>
                </View>)}
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{t('templates.localOnly')}</Text>
            </>}
            <ErrorText error={failure || (query.isError ? query.error : null)} />
        </TemplateSheet>
    </>;
}
