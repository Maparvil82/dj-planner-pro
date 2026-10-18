import { useRef, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { SESSION_EVENT_TYPES, type SessionEventType } from '../../types/session';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/communityColors';

export function SessionTypePicker({ value, onChange }: {
    value: SessionEventType | null;
    onChange: (value: SessionEventType | null) => void;
}) {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const field = useRef<View>(null);
    const [open, setOpen] = useState(false);
    const [anchor, setAnchor] = useState({ x: 16, y: 16, width: 280, height: 52 });
    const menuHeight = Math.min(304, screenHeight - 32);
    const below = anchor.y + anchor.height + 6;
    const top = below + menuHeight <= screenHeight - 16
        ? below : Math.max(16, anchor.y - menuHeight - 6);
    const close = () => setOpen(false);
    const show = () => {
        Keyboard.dismiss();
        field.current?.measureInWindow((x, y, width, height) => {
            setAnchor({ x, y, width, height });
            setOpen(true);
        });
    };
    return (
        <View style={{ gap: 8 }} testID="session-type-picker">
            <Text style={{ fontSize: 14, fontWeight: '600', color: c.fg }}>
                {t('sessionType.label')}
            </Text>
            <View ref={field} collapsable={false}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('sessionType.label')}
                    accessibilityValue={{ text: t(`sessionType.${value || 'unspecified'}`) }}
                    accessibilityState={{ expanded: open }}
                    aria-expanded={open}
                    onPress={show}
                    style={{ minHeight: 52, padding: 14, borderRadius: 14,
                        borderWidth: 1, borderColor: open ? c.accent : c.border,
                        backgroundColor: c.field, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                    <Text style={{ flex: 1, color: c.fg, fontSize: 16, fontWeight: '500' }}>
                        {t(`sessionType.${value || 'unspecified'}`)}
                    </Text>
                    <ChevronDown size={20} color={c.muted} />
                </Pressable>
            </View>
            <Modal visible={open} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
                <View style={{ flex: 1 }}>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('cancel')} onPress={close}
                        style={{ position: 'absolute', inset: 0, backgroundColor: '#0003' }} />
                    <View accessibilityViewIsModal style={{ position: 'absolute', top,
                        left: Math.max(16, Math.min(anchor.x, screenWidth - anchor.width - 16)),
                        width: Math.min(anchor.width, screenWidth - 32), maxHeight: menuHeight,
                        borderRadius: 14, borderWidth: 1, borderColor: c.border,
                        backgroundColor: c.card, paddingVertical: 7, overflow: 'hidden' }}>
                        <ScrollView keyboardShouldPersistTaps="handled">
                            <View accessibilityRole="radiogroup" accessibilityLabel={t('sessionType.label')}>
                                {[...SESSION_EVENT_TYPES, null].map(type => (
                                    <Pressable key={type || 'unspecified'} accessibilityRole="radio"
                                        accessibilityState={{ checked: value === type }} aria-checked={value === type}
                                        onPress={() => { onChange(type); close(); }}
                                        style={{ minHeight: 48, paddingHorizontal: 14, paddingVertical: 12,
                                            flexDirection: 'row', alignItems: 'center', gap: 12,
                                            backgroundColor: value === type ? c.tint : c.card }}>
                                        <Text style={{ flex: 1, color: c.fg, fontSize: 15, fontWeight: value === type ? '700' : '500' }}>
                                            {t(`sessionType.${type || 'unspecified'}`)}
                                        </Text>
                                        {value === type && <Check size={18} color={c.accent} />}
                                    </Pressable>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
