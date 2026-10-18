import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { FileText, X } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../../store/useAuthStore';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../i18n/useTranslation';
import { buildStatisticsReportHtml, type StatisticsReport } from '../../utils/statisticsReport';

export function StatisticsExport({ enabled, ready, report }: { enabled: boolean; ready: boolean; report: () => StatisticsReport }) {
    const { t } = useTranslation();
    const { activeTheme, darkPalette: p } = useTheme();
    const dark = activeTheme === 'dark';
    const registeredEmail = useAuthStore(s => s.user?.email || s.session?.user.email || '');
    const [visible, setVisible] = useState(false);
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const lock = useRef(false);
    const label = (key: string) => t(`statisticsPdf.${key}`);
    const fg = dark ? p.text : '#202538';
    const accent = dark ? p.primary : '#6554df';
    const generate = async () => {
        if (!enabled || !ready || lock.current) return;
        if (Platform.OS !== 'web' && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email.trim())) { setError(label('invalidEmail')); return; }
        lock.current = true; setBusy(true); setError('');
        try {
            const data = report();
            const html = buildStatisticsReportHtml(data);
            if (Platform.OS === 'web') {
                // Browsers cannot attach local PDFs to mailto links. Use the print/save dialog.
                await Print.printAsync({ html });
            } else {
                const { uri } = await Print.printToFileAsync({ html });
                const Mail = await import('expo-mail-composer');
                if (await Mail.isAvailableAsync()) {
                    await Mail.composeAsync({ recipients: [email.trim()], subject: `${data.title} - ${data.period}`, body: label('body'), attachments: [uri] });
                } else if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: label('title') });
                } else { throw new Error('unavailable'); }
            }
            setVisible(false);
        } catch { setError(label('error')); }
        finally { lock.current = false; setBusy(false); }
    };
    if (!enabled) return null;
    return <>
        <Pressable testID="statistics-export" accessibilityRole="button" accessibilityLabel={label('title')} accessibilityState={{ disabled: !ready }} disabled={!ready}
            onPress={() => { setEmail(registeredEmail); setError(''); setVisible(true); }}
            style={{ width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? p.surface : '#eeecfa', opacity: ready ? 1 : 0.4 }}>
            <FileText color={accent} size={23} /><Text style={{ color: accent, fontSize: 8, fontWeight: '800' }}>PDF</Text>
        </Pressable>
        <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) setVisible(false); }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: 24 }}>
                <View accessibilityViewIsModal style={{ backgroundColor: dark ? p.background : '#fff', borderRadius: 24, padding: 24, gap: 18, maxWidth: 460, width: '100%', alignSelf: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text accessibilityRole="header" style={{ flex: 1, color: fg, fontSize: 21, fontWeight: '800' }}>{label('title')}</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel={label('cancel')} disabled={busy} onPress={() => setVisible(false)} style={{ padding: 10 }}><X color={fg} size={22} /></Pressable></View>
                    <Text style={{ color: fg, lineHeight: 21 }}>{label(Platform.OS === 'web' ? 'webHint' : 'hint')}</Text>
                    {Platform.OS !== 'web' && <><Text style={{ color: fg, fontWeight: '700' }}>{label('recipient')}</Text>
                    <TextInput testID="statistics-email" accessibilityLabel={label('recipient')} value={email} onChangeText={setEmail} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" selectionColor={accent}
                        style={{ color: fg, borderColor: accent, borderWidth: 1, borderRadius: 14, padding: 14, minHeight: 50 }} /></>}
                    {!!error && <Text accessibilityRole="alert" style={{ color: dark ? p.text : '#ba263b' }}>{error}</Text>}
                    <Pressable testID="statistics-send" accessibilityRole="button" disabled={busy || !ready || !enabled} onPress={generate} style={{ backgroundColor: accent, borderRadius: 14, padding: 16, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
                        {busy ? <ActivityIndicator color={dark ? p.onPrimary : '#fff'} /> : <Text style={{ color: dark ? p.onPrimary : '#fff', fontWeight: '800' }}>{label(Platform.OS === 'web' ? 'save' : 'compose')}</Text>}
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    </>;
}
