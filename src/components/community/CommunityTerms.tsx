import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    Modal,
    Pressable,
    ScrollView,
    Text,
    View,
    Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommunityColors } from './communityColors';
import { useTranslation } from '../../i18n/useTranslation';
import { safetyService } from '../../services/communitySafety';
import { useCommunitySafetyStatus } from '../../hooks/useCommunitySafety';
import { useAuthStore } from '../../store/useAuthStore';
const TermsContext = createContext<() => Promise<boolean>>(async () => false);
export const useCommunityTerms = () => useContext(TermsContext);
export function CommunityRules({ contact }: { contact?: string | null }) {
    const c = useCommunityColors(),
        { t } = useTranslation();
    return (
        <View style={{ gap: 18 }}>
            <Text style={{ color: c.fg, fontSize: 17, fontWeight: '700' }}>
                {t('safety.rulesTitle')}
            </Text>
            {['respect', 'rights', 'privacy', 'review'].map((key) => (
                <Text
                    key={key}
                    style={{ color: c.muted, fontSize: 15, lineHeight: 23 }}
                >
                    {t(`safety.rules.${key}`)}
                </Text>
            ))}
            <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(t('terms_of_use_url'))}
            >
                <Text style={{ color: c.accent, paddingVertical: 10 }}>
                    {t('terms_of_use')}
                </Text>
            </Pressable>
            <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(t('privacy_policy_url'))}
            >
                <Text style={{ color: c.accent, paddingVertical: 10 }}>
                    {t('privacy_policy')}
                </Text>
            </Pressable>
            {!!contact && (
                <Pressable
                    accessibilityRole="link"
                    onPress={() => void Linking.openURL(`mailto:${contact}`)}
                >
                    <Text style={{ color: c.accent, paddingVertical: 10 }}>
                        {t('safety.contact')}: {contact}
                    </Text>
                </Pressable>
            )}
        </View>
    );
}
export function CommunityTermsProvider({
    children,
    presentation = 'modal',
}: {
    children: ReactNode;
    presentation?: 'modal' | 'inline';
}) {
    const client = useQueryClient();
    const status = useCommunitySafetyStatus(),
        c = useCommunityColors(),
        { t } = useTranslation(),
        insets = useSafeAreaInsets();
    const userId = useAuthStore((s) => s.session?.user.id);
    const [visible, setVisible] = useState(false),
        [checked, setChecked] = useState(false),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(false);
    const pending = useRef<((accepted: boolean) => void)[]>([]);
    const version = useRef('');
    const dismiss = (accepted = false) => {
        setVisible(false);
        pending.current.splice(0).forEach((resolve) => resolve(accepted));
    };
    useEffect(() => {
        dismiss();
    }, [userId]);
    useEffect(
        () => () =>
            pending.current.splice(0).forEach((resolve) => resolve(false)),
        [],
    );
    const requireTerms = async () => {
        if (!userId) throw new Error('COMMUNITY_SAFETY_UNAVAILABLE');
        const fresh = await client.fetchQuery({
            queryKey: ['community-safety', userId, 'status'],
            queryFn: safetyService.status,
            staleTime: 60000,
        });
        if (fresh.restricted) throw new Error('COMMUNITY_RESTRICTED');
        if (fresh.accepted) return true;
        version.current = fresh.version;
        if (!pending.current.length) {
            setChecked(false);
            setError(false);
        }
        setVisible(true);
        return new Promise<boolean>((resolve) => pending.current.push(resolve));
    };
    const accept = async () => {
        setBusy(true);
        setError(false);
        try {
            await safetyService.accept(version.current);
            await status.refetch();
            dismiss(true);
        } catch {
            setError(true);
        } finally {
            setBusy(false);
        }
    };
    const consent = (
        <View
            style={{
                flex: 1,
                ...(presentation === 'inline'
                    ? {
                          position: 'absolute' as const,
                          inset: 0,
                          zIndex: 100,
                          elevation: 100,
                      }
                    : {}),
                justifyContent: 'flex-end',
                backgroundColor: '#00000066',
            }}
        >
            <View
                accessibilityViewIsModal
                style={{
                    maxHeight: '92%',
                    backgroundColor: c.bg,
                    borderTopLeftRadius: 28,
                    borderTopRightRadius: 28,
                }}
            >
                <ScrollView
                    contentContainerStyle={{
                        padding: 24,
                        gap: 22,
                        paddingBottom: Math.max(insets.bottom, 24),
                    }}
                >
                    <Text
                        style={{
                            color: c.fg,
                            fontWeight: '800',
                            fontSize: 26,
                        }}
                    >
                        {t('safety.beforePublish')}
                    </Text>
                    <CommunityRules contact={status.data?.contact} />
                    <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked, disabled: busy }}
                        disabled={busy}
                        onPress={() => setChecked(!checked)}
                        style={{
                            flexDirection: 'row',
                            gap: 12,
                            alignItems: 'center',
                            minHeight: 48,
                        }}
                    >
                        <View
                            style={{
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                borderWidth: 2,
                                borderColor: c.accent,
                                backgroundColor: checked
                                    ? c.accent
                                    : 'transparent',
                                alignItems: 'center',
                            }}
                        >
                            <Text style={{ color: c.onAccent }}>
                                {checked ? '✓' : ''}
                            </Text>
                        </View>
                        <Text
                            style={{
                                color: c.fg,
                                flex: 1,
                                lineHeight: 21,
                            }}
                        >
                            {t('safety.acceptLabel')}
                        </Text>
                    </Pressable>
                    {error && (
                        <Text
                            accessibilityLiveRegion="polite"
                            style={{ color: '#c44960' }}
                        >
                            {t('safety.error')}
                        </Text>
                    )}
                    <Pressable
                        accessibilityRole="button"
                        disabled={!checked || busy}
                        onPress={() => void accept()}
                        style={{
                            padding: 16,
                            borderRadius: 16,
                            backgroundColor: c.accent,
                            opacity: checked && !busy ? 1 : 0.5,
                        }}
                    >
                        <Text
                            style={{
                                color: c.onAccent,
                                textAlign: 'center',
                                fontWeight: '700',
                            }}
                        >
                            {t(busy ? 'safety.saving' : 'safety.accept')}
                        </Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => dismiss()}
                        style={{ padding: 12 }}
                    >
                        <Text
                            style={{
                                color: c.muted,
                                textAlign: 'center',
                            }}
                        >
                            {t('cancel')}
                        </Text>
                    </Pressable>
                </ScrollView>
            </View>
        </View>
    );
    return (
        <TermsContext.Provider value={requireTerms}>
            {presentation === 'inline' ? (
                <View style={{ flex: 1 }}>
                    <View
                        style={{ flex: 1 }}
                        pointerEvents={visible ? 'none' : 'auto'}
                        accessibilityElementsHidden={visible}
                        importantForAccessibility={
                            visible ? 'no-hide-descendants' : 'auto'
                        }
                    >
                        {children}
                    </View>
                    {visible ? consent : null}
                </View>
            ) : (
                <>
                    {children}
                    <Modal
                        visible={visible}
                        transparent
                        animationType="slide"
                        onRequestClose={() => { if (!busy) dismiss(); }}
                    >
                        {consent}
                    </Modal>
                </>
            )}
        </TermsContext.Provider>
    );
}
