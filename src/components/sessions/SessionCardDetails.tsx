import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useCommunityColors } from '../community/communityColors';
import { useTranslation } from '../../i18n/useTranslation';

/** Keep summary queries mounted so updates still arrive while the card is folded. */
export function SessionCardDetails({ sessionId, children }: { sessionId: string; children: ReactNode }) {
    const [expanded, setExpanded] = useState(true);
    const c = useCommunityColors();
    const { t } = useTranslation();
    useEffect(() => { setExpanded(true); }, [sessionId]);
    const label = t(expanded ? 'sessionCard.hideDetails' : 'sessionCard.showDetails');
    const Icon = expanded ? ChevronUp : ChevronDown;
    return <View style={{ borderTopWidth: 1, borderTopColor: c.border }}>
        <Pressable testID={`session-summary-toggle-${sessionId}`} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded }} aria-expanded={expanded}
            onPress={event => { event.stopPropagation(); setExpanded(value => !value); }}
            style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ color: c.dark ? c.cardText : c.accent, fontSize: 13, fontWeight: '700' }}>{label}</Text>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' }}><Icon size={22} strokeWidth={2.5} color={c.dark ? c.cardText : c.accent} /></View>
        </Pressable>
        <View testID={`session-summary-content-${sessionId}`} aria-hidden={!expanded} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'} style={{ height: expanded ? undefined : 0, overflow: 'hidden' }}>
            <View style={{ gap: 12, flexShrink: 0 }}>{children}</View>
        </View>
    </View>;
}
