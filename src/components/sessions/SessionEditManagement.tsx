import { Keyboard, Text, TouchableOpacity, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSessionDeletion } from '../../hooks/useSessionDeletion';
import { useTranslation } from '../../i18n/useTranslation';
import { CommunityButton } from '../community/CommunityUI';
import { useCommunityColors } from '../community/communityColors';
import type { Session } from '../../types/session';

export function SessionEditManagement({ session, status, onStatusChange, busy }: {
    session: Session; status: 'pending' | 'confirmed' | 'cancelled'; onStatusChange: (status: 'confirmed' | 'cancelled') => void; busy: boolean;
}) {
    const router = useRouter();
    const deletion = useSessionDeletion(() => router.dismissTo('/home'));
    const c = useCommunityColors();
    const { t } = useTranslation();
    return <View style={{ gap: 16 }}>
        <Text style={{ color: c.cardText, fontSize: 13, lineHeight: 20 }}>{t('sessionManagement.cancelHint')}</Text>
        <CommunityButton secondary disabled={busy || deletion.isDeleting} label={t(status === 'cancelled' ? 'paymentState.reactivate' : 'paymentState.cancelAction')} onPress={() => {
            Keyboard.dismiss(); onStatusChange(status === 'cancelled' ? 'confirmed' : 'cancelled');
        }} />
        {status === 'cancelled' && <Text accessibilityLiveRegion="polite" style={{ color: c.cardText, fontSize: 12, fontWeight: '700' }}>{t('workflow.cancelled')}</Text>}
        <Text style={{ color: c.dark ? c.cardText : c.muted, fontSize: 12, lineHeight: 18 }}>{t('sessionManagement.saveStateHint')}</Text>
        <View style={{ height: 1, backgroundColor: c.border, marginVertical: 4 }} />
        <Text style={{ color: c.cardText, fontSize: 13, lineHeight: 20 }}>{t('sessionManagement.deleteHint')}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('delete_session_title')} disabled={busy || deletion.isDeleting} onPress={() => { Keyboard.dismiss(); deletion.requestDelete(session); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 15, borderRadius: 16, backgroundColor: c.dark ? '#c356711a' : '#fff0f3', opacity: busy || deletion.isDeleting ? 0.5 : 1 }}>
            <Trash2 size={18} color={c.dark ? '#f19ab1' : '#c35671'} />
            <Text style={{ color: c.dark ? '#f19ab1' : '#c35671', fontWeight: '700' }}>{t('delete_session_title')}</Text>
        </TouchableOpacity>
        {deletion.dialog}
    </View>;
}
