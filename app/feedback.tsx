import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { SessionFormHeader } from '../src/components/sessions/SessionFormLayout';
import { randomUUID } from 'expo-crypto';
import { useTranslation } from '../src/i18n/useTranslation';
import { useCommunityColors } from '../src/components/community/communityColors';
import { supabase } from '../src/lib/supabase';

const categories = ['bug', 'idea', 'account', 'language', 'other'] as const;
type Category = typeof categories[number];
export default function FeedbackScreen() {
    const { t, currentLanguage } = useTranslation();
    const c = useCommunityColors();
    const router = useRouter();
    const [category, setCategory] = useState<Category | null>(null);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);
    const lock = useRef(false);
    const pending = useRef<{ key: string; id: string } | null>(null);
    const valid = !!category && message.trim().length >= 10;
    const submit = async () => {
        if (!valid || lock.current) return;
        lock.current = true; setBusy(true); setError('');
        const key = JSON.stringify([category, message.trim(), currentLanguage]);
        if (pending.current?.key !== key) pending.current = { key, id: randomUUID() };
        try {
            const { error: failure } = await supabase.from('app_feedback').insert({
                id: pending.current.id, category, message: message.trim(), language: currentLanguage,
            });
            // A retry after a lost response may encounter the already-saved submission.
            if (failure && failure.code !== '23505') throw failure;
            setSent(true); setMessage('');
        } catch {
            setError(t('feedbackForm.error'));
        } finally { lock.current = false; setBusy(false); }
    };
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
            <Stack.Screen options={{ headerShown: false }} />
            <SessionFormHeader navigationBack title={t('feedbackCard.title')} subtitle="" onClose={() => router.back()} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20, width: '100%', maxWidth: 700, alignSelf: 'center' }}>
                    {sent ? <View accessibilityLiveRegion="polite" style={{ backgroundColor: c.card, padding: 20, borderRadius: 20, gap: 10 }}>
                        <Text style={{ color: c.fg, fontSize: 18, fontWeight: '700' }}>{t('feedbackForm.thanks')}</Text>
                        <Text style={{ color: c.muted, lineHeight: 22 }}>{t('feedbackForm.success')}</Text>
                    </View> : <>
                        <Text style={{ color: c.muted, lineHeight: 22 }}>{t('feedbackForm.intro')}</Text>
                        <View style={{ gap: 10 }}>
                            <Text style={{ color: c.fg, fontSize: 14, fontWeight: '600' }}>{t('feedbackForm.category')}</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {categories.map(value => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: category === value, disabled: busy }} disabled={busy} onPress={() => setCategory(value)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: category === value ? c.accent : c.border, backgroundColor: category === value ? c.tint : c.card }}>
                                    <Text style={{ color: category === value ? c.accent : c.fg, fontSize: 14 }}>{t(`feedbackForm.categories.${value}`)}</Text>
                                </TouchableOpacity>)}
                            </View>
                        </View>
                        <View style={{ gap: 8 }}>
                            <Text style={{ color: c.fg, fontSize: 14, fontWeight: '600' }}>{t('feedbackForm.message')}</Text>
                            <TextInput accessibilityLabel={t('feedbackForm.message')} editable={!busy} multiline maxLength={3000} value={message} onChangeText={setMessage} placeholder={t('feedbackForm.placeholder')} placeholderTextColor={c.muted} textAlignVertical="top" style={{ minHeight: 180, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, color: c.fg, fontSize: 15, lineHeight: 22 }} />
                            <Text style={{ color: c.muted, fontSize: 12 }}>{t('feedbackForm.minimum')} · {message.length}/3000</Text>
                        </View>
                        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{t('feedbackForm.privacy')}</Text>
                        {error ? <Text accessibilityLiveRegion="polite" style={{ color: c.fg }}>{error}</Text> : null}
                        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !valid || busy, busy }} disabled={!valid || busy} onPress={() => void submit()} style={{ minHeight: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: c.accent, opacity: !valid || busy ? 0.5 : 1, padding: 12 }}>
                            {busy ? <ActivityIndicator color={c.onAccent} /> : <Text style={{ color: c.onAccent, fontWeight: '600', fontSize: 15 }}>{t('feedbackForm.send')}</Text>}
                        </TouchableOpacity>
                    </>}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
