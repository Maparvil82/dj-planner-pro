import { useCommunitySafetyStatus } from '../../hooks/useCommunitySafety';
import { FEATURES } from '../../config/features';
import {
    Fragment,
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import {
    Animated,
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { X, ChevronRight, LogOut, Bell, Headphones, Lightbulb, Settings, ShieldCheck, CalendarCheck, Palette, Sparkles, ArrowUpRight } from 'lucide-react-native';
import { confirmAction } from '../../utils/confirmAction';
import { showError } from '../../utils/showError';
import { useAuthStore } from '../../store/useAuthStore';
import { useTranslation } from '../../i18n/useTranslation';
import { useUnreadNotifications } from '../../hooks/useNotifications';
import { useSessionUsage } from '../../hooks/useSessionUsage';
import { useCommunityColors } from '../community/CommunityUI';
import { AppLogo } from '../ui/AppLogo';
import { AppearancePicker } from '../profile/AppearancePicker';
import { useTheme } from '../../contexts/ThemeContext';
import { TabProfileIcon } from '../ui/TabProfileIcon';

const DrawerContext = createContext<{
    open: () => void;
    isPro: boolean;
} | null>(null);
export function useOpenAccountMenu() {
    const menu = useContext(DrawerContext);
    return () => menu?.open();
}
export function useAccountIsPro() {
    return useContext(DrawerContext)?.isPro === true;
}
export function AccountAvatarButton({ tab = false }: { tab?: boolean }) {
    const menu = useContext(DrawerContext);
    const { profile, session } = useAuthStore();
    const { t } = useTranslation();
    const c = useCommunityColors();
    const unread = useUnreadNotifications();
    if (!menu || !session) return null;
    const Container = tab ? View : Pressable;
    return (
        <Container
            accessibilityRole={tab ? undefined : 'button'}
            accessibilityLabel={
                tab
                    ? undefined
                    : t('accountMenu.open') +
                      (menu.isPro ? `, ${t('billing.proPlan')}` : '') +
                      (unread.data
                          ? `, ${t('notifications.openUnread', { count: unread.data })}`
                          : '')
            }
            onPress={tab ? undefined : menu.open}
            style={{
                width: tab ? 24 : 46,
                height: tab ? 24 : 46,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <TabProfileIcon
                url={profile?.avatar_url}
                name={profile?.artist_name || session.user.email}
                size={tab ? 24 : 36}
                color={c.fg}
                focused={false}
                unreadCount={unread.data || 0}
            />
            {menu.isPro && (
                <View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        width: tab ? 30 : 42,
                        height: tab ? 30 : 42,
                        borderRadius: tab ? 15 : 21,
                        borderWidth: 2,
                        borderColor: c.accent,
                    }}
                />
            )}
            {menu.isPro && !tab && <View pointerEvents="none" style={{ position: 'absolute', bottom: -2, alignSelf: 'center', borderRadius: 6, backgroundColor: c.accent, paddingHorizontal: 5, paddingVertical: 1 }}>
                <Text style={{ color: c.onAccent, fontSize: 8, lineHeight: 11, fontWeight: '800' }}>PRO</Text>
            </View>}
        </Container>
    );
}
export function AccountDrawerProvider({ children }: { children: ReactNode }) {
    const insets = useSafeAreaInsets();
    const [open, setOpen] = useState(false);
    const [appearanceOpen, setAppearanceOpen] = useState(false);
    const { theme } = useTheme();
    const { width } = useWindowDimensions();
    const drawerWidth = Math.min(360, width * 0.88);
    const translate = useRef(new Animated.Value(-drawerWidth)).current;
    const { profile, session } = useAuthStore();
    const c = useCommunityColors();
    const { t } = useTranslation();
    const router = useRouter();
    const pendingRoute = useRef<Href | null>(null);
    useEffect(() => {
        if (open || !pendingRoute.current) return;
        const destination = pendingRoute.current;
        pendingRoute.current = null;
        router.push(destination);
    }, [open, router]);
    const unread = useUnreadNotifications();
    const usage = useSessionUsage();
    const close = () => { setAppearanceOpen(false); setOpen(false); };
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
        translate.setValue(-drawerWidth);
        setOpen(true);
        void unread.refetch();
        void usage.refetch();
    };
    const navigate = (href: Href) => {
        // Commit the closed Modal before navigating, so a frozen previous screen cannot keep it open.
        pendingRoute.current = href;
        close();
    };
    const safety = useCommunitySafetyStatus();
    const rows: { key: string; href: Href; count?: number }[] = [
        {
            key: 'notifications',
            href: '/notifications',
            count: unread.data || 0,
        },
        { key: 'savedMixes', href: '/saved-mixes' },
        ...(FEATURES.bookings
            ? [{ key: 'bookings', href: '/bookings' as Href }]
            : []),
        { key: 'feedback', href: '/feedback' },
        { key: 'settings', href: '/profile?section=settings' },
        ...(safety.data?.moderator ? [{ key: 'moderation', href: '/moderation' as Href }] : []),
    ];
    return (
        <DrawerContext.Provider
            value={{ open: show, isPro: usage.data?.isPro === true }}
        >
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
                    <Animated.View
                        accessibilityViewIsModal
                        style={{
                            width: drawerWidth,
                            height: '100%',
                            backgroundColor: c.card,
                            borderTopRightRadius: 28,
                            borderBottomRightRadius: 28,
                            overflow: 'hidden',
                            transform: [{ translateX: translate }],
                        }}
                    >
                        <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}>
                                <AppLogo size={32} decorative />
                                <Text style={{ flex: 1, color: c.fg, fontSize: 18, fontWeight: '700', letterSpacing: -0.4 }}>DJ Planner</Text>
                                <Pressable accessibilityRole="button" accessibilityLabel={t('accountMenu.close')} onPress={close} style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.field }}><X size={20} color={c.muted} /></Pressable>
                            </View>
                            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}>
                                {[rows.filter(row => ['notifications', 'savedMixes', 'bookings'].includes(row.key)), rows.filter(row => ['settings', 'feedback'].includes(row.key)).sort((a, b) => Number(b.key === 'settings') - Number(a.key === 'settings')), rows.filter(row => row.key === 'moderation')].filter(group => group.length).map((group, index) => <View key={index} style={{ borderRadius: 12, backgroundColor: group[0]?.key === 'moderation' ? 'transparent' : c.field, overflow: 'hidden' }}>
                                    {group.map((row, rowIndex) => {
                                        const Icon = ({ notifications: Bell, savedMixes: Headphones, bookings: CalendarCheck, feedback: Lightbulb, settings: Settings, moderation: ShieldCheck } as Record<string, typeof Bell>)[row.key];
                                        return <Fragment key={row.key}>
                                        {row.key === 'settings' && <Pressable accessibilityRole="button" accessibilityLabel={`${t('appearance')}, ${t(`theme_${theme}`)}`} onPress={() => setAppearanceOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, padding: 14, borderTopWidth: 0, borderTopColor: c.border, backgroundColor: c.field }}>
                                    <Palette size={19} color={c.muted} />
                                    <View style={{ flex: 1, gap: 4 }}><Text style={{ color: c.fg, fontSize: 14, fontWeight: '500' }}>{t('appearance')}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{t(`theme_${theme}`)}</Text></View>
                                    <ChevronRight size={16} color={c.muted} />
                                </Pressable>}
                                        <Pressable accessibilityRole="button" accessibilityLabel={t(`accountMenu.${row.key}`) + (row.count ? `, ${row.count}` : '')} onPress={() => navigate(row.href)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 56, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'transparent', borderTopWidth: rowIndex || row.key === 'settings' ? 0.5 : 0, borderTopColor: c.border }}>
                                            <Icon size={19} color={c.muted} />
                                            <Text style={{ flex: 1, color: c.fg, fontSize: 14, fontWeight: '500' }}>{t(`accountMenu.${row.key}`)}</Text>
                                            {!!row.count && <View style={{ backgroundColor: c.accent, borderRadius: 10, minWidth: 22, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: c.onAccent, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>{row.count > 99 ? '99+' : row.count}</Text></View>}
                                            <ChevronRight size={16} color={c.muted} />
                                        </Pressable>

                                        </Fragment>;
                                    })}
                                </View>)}

                            </ScrollView>
                            {usage.data && !usage.data.isPro && <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}>
                                <Pressable accessibilityRole="button" accessibilityLabel={t('accountMenu.discoverPro')} onPress={() => navigate('/pro')} style={{ padding: 18, borderRadius: 20, backgroundColor: c.dark ? '#30285C' : '#35316e', borderWidth: 1, borderColor: '#ffffff20', gap: 12, overflow: 'hidden' }}>
                                    <View pointerEvents="none" style={{ position: 'absolute', right: -26, top: -42, width: 135, height: 135, borderRadius: 70, backgroundColor: '#ffffff08', borderWidth: 1, borderColor: '#ffffff12' }} />
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Sparkles size={15} color="#d8cffc" /><Text style={{ color: '#e5deff', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 }}>DJ PLANNER PRO</Text></View>
                                    <Text style={{ color: '#ffffff', fontSize: 19, lineHeight: 25, fontWeight: '600', maxWidth: '90%' }}>{t('accountMenu.proTitle')}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 }}><Text style={{ color: '#e5deff', fontSize: 13, fontWeight: '600' }}>{t('accountMenu.discoverPro')}</Text><View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff18' }}><ArrowUpRight size={17} color="#ffffff" /></View></View>
                                </Pressable>
                            </View>}
                            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderTopWidth: 0.5, borderColor: c.border }}>
                                <Pressable accessibilityRole="button" accessibilityLabel={t('accountMenu.profile')} onPress={() => navigate('/profile')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 84, borderRadius: 20, backgroundColor: c.field }}>
                                    <TabProfileIcon url={profile?.avatar_url} name={profile?.artist_name || session?.user.email} size={42} color={c.fg} focused={false} />
                                    <View style={{ flex: 1, gap: 6 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text numberOfLines={1} style={{ flexShrink: 1, color: c.fg, fontSize: 15, fontWeight: '600' }}>{profile?.artist_name || t('unifiedProfile.title')}</Text>{usage.data?.isPro && <View style={{ backgroundColor: c.accent, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 }}><Text style={{ color: c.onAccent, fontSize: 9, fontWeight: '800' }}>PRO</Text></View>}</View>
                                        <Text style={{ color: c.muted, fontSize: 12 }}>{t('accountMenu.profile')}</Text>
                                    </View>
                                    <ChevronRight size={17} color={c.muted} />
                                </Pressable>
                            </View>
                            <AppearancePicker visible={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
                        </View>
                    </Animated.View>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('accountMenu.close')}
                        onPress={close}
                        style={{ flex: 1 }}
                    />
                </View>
            </Modal>
        </DrawerContext.Provider>
    );
}

export function AccountLogoutButton() {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const { signOut } = useAuthStore();
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const logout = async () => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        try {
            if (await confirmAction(t('log_out'), t('accountMenu.logoutConfirm'), t('cancel'), t('log_out'))) await signOut();
        } catch { showError(t('log_out'), t('authExperience.connectionError')); }
        finally { lock.current = false; setBusy(false); }
    };
    return <Pressable testID="account-menu-logout" accessibilityRole="button" accessibilityLabel={t('log_out')} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void logout()} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: busy ? 0.5 : 1 }}>
        {busy ? <ActivityIndicator color={c.muted} /> : <LogOut size={20} color={c.muted} />}
        <Text style={{ color: c.fg, fontSize: 14, fontWeight: '500' }}>{t('log_out')}</Text>
    </Pressable>;
}
