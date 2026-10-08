import { useCallback, useEffect, useRef, useState } from 'react';
import {
    AppState,
    ActivityIndicator,
    Linking,
    Platform,
    Text,
    TextInput,
    View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
    Redirect,
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../src/store/useAuthStore';
import { useSessionByIdQuery } from '../src/hooks/useSessionsQuery';
import { useTranslation } from '../src/i18n/useTranslation';
import { ticketService, type ScanResult } from '../src/services/tickets';
import { parseTicketQr } from '../src/utils/ticketing';
import { sessionDisplayTitle } from '../src/utils/sessionNaming';
import {
    CommunityButton,
    CommunityMessage,
    useCommunityColors,
} from '../src/components/community/CommunityUI';
import { SessionFormHeader } from '../src/components/sessions/SessionFormLayout';

export default function TicketScannerScreen() {
    const { sessionId } = useLocalSearchParams<{ sessionId: string }>(),
        router = useRouter(),
        c = useCommunityColors(),
        { t, currentLanguage } = useTranslation();
    const userId = useAuthStore((s) => s.session?.user.id),
        client = useQueryClient();
    const event = useSessionByIdQuery(sessionId);
    const [permission, requestPermission] = useCameraPermissions();
    const [focused, setFocused] = useState(false),
        [foreground, setForeground] = useState(
            AppState.currentState === 'active',
        );
    const [result, setResult] = useState<ScanResult | null>(null),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(''),
        [torch, setTorch] = useState(false),
        [manual, setManual] = useState('');
    const paying = useRef(false);
    const locked = useRef(false),
        lastToken = useRef<string | null>(null),
        alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        const subscription = AppState.addEventListener('change', (state) =>
            setForeground(state === 'active'),
        );
        return () => {
            alive.current = false;
            subscription.remove();
        };
    }, []);
    useFocusEffect(
        useCallback(() => {
            setFocused(true);
            return () => setFocused(false);
        }, []),
    );
    async function scan(data: string) {
        if (locked.current) return;
        locked.current = true;
        setBusy(true);
        setError('');
        const token = parseTicketQr(data.trim());
        lastToken.current = token;
        try {
            const response = token
                ? await ticketService.scan(sessionId, token)
                : { status: 'invalid' as const };
            if (!alive.current) return;
            setResult(response);
            void client.invalidateQueries({
                queryKey: ['tickets', userId, sessionId],
            });
        } catch (e) {
            if (alive.current)
                setError(
                    t(
                        e instanceof Error
                            ? e.message
                            : 'tickets.connectionError',
                    ),
                );
        } finally {
            if (alive.current) setBusy(false);
        }
    }
    function reset() {
        locked.current = false;
        setResult(null);
        setError('');
        setManual('');
        lastToken.current = null;
    }
    async function payAndAdmit() {
        if (!result?.ticket_id || paying.current || busy || !lastToken.current)
            return;
        paying.current = true;
        setBusy(true);
        setError('');
        try {
            await ticketService.change(sessionId, result.ticket_id, 'paid');
            const admitted = await ticketService.scan(
                sessionId,
                lastToken.current,
            );
            if (alive.current) {
                setResult(admitted);
                void client.invalidateQueries({
                    queryKey: ['tickets', userId, sessionId],
                });
            }
        } catch (e) {
            if (alive.current)
                setError(
                    t(
                        e instanceof Error
                            ? e.message
                            : 'tickets.connectionError',
                    ),
                );
        } finally {
            paying.current = false;
            if (alive.current) setBusy(false);
        }
    }
    if (!userId) return <Redirect href="/(auth)/login" />;
    const allowed =
        event.data?.user_id === userId &&
        !event.data.is_guest &&
        event.data.status !== 'cancelled';
    const statusColor =
        result?.status === 'accepted'
            ? '#159b7c'
            : result?.status === 'pending'
              ? '#b27615'
              : '#cb435b';
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
            <SessionFormHeader
                title={t('tickets.scan')}
                subtitle={
                    event.data
                        ? sessionDisplayTitle(event.data, t)
                        : t('tickets.title')
                }
                onClose={() => router.back()}
            />
            <View
                style={{
                    flex: 1,
                    paddingHorizontal: 20,
                    paddingBottom: 24,
                    gap: 16,
                }}
            >
                {event.isPending ? (
                    <ActivityIndicator color={c.accent} />
                ) : !allowed ? (
                    <CommunityMessage
                        title={t('tickets.unavailable')}
                        retry={
                            event.isError
                                ? () => void event.refetch()
                                : undefined
                        }
                    />
                ) : (
                    <>
                        <Text style={{ color: c.muted, lineHeight: 20 }}>
                            {t('tickets.scanHint')}
                        </Text>
                        {result || error || busy ? (
                            <View
                                style={{
                                    flex: 1,
                                    justifyContent: 'center',
                                    gap: 18,
                                }}
                            >
                                {busy ? (
                                    <ActivityIndicator
                                        size="large"
                                        color={c.accent}
                                    />
                                ) : (
                                    <>
                                        {!!result && (
                                            <View
                                                accessibilityRole="alert"
                                                style={{
                                                    backgroundColor: c.card,
                                                    borderRadius: 24,
                                                    padding: 28,
                                                    borderTopWidth: 6,
                                                    borderColor: statusColor,
                                                    gap: 14,
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        color: statusColor,
                                                        fontSize: 28,
                                                        fontWeight: '800',
                                                    }}
                                                >
                                                    {t(
                                                        `tickets.result_${result.status}`,
                                                    )}
                                                </Text>
                                                {!!result.type_name && (
                                                    <Text
                                                        style={{
                                                            color: c.fg,
                                                            fontSize: 18,
                                                            fontWeight: '600',
                                                        }}
                                                    >
                                                        {result.type_name}
                                                    </Text>
                                                )}
                                                {!!result.checked_in_at && (
                                                    <Text
                                                        style={{
                                                            color: c.muted,
                                                        }}
                                                    >
                                                        {new Date(
                                                            result.checked_in_at,
                                                        ).toLocaleString(
                                                            currentLanguage,
                                                        )}
                                                    </Text>
                                                )}
                                                {result.status ===
                                                    'pending' && (
                                                    <Text
                                                        style={{
                                                            color: c.muted,
                                                        }}
                                                    >
                                                        {t(
                                                            'tickets.pendingHint',
                                                            {
                                                                price: `${result.price} ${event.data?.currency || '€'}`,
                                                            },
                                                        )}
                                                    </Text>
                                                )}
                                                {result.status ===
                                                    'invalid' && (
                                                    <Text
                                                        style={{
                                                            color: c.muted,
                                                        }}
                                                    >
                                                        {t(
                                                            'tickets.invalidHint',
                                                        )}
                                                    </Text>
                                                )}
                                            </View>
                                        )}
                                        {!!error && (
                                            <Text
                                                accessibilityRole="alert"
                                                style={{
                                                    color: '#cb435b',
                                                    fontSize: 16,
                                                }}
                                            >
                                                {error}
                                            </Text>
                                        )}
                                        {result?.status === 'pending' && (
                                            <CommunityButton
                                                label={t('tickets.payAndAdmit')}
                                                onPress={payAndAdmit}
                                            />
                                        )}
                                        <CommunityButton
                                            secondary
                                            label={t('tickets.scanNext')}
                                            onPress={reset}
                                        />
                                    </>
                                )}
                            </View>
                        ) : !permission ? (
                            <ActivityIndicator color={c.accent} />
                        ) : !permission.granted ? (
                            <View
                                style={{
                                    flex: 1,
                                    justifyContent: 'center',
                                    gap: 18,
                                }}
                            >
                                <Text
                                    style={{
                                        color: c.fg,
                                        fontSize: 20,
                                        fontWeight: '700',
                                    }}
                                >
                                    {t('tickets.cameraTitle')}
                                </Text>
                                <Text
                                    style={{ color: c.muted, lineHeight: 22 }}
                                >
                                    {t('tickets.cameraHint')}
                                </Text>
                                <CommunityButton
                                    label={t(
                                        permission.canAskAgain
                                            ? 'tickets.allowCamera'
                                            : 'tickets.openSettings',
                                    )}
                                    onPress={() => {
                                        if (permission.canAskAgain)
                                            void requestPermission().catch(() =>
                                                setError(
                                                    t('tickets.cameraError'),
                                                ),
                                            );
                                        else
                                            void Linking.openSettings().catch(
                                                () =>
                                                    setError(
                                                        t(
                                                            'tickets.cameraError',
                                                        ),
                                                    ),
                                            );
                                    }}
                                />
                            </View>
                        ) : (
                            <>
                                <View
                                    style={{
                                        flex: 1,
                                        minHeight: 240,
                                        overflow: 'hidden',
                                        borderRadius: 24,
                                        backgroundColor: '#111',
                                    }}
                                >
                                    {focused && foreground && (
                                        <CameraView
                                            style={{ flex: 1 }}
                                            facing="back"
                                            enableTorch={torch}
                                            barcodeScannerSettings={{
                                                barcodeTypes: ['qr'],
                                            }}
                                            onBarcodeScanned={({ data }) =>
                                                void scan(data)
                                            }
                                            onMountError={() =>
                                                setError(
                                                    t('tickets.cameraError'),
                                                )
                                            }
                                        />
                                    )}
                                    <View
                                        pointerEvents="none"
                                        style={{
                                            position: 'absolute',
                                            alignSelf: 'center',
                                            top: '25%',
                                            width: 220,
                                            height: 220,
                                            borderWidth: 2,
                                            borderColor: '#fff',
                                            borderRadius: 20,
                                        }}
                                    />
                                </View>
                                {Platform.OS !== 'web' && (
                                    <CommunityButton
                                        secondary
                                        label={t(
                                            torch
                                                ? 'tickets.torchOff'
                                                : 'tickets.torchOn',
                                        )}
                                        onPress={() => setTorch(!torch)}
                                    />
                                )}
                                {Platform.OS === 'web' && (
                                    <>
                                        <TextInput
                                            accessibilityLabel={t(
                                                'tickets.manualQr',
                                            )}
                                            placeholder={t('tickets.manualQr')}
                                            placeholderTextColor={c.muted}
                                            value={manual}
                                            onChangeText={setManual}
                                            style={{
                                                padding: 14,
                                                color: c.fg,
                                                borderWidth: 1,
                                                borderColor: c.border,
                                                borderRadius: 14,
                                            }}
                                        />
                                        <CommunityButton
                                            label={t('tickets.validate')}
                                            disabled={!manual}
                                            onPress={() => scan(manual)}
                                        />
                                    </>
                                )}
                            </>
                        )}
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}
