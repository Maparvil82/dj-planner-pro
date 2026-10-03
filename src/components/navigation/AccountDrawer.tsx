import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import {
    Animated,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { X, ChevronRight } from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useTranslation } from '../../i18n/useTranslation';
import { useUnreadNotifications } from '../../hooks/useNotifications';
import { useSessionUsage } from '../../hooks/useSessionUsage';
import { useCommunityColors } from '../community/CommunityUI';
import { TabProfileIcon } from '../ui/TabProfileIcon';

const DrawerContext = createContext<(() => void) | null>(null);
export function AccountAvatarButton() {
    const open = useContext(DrawerContext);
    const { profile, session } = useAuthStore();
    const { t } = useTranslation();
    const c = useCommunityColors();
    const unread = useUnreadNotifications();
    if (!open || !session) return null;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={
                t('accountMenu.open') +
                (unread.data
                    ? `, ${t('notifications.openUnread', { count: unread.data })}`
                    : '')
            }
            onPress={open}
            style={{
                width: 46,
                height: 46,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <TabProfileIcon
                url={profile?.avatar_url}
                name={profile?.artist_name || session.user.email}
                size={36}
                color={c.fg}
                focused={false}
                hasUnread={!!unread.data}
            />
        </Pressable>
    );
}
export function AccountDrawerProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const { width } = useWindowDimensions();
    const drawerWidth = Math.min(360, width * 0.88);
    const translate = useRef(new Animated.Value(drawerWidth)).current;
    const { profile, session } = useAuthStore();
    const c = useCommunityColors();
    const { t } = useTranslation();
    const router = useRouter();
    const unread = useUnreadNotifications();
    const usage = useSessionUsage();
    const close = () => setOpen(false);
    useEffect(() => {
        if (!session) setOpen(false);
    }, [session]);
    useEffect(() => {
        if (!open || Platform.OS !== 'web') return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open]);
    const show = () => {
        translate.setValue(drawerWidth);
        setOpen(true);
        void unread.refetch();
        void usage.refetch();
    };
    const navigate = (href: Href) => {
        close();
        router.push(href);
    };
    const rows: { key: string; href: Href; count?: number }[] = [
        {
            key: 'notifications',
            href: '/notifications',
            count: unread.data || 0,
        },
        { key: 'history', href: '/(tabs)/history' },
        { key: 'bookings', href: '/bookings' },
        { key: 'plan', href: '/profile?section=plan' },
        { key: 'settings', href: '/profile?section=settings' },
    ];
    return (
        <DrawerContext.Provider value={show}>
            {children}
            <Modal
                visible={open}
                transparent
                animationType="fade"
                onRequestClose={close}
                onShow={() =>
                    Animated.timing(translate, {
                        toValue: 0,
                        duration: 220,
                        useNativeDriver: true,
                    }).start()
                }
            >
                <View
                    style={{
                        flex: 1,
                        flexDirection: 'row',
                        backgroundColor: '#00000066',
                    }}
                >
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('accountMenu.close')}
                        onPress={close}
                        style={{ flex: 1 }}
                    />
                    <Animated.View
                        accessibilityViewIsModal
                        style={{
                            width: drawerWidth,
                            height: '100%',
                            backgroundColor: c.card,
                            transform: [{ translateX: translate }],
                        }}
                    >
                        <SafeAreaView style={{ flex: 1 }}>
                            <View
                                style={{
                                    alignItems: 'flex-end',
                                    paddingHorizontal: 16,
                                    paddingTop: 8,
                                }}
                            >
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={t('accountMenu.close')}
                                    onPress={close}
                                    style={{
                                        width: 44,
                                        height: 44,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <X size={22} color={c.fg} />
                                </Pressable>
                            </View>
                            <ScrollView
                                contentContainerStyle={{
                                    paddingHorizontal: 24,
                                    paddingBottom: 32,
                                }}
                            >
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={t(
                                        'accountMenu.profile',
                                    )}
                                    onPress={() => navigate('/profile')}
                                    style={{
                                        gap: 12,
                                        paddingBottom: 24,
                                        borderBottomWidth: 1,
                                        borderColor: c.border,
                                    }}
                                >
                                    <TabProfileIcon
                                        url={profile?.avatar_url}
                                        name={
                                            profile?.artist_name ||
                                            session?.user.email
                                        }
                                        size={64}
                                        color={c.fg}
                                        focused={false}
                                    />
                                    <Text
                                        numberOfLines={2}
                                        style={{
                                            fontSize: 25,
                                            lineHeight: 31,
                                            fontWeight: '800',
                                            color: c.fg,
                                        }}
                                    >
                                        {profile?.artist_name ||
                                            t('unifiedProfile.title')}
                                    </Text>
                                    <Text
                                        style={{
                                            color: c.accent,
                                            fontSize: 14,
                                            fontWeight: '600',
                                        }}
                                    >
                                        {t('accountMenu.profile')} →
                                    </Text>
                                </Pressable>
                                <View style={{ paddingVertical: 12 }}>
                                    {rows.map((row) => (
                                        <Pressable
                                            key={row.key}
                                            accessibilityRole="button"
                                            accessibilityLabel={
                                                t(`accountMenu.${row.key}`) +
                                                (row.count
                                                    ? `, ${row.count}`
                                                    : '')
                                            }
                                            onPress={() => navigate(row.href)}
                                            style={{
                                                flexDirection: 'row',
                                                gap: 12,
                                                alignItems: 'center',
                                                minHeight: 58,
                                                paddingVertical: 14,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    flex: 1,
                                                    fontSize: 16,
                                                    fontWeight: '600',
                                                    color: c.fg,
                                                }}
                                            >
                                                {t(`accountMenu.${row.key}`)}
                                            </Text>
                                            {!!row.count && (
                                                <View
                                                    style={{
                                                        backgroundColor:
                                                            c.accent,
                                                        borderRadius: 12,
                                                        minWidth: 24,
                                                        paddingHorizontal: 7,
                                                        paddingVertical: 3,
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            color: c.dark
                                                                ? '#0d1220'
                                                                : '#fff',
                                                            fontWeight: '700',
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        {row.count > 99
                                                            ? '99+'
                                                            : row.count}
                                                    </Text>
                                                </View>
                                            )}
                                            <ChevronRight
                                                size={16}
                                                color={c.muted}
                                            />
                                        </Pressable>
                                    ))}
                                </View>
                                {usage.data && !usage.data.isPro && (
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={t(
                                            'accountMenu.discoverPro',
                                        )}
                                        onPress={() => navigate('/pro')}
                                        style={{
                                            backgroundColor: c.tint,
                                            borderRadius: 22,
                                            padding: 20,
                                            gap: 10,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: c.accent,
                                                fontSize: 11,
                                                letterSpacing: 1.5,
                                                fontWeight: '800',
                                            }}
                                        >
                                            DJ PLANNER PRO
                                        </Text>
                                        <Text
                                            style={{
                                                color: c.fg,
                                                fontSize: 22,
                                                lineHeight: 28,
                                                fontWeight: '800',
                                            }}
                                        >
                                            {t('accountMenu.proTitle')}
                                        </Text>
                                        <Text
                                            style={{
                                                color: c.muted,
                                                fontSize: 13,
                                                lineHeight: 20,
                                            }}
                                        >
                                            {t('accountMenu.proHint')}
                                        </Text>
                                        <Text
                                            style={{
                                                color: c.accent,
                                                fontWeight: '800',
                                                fontSize: 14,
                                                marginTop: 4,
                                            }}
                                        >
                                            {t('accountMenu.discoverPro')} →
                                        </Text>
                                    </Pressable>
                                )}
                            </ScrollView>
                        </SafeAreaView>
                    </Animated.View>
                </View>
            </Modal>
        </DrawerContext.Provider>
    );
}
