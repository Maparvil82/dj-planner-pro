import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import {
    Plus,
    CalendarDays,
    Clock3,
    Music2,
    MapPin,
} from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/CommunityUI';

export function AddSessionButton() {
    const router = useRouter();
    const { t } = useTranslation();
    const c = useCommunityColors();
    const insets = useSafeAreaInsets();
    const [open, setOpen] = useState(false);
    const destination = useRef<Href | null>(null);
    const finishNavigation = useCallback(() => {
        if (!destination.current) return;
        const href = destination.current;
        destination.current = null;
        router.push(href);
    }, [router]);
    useEffect(() => {
        // Android removes the native modal when visible becomes false.
        // iOS and web wait for onDismiss so sheets never overlap.
        if (!open && Platform.OS === 'android') finishNavigation();
    }, [open, finishNavigation]);
    const navigate = (href: Href) => {
        destination.current = href;
        setOpen(false);
    };
    const actions = [
        { key: 'session', Icon: CalendarDays, href: '/add-session' },
        { key: 'conditional', Icon: Clock3 },
        { key: 'mix', Icon: Music2, href: '/add-mix' },
        { key: 'venue', Icon: MapPin, href: '/venues?create=1' },
    ] as const;
    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('createMenu.title')}
                onPress={() => setOpen(true)}
                style={{
                    height: 46,
                    width: 46,
                    borderRadius: 16,
                    backgroundColor: '#6554df',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <Plus size={24} color="#fff" />
            </Pressable>
            <Modal
                visible={open}
                transparent
                onDismiss={finishNavigation}
                animationType="slide"
                onRequestClose={() => setOpen(false)}
            >
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'flex-end',
                        backgroundColor: 'transparent',
                    }}
                >
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('accountMenu.close')}
                        onPress={() => setOpen(false)}
                        style={{ position: 'absolute', inset: 0 }}
                    />
                    <View
                        accessibilityViewIsModal
                        style={{
                            backgroundColor: c.dark ? '#202538' : '#e9eaf1',
                            borderTopLeftRadius: 28,
                            borderTopRightRadius: 28,
                            paddingTop: 28,
                            paddingHorizontal: 12,
                            paddingBottom: Math.max(insets.bottom, 20) + 8,
                        }}
                    >
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'flex-start',
                            }}
                        >
                            {actions.map((action) => {
                                const enabled = 'href' in action;
                                return (
                                    <Pressable
                                        key={action.key}
                                        accessibilityRole="button"
                                        accessibilityLabel={t(
                                            `createMenu.${action.key}`,
                                        )}
                                        accessibilityHint={
                                            !enabled
                                                ? t('createMenu.soon')
                                                : undefined
                                        }
                                        accessibilityState={{
                                            disabled: !enabled,
                                        }}
                                        disabled={!enabled}
                                        onPress={() => {
                                            if ('href' in action)
                                                navigate(action.href);
                                        }}
                                        style={({ pressed }) => ({
                                            flex: 1,
                                            minWidth: 0,
                                            alignItems: 'center',
                                            gap: 10,
                                            opacity: !enabled
                                                ? 0.45
                                                : pressed
                                                  ? 0.7
                                                  : 1,
                                        })}
                                    >
                                        <View
                                            style={{
                                                width: 58,
                                                height: 58,
                                                borderRadius: 29,
                                                backgroundColor: c.card,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <action.Icon
                                                size={27}
                                                color={c.accent}
                                            />
                                        </View>
                                        <Text
                                            style={{
                                                color: c.fg,
                                                fontWeight: '600',
                                                fontSize: 12,
                                                lineHeight: 16,
                                                textAlign: 'center',
                                                paddingHorizontal: 2,
                                            }}
                                        >
                                            {t(`createMenu.${action.key}`)}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}
