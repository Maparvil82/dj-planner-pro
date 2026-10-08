import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Modal,
    Platform,
    Pressable,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { Plus } from 'lucide-react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/CommunityUI';

function CreationIcon({ kind, color }: { kind: string; color: string }) {
    return (
        <Svg width={30} height={30} viewBox="0 0 24 24">
            {kind === 'session' ? (
                <>
                    <Rect
                        x={3}
                        y={4}
                        width={18}
                        height={18}
                        rx={4}
                        fill={color}
                    />
                    <Rect
                        x={7}
                        y={1}
                        width={3}
                        height={7}
                        rx={1.5}
                        fill={color}
                    />
                    <Rect
                        x={14}
                        y={1}
                        width={3}
                        height={7}
                        rx={1.5}
                        fill={color}
                    />
                    <Rect
                        x={6}
                        y={9}
                        width={12}
                        height={2}
                        rx={1}
                        fill="#fff"
                    />
                    {[7, 12, 17].map((x) =>
                        [14, 18].map((y) => (
                            <Circle
                                key={`${x}-${y}`}
                                cx={x}
                                cy={y}
                                r={1.2}
                                fill="#fff"
                            />
                        )),
                    )}
                </>
            ) : kind === 'conditional' ? (
                <>
                    <Circle cx={12} cy={12} r={10} fill={color} />
                    <Path
                        d="M12 6v6h5"
                        stroke="#fff"
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />
                </>
            ) : kind === 'guests' ? (
                <>
                    <Circle cx={9} cy={7} r={4} fill={color} />
                    <Path d="M1 22v-4a8 8 0 0 1 16 0v4z" fill={color} />
                    <Circle cx={18} cy={8} r={3} fill={color} />
                    <Path
                        d="M18 14a6 6 0 0 1 5 6v2h-4v-4a10 10 0 0 0-1-4z"
                        fill={color}
                    />
                </>
            ) : kind === 'tickets' ? (
                <>
                    <Rect
                        x={2}
                        y={5}
                        width={20}
                        height={14}
                        rx={3}
                        fill={color}
                    />
                    <Path
                        d="M16 6v2m0 3v2m0 3v2"
                        stroke="#fff"
                        strokeWidth={2}
                        strokeLinecap="round"
                    />
                    <Rect x={5} y={9} width={7} height={6} rx={1} fill="#fff" />
                </>
            ) : kind === 'mix' ? (
                <Path
                    d="M20 2v14.5a3.5 3.5 0 1 1-2-3.16V6.5l-9 2V19a3.5 3.5 0 1 1-2-3.16V5z"
                    fill={color}
                />
            ) : (
                <Path
                    d="M12 1a8 8 0 0 0-8 8c0 5.5 8 14 8 14s8-8.5 8-14a8 8 0 0 0-8-8zm0 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z"
                    fillRule="evenodd"
                    fill={color}
                />
            )}
        </Svg>
    );
}

export function AddSessionButton() {
    const router = useRouter();
    const { t } = useTranslation();
    const c = useCommunityColors();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const columnWidth = (width - 24) / 4;
    const [open, setOpen] = useState(false);
    const destination = useRef<Href | null>(null);
    const selecting = useRef(false);
    useEffect(() => {
        if (open) {
            router.prefetch('/add-session');
            router.prefetch('/add-mix');
            router.prefetch('/venues');
            router.prefetch('/conditional-session');
            router.prefetch('/tickets');
            router.prefetch('/guests');
        }
    }, [open, router]);
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
        if (selecting.current) return;
        selecting.current = true;
        setOpen(false);
        // Push a normal screen while the menu closes, instead of chaining
        // two animations. Modal destinations dismiss the menu without animation
        // before presentation, avoiding overlapping native sheets.
        if (
            href === '/add-session' ||
            href === '/conditional-session' ||
            href === '/tickets' ||
            href === '/guests'
        )
            router.push(href);
        else destination.current = href;
    };
    const actions = [
        { key: 'session', color: '#2783ef', href: '/add-session' },
        { key: 'conditional', color: '#ee9b21', href: '/conditional-session' },
        { key: 'mix', color: '#7b50e8', href: '/add-mix' },
        { key: 'venue', color: '#06ad85', href: '/venues?create=1' },
        { key: 'tickets', color: '#e35d72', href: '/tickets' },
        { key: 'guests', color: '#16a5ad', href: '/guests' },
    ] as const;
    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('createMenu.title')}
                onPress={() => {
                    selecting.current = false;
                    setOpen(true);
                }}
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
                animationType={selecting.current ? 'none' : 'slide'}
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
                                width: '100%',
                                flexDirection: 'row',
                                alignItems: 'flex-start',
                                flexWrap: 'wrap',
                                rowGap: 24,
                            }}
                        >
                            {actions.map((action) => {
                                const enabled = 'href' in action;
                                return (
                                    <View
                                        key={action.key}
                                        style={{
                                            width: columnWidth,
                                            flexShrink: 0,
                                            paddingHorizontal: 4,
                                        }}
                                    >
                                        <Pressable
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
                                            style={{
                                                width: '100%',
                                                alignItems: 'center',
                                                opacity: enabled ? 1 : 0.6,
                                            }}
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
                                                <CreationIcon
                                                    kind={action.key}
                                                    color={action.color}
                                                />
                                            </View>
                                            {action.key === 'conditional' && (
                                                <Text
                                                    style={{
                                                        position: 'absolute',
                                                        top: 46,
                                                        backgroundColor:
                                                            '#ee9b21',
                                                        color: '#fff',
                                                        borderRadius: 5,
                                                        paddingHorizontal: 4,
                                                        fontSize: 8,
                                                        fontWeight: '800',
                                                    }}
                                                >
                                                    PRO
                                                </Text>
                                            )}
                                            <Text
                                                numberOfLines={1}
                                                adjustsFontSizeToFit
                                                minimumFontScale={0.8}
                                                style={{
                                                    width: '100%',
                                                    height: 18,
                                                    marginTop: 10,
                                                    color: c.fg,
                                                    fontWeight: '600',
                                                    fontSize:
                                                        width < 360 ? 11 : 12,
                                                    lineHeight: 16,
                                                    textAlign: 'center',
                                                }}
                                            >
                                                {t(`createMenu.${action.key}`)}
                                            </Text>
                                        </Pressable>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}
