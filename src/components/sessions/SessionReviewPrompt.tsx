import { Pressable, Text, View } from 'react-native';
import { Mic, Pencil, StickyNote } from 'lucide-react-native';
import { useCommunityColors } from '../community/communityColors';
import { useTranslation } from '../../i18n/useTranslation';

export function SessionReviewPrompt({ venue, onEdit, onNotes, onAudio }: {
    venue: string; onEdit: () => void; onNotes: () => void; onAudio: () => void;
}) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    return <View testID="session-review-prompt" style={{ backgroundColor: c.card, borderRadius: 24, padding: 20,
        borderColor: c.accent, borderWidth: 1, gap: 14 }}>
        <Text accessibilityRole="header" style={{ color: c.cardText, fontSize: 22, fontWeight: '800', lineHeight: 28 }}>
            {t('sessionReview.question', { venue })}
        </Text>
        <Text style={{ color: c.muted, fontSize: 15, lineHeight: 22 }}>{t('sessionReview.intro')}</Text>
        {[
            { label: t('sessionDetail.edit'), Icon: Pencil, action: onEdit },
            { label: t('sessionNotes.title'), Icon: StickyNote, action: onNotes },
            { label: `${t('voiceNotes.title')} · PRO`, Icon: Mic, action: onAudio },
        ].map(item => <Pressable key={item.label} accessibilityRole="button" onPress={item.action}
            style={{ minHeight: 46, borderRadius: 14, backgroundColor: c.field, padding: 12, gap: 10, flexDirection: 'row', alignItems: 'center' }}>
            <item.Icon size={19} color={c.accent} />
            <Text style={{ color: c.fg, fontWeight: '700', fontSize: 14, flexShrink: 1 }}>{item.label}</Text>
        </Pressable>)}
    </View>;
}
