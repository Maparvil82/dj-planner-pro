import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import {
    Plus,
    X,
    CalendarDays,
    Clock3,
    Music2,
    MapPin,
    ChevronRight,
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
        {
            key: 'session',
            hint: 'sessionHint',
            Icon: CalendarDays,
            href: '/add-session',
        },
        { key: 'conditional', hint: 'soon', Icon: Clock3 },
        { key: 'mix', hint: 'mixHint', Icon: Music2, href: '/add-mix' },
        {
            key: 'venue',
            hint: 'venueHint',
            Icon: MapPin,
            href: '/venues?create=1',
        },
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
                        backgroundColor: '#00000066',
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
                            maxHeight: '85%',
                            backgroundColor: c.bg,
                            borderTopLeftRadius: 30,
                            borderTopRightRadius: 30,
                            paddingTop: 12,
                            paddingBottom: Math.max(insets.bottom, 20),
                        }}
                    >
                        <View
                            style={{
                                width: 34,
                                height: 4,
                                borderRadius: 2,
                                alignSelf: 'center',
                                backgroundColor: c.border,
                                marginBottom: 14,
                            }}
                        />
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 24,
                                marginBottom: 18,
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        color: c.fg,
                                        fontSize: 27,
                                        fontWeight: '800',
                                        letterSpacing: -0.7,
                                    }}
                                >
                                    {t('createMenu.title')}
                                </Text>
                                <Text
                                    style={{
                                        color: c.muted,
                                        fontSize: 13,
                                        marginTop: 4,
                                    }}
                                >
                                    {t('createMenu.intro')}
                                </Text>
                            </View>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t('accountMenu.close')}
                                onPress={() => setOpen(false)}
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 22,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: c.field,
                                }}
                            >
                                <X color={c.fg} size={21} />
                            </Pressable>
                        </View>
                        <ScrollView
                            style={{ flexGrow: 0 }}
                            contentContainerStyle={{
                                paddingHorizontal: 20,
                                gap: 8,
                            }}
                        >
                            {actions.map((action) => {
                                const enabled = 'href' in action;
                                return (
                                    <Pressable
                                        key={action.key}
                                        accessibilityRole="button"
                                        accessibilityState={{
                                            disabled: !enabled,
                                        }}
                                        disabled={!enabled}
                                        onPress={() => {
                                            if ('href' in action)
                                                navigate(action.href);
                                        }}
                                        style={({ pressed }) => ({
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 14,
                                            padding: 14,
                                            borderRadius: 18,
                                            backgroundColor: pressed
                                                ? c.tint
                                                : c.card,
                                            opacity: enabled ? 1 : 0.58,
                                        })}
                                    >
                                        <View
                                            style={{
                                                width: 46,
                                                height: 46,
                                                borderRadius: 15,
                                                backgroundColor: c.tint,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <action.Icon
                                                size={23}
                                                color={c.accent}
                                            />
                                        </View>
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <Text
                                                style={{
                                                    color: c.fg,
                                                    fontSize: 16,
                                                    fontWeight: '700',
                                                }}
                                            >
                                                {t(`createMenu.${action.key}`)}
                                            </Text>
                                            <Text
                                                style={{
                                                    color: c.muted,
                                                    fontSize: 12,
                                                    lineHeight: 17,
                                                    marginTop: 3,
                                                }}
                                            >
                                                {t(`createMenu.${action.hint}`)}
                                            </Text>
                                        </View>
                                        {enabled && (
                                            <ChevronRight
                                                size={18}
                                                color={c.muted}
                                            />
                                        )}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
}
