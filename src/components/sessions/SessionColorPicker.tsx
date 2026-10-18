import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, ChevronRight, X } from 'lucide-react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/communityColors';
import { DEFAULT_SESSION_COLOR } from '../../theme/colors';

export function SessionColorPicker({ value, onChange }: { value: string | null; onChange: (color: string) => void }) {
    const [open, setOpen] = useState(false);
    const c = useCommunityColors();
    const { t } = useTranslation();
    const choices = [
        ['#34D399', 'color_sage'], ['#EF4444', 'color_tomato'],
        ['#F97316', 'color_tangerine'], ['#FBBF24', 'color_banana'],
        ['#10B981', 'color_basil'], ['#0EA5E9', 'color_peacock'],
        ['#3B82F6', 'color_blueberry'], ['#8B5CF6', 'color_lavender'],
        ['#9333EA', 'color_grape'], ['#F43F5E', 'color_flamingo'],
        ['#6B7280', 'color_graphite'], ['#262626', 'color_black'],
    ];
    const selected = value || DEFAULT_SESSION_COLOR;
    const name = choices.find(([color]) => color === selected)?.[1];
    return <>
        <Pressable testID="session-color-field" accessibilityRole="button" accessibilityLabel={t('choose_color')} onPress={() => setOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: c.field }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: selected }} />
            <Text style={{ color: c.cardText, fontWeight: '700', flex: 1 }}>{name ? t(name) : selected}</Text>
            <ChevronRight size={18} color={c.accent} />
        </Pressable>
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
            <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' }}>
                <Pressable accessibilityRole="button" accessibilityLabel={t('cancel')} onPress={() => setOpen(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                <View accessibilityViewIsModal style={{ backgroundColor: c.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '80%' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '800', color: c.cardText }}>{t('choose_color')}</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel={t('cancel')} onPress={() => setOpen(false)} hitSlop={10} style={{ padding: 8 }}><X size={22} color={c.cardText} /></Pressable>
                    </View>
                    <ScrollView keyboardShouldPersistTaps="handled">
                        {choices.map(([color, key]) => <Pressable key={color} accessibilityRole="radio" accessibilityState={{ checked: selected === color }} accessibilityLabel={t(key)} onPress={() => { onChange(color); setOpen(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
                            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color }} />
                            <Text style={{ flex: 1, color: c.cardText, fontWeight: '600' }}>{t(key)}</Text>
                            {selected === color && <Check size={19} color={c.accent} />}
                        </Pressable>)}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    </>;
}
