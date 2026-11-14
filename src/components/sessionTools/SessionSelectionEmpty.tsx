import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../i18n/useTranslation';
import { CommunityButton, useCommunityColors } from '../community/CommunityUI';

export type SessionSelectionPurpose = 'entries' | 'guests' | 'expenses' | 'preparation';

export function SessionSelectionEmpty({ purpose }: { purpose: SessionSelectionPurpose }) {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const router = useRouter();
    return (
        <View style={{ paddingTop: 8, paddingBottom: 24, gap: 20 }}>
            <View style={{ backgroundColor: c.card, borderRadius: 28, paddingHorizontal: 28, paddingVertical: 40, gap: 16, alignItems: 'center', justifyContent: 'center' }}>
                <Text accessibilityRole="header" style={[{ color: c.fg, fontSize: 20, lineHeight: 27, fontWeight: '800', textAlign: 'center' }, c.dark && { color: c.cardText }]}>
                    {t('sessionSelection.emptyTitle')}
                </Text>
                <Text style={[{ color: c.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' }, c.dark && { color: c.cardText }]}>
                    {t(`sessionSelection.${purpose}`)}
                </Text>
            </View>
            <CommunityButton label={t('sessionSelection.create')} onPress={() => router.push('/add-session')} />
        </View>
    );
}
