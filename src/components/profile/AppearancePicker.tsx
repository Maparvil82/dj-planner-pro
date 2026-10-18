import { Modal, Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme, type ThemeType } from '../../contexts/ThemeContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/communityColors';

const choices: { value: ThemeType; swatch: string }[] = [
    { value: 'light', swatch: '#F7F7F7' },
    { value: 'dark', swatch: '#DCEB7D' },
    { value: 'dark-honey', swatch: '#EDB458' },
    { value: 'dark-ocean', swatch: '#0077B6' },
    { value: 'dark-bubble', swatch: '#EF476F' },
];

export function AppearancePicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const c = useCommunityColors();
    const { theme, setTheme } = useTheme();
    const { t } = useTranslation();
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#00000080' }}>
                <Pressable accessibilityLabel={t('cancel')} onPress={onClose} style={{ position: 'absolute', inset: 0 }} />
                <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 400, alignSelf: 'center', padding: 24, borderRadius: 28, backgroundColor: c.card }}>
                    <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 23, fontWeight: '800', marginBottom: 24 }}>{t('appearance')}</Text>
                    <View style={{ gap: 10 }}>
                        {choices.map(({ value, swatch }) => (
                            <Pressable key={value} accessibilityRole="radio" aria-checked={theme === value} accessibilityState={{ checked: theme === value }} accessibilityLabel={t(`theme_${value}`)}
                                onPress={() => { setTheme(value); onClose(); }}
                                style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: theme === value ? c.tint : c.field }}>
                                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: swatch, borderWidth: 1, borderColor: '#88888840' }} />
                                <Text style={{ flex: 1, color: c.fg, fontSize: 16, fontWeight: '600' }}>{t(`theme_${value}`)}</Text>
                                {theme === value && <Check size={20} color={c.accent} />}
                            </Pressable>
                        ))}
                    </View>
                    <Pressable accessibilityRole="button" onPress={onClose} style={{ marginTop: 24, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: c.dark ? '#3A2226' : '#FDEDEF' }}>
                        <Text style={{ color: c.dark ? '#FF939F' : '#B42338', fontSize: 16, fontWeight: '700' }}>{t('cancel')}</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}
