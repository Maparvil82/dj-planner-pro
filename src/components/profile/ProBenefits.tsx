import { Text, View } from 'react-native';
import { PRO_FEATURES } from '../../config/proFeatures';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/communityColors';

export function ProBenefits() {
    const { t } = useTranslation();
    const c = useCommunityColors();
    return <View testID="pro-benefits" style={{ gap: 12 }}>
        {PRO_FEATURES.filter(feature => feature.enabled).map(feature => <View key={feature.id} testID={`pro-benefit-${feature.id}`} style={{ padding: 20, borderRadius: 24, backgroundColor: c.card, borderWidth: c.dark ? 0 : 1, borderColor: c.border, gap: 10 }}>
            <Text style={{ color: c.dark ? c.cardText : c.fg, fontWeight: '800', fontSize: 19 }}>{t(feature.title)}</Text>
            <Text style={{ color: c.dark ? c.cardText : c.muted, fontSize: 14, lineHeight: 22 }}>{t(feature.description)}</Text>
        </View>)}
    </View>;
}
