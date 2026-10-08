import { useRef, useState } from 'react';
import {
    Modal,
    Platform,
    ScrollView,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { decode } from 'base64-arraybuffer';
import { useTranslation } from '../../i18n/useTranslation';
import { CommunityButton, useCommunityColors } from '../community/CommunityUI';
import { SessionFormHeader } from '../sessions/SessionFormLayout';
import { sessionDisplayTitle } from '../../utils/sessionNaming';
import { ticketQrValue } from '../../utils/ticketing';
import type { Session } from '../../types/session';
import type { EventTicket, TicketType } from '../../services/tickets';

export function TicketPassSheet({
    ticket,
    kind,
    session,
    onClose,
    onChange,
}: {
    ticket: EventTicket;
    kind: TicketType;
    session: Session;
    onClose: () => void;
    onChange: (action: 'cancel' | 'paid') => Promise<void>;
}) {
    const { t } = useTranslation(),
        c = useCommunityColors(),
        { width, height } = useWindowDimensions();
    const svg = useRef<Svg>(null);
    const [busy, setBusy] = useState(false),
        [error, setError] = useState(''),
        [confirm, setConfirm] = useState(false);
    const title = sessionDisplayTitle(session, t),
        shortId = ticket.id.slice(0, 8).toUpperCase();
    async function share() {
        setBusy(true);
        setError('');
        try {
            if (Platform.OS === 'web') {
                const node = document
                    .getElementById('ticket-pass')
                    ?.querySelector('svg');
                if (!node) throw new Error();
                const source = new XMLSerializer().serializeToString(node);
                const dataUrl =
                    'data:image/svg+xml;charset=utf-8,' +
                    encodeURIComponent(source);
                const image = new window.Image();
                await new Promise<void>((resolve, reject) => {
                    image.onload = () => resolve();
                    image.onerror = reject;
                    image.src = dataUrl;
                });
                const canvas = document.createElement('canvas');
                canvas.width = 960;
                canvas.height = 1500;
                const context = canvas.getContext('2d');
                if (!context) throw new Error();
                context.drawImage(image, 0, 0, 960, 1500);
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = `DJ-Planner-${shortId}.png`;
                link.click();
            } else {
                const data = await new Promise<string>((resolve, reject) => {
                    const timer = setTimeout(() => reject(new Error()), 8000);
                    if (!svg.current) {
                        clearTimeout(timer);
                        reject(new Error());
                        return;
                    }
                    svg.current.toDataURL(
                        (data) => {
                            clearTimeout(timer);
                            resolve(data);
                        },
                        { width: 960, height: 1500 },
                    );
                });
                const file = new File(Paths.cache, `DJ-Planner-${shortId}.png`);
                file.create({ overwrite: true });
                file.write(new Uint8Array(decode(data)));
                if (!(await Sharing.isAvailableAsync())) throw new Error();
                await Sharing.shareAsync(file.uri, {
                    mimeType: 'image/png',
                    UTI: 'public.png',
                });
            }
        } catch {
            setError(t('tickets.shareError'));
        } finally {
            setBusy(false);
        }
    }
    async function change(action: 'cancel' | 'paid') {
        setBusy(true);
        setError('');
        try {
            await onChange(action);
            setConfirm(false);
        } catch (e) {
            setError(
                t(e instanceof Error ? e.message : 'tickets.connectionError'),
            );
        } finally {
            setBusy(false);
        }
    }
    return (
        <Modal
            visible
            transparent
            animationType="slide"
            onRequestClose={() => !busy && onClose()}
        >
            <View
                style={{
                    flex: 1,
                    justifyContent: 'flex-end',
                    backgroundColor: '#0008',
                }}
            >
                <SafeAreaView
                    edges={['bottom']}
                    style={{
                        height: Math.min(height * 0.94, 960),
                        backgroundColor: c.bg,
                        borderTopLeftRadius: 28,
                        borderTopRightRadius: 28,
                    }}
                >
                    <SessionFormHeader
                        title={t('tickets.ticket')}
                        subtitle={shortId}
                        onClose={() => !busy && onClose()}
                    />
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{
                            paddingHorizontal: 20,
                            paddingBottom: 24,
                            gap: 14,
                            alignItems: 'stretch',
                        }}
                    >
                        <View
                            nativeID="ticket-pass"
                            style={{ alignSelf: 'center' }}
                        >
                            <Svg
                                ref={svg}
                                width={Math.min(width - 40, 320)}
                                height={(Math.min(width - 40, 320) * 500) / 320}
                                viewBox="0 0 320 500"
                            >
                                <Rect
                                    width="320"
                                    height="500"
                                    rx="22"
                                    fill="#fff"
                                />
                                <Rect width="320" height="10" fill="#6554df" />
                                <SvgText
                                    x="24"
                                    y="40"
                                    fontSize="11"
                                    fontWeight="700"
                                    fill="#6554df"
                                >
                                    DJ PLANNER
                                </SvgText>
                                <SvgText
                                    x="24"
                                    y="74"
                                    fontSize="18"
                                    fontWeight="700"
                                    fill="#202538"
                                >
                                    {title.length > 27
                                        ? title.slice(0, 26) + '…'
                                        : title}
                                </SvgText>
                                <SvgText
                                    x="24"
                                    y="99"
                                    fontSize="13"
                                    fill="#6d7588"
                                >
                                    {session.venue.slice(0, 38)}
                                </SvgText>
                                <SvgText
                                    x="24"
                                    y="124"
                                    fontSize="13"
                                    fill="#202538"
                                >
                                    {session.date} ·{' '}
                                    {session.start_time.slice(0, 5)}
                                </SvgText>
                                {ticket.state !== 'cancelled' && (
                                    <G x="40" y="151">
                                        <QRCode
                                            value={ticketQrValue(ticket.token)}
                                            size={240}
                                            quietZone={12}
                                            ecl="M"
                                        />
                                    </G>
                                )}
                                <SvgText
                                    x="160"
                                    y="423"
                                    textAnchor="middle"
                                    fontSize="16"
                                    fontWeight="700"
                                    fill="#202538"
                                >
                                    {kind.name.slice(0, 28)}
                                </SvgText>
                                <SvgText
                                    x="160"
                                    y="447"
                                    textAnchor="middle"
                                    fontSize="13"
                                    fill="#6554df"
                                >
                                    {Number(kind.price).toFixed(2)}{' '}
                                    {session.currency} ·{' '}
                                    {t(
                                        `tickets.${ticket.state === 'issued' ? ticket.payment_status : ticket.state}`,
                                    )}
                                </SvgText>
                                <SvgText
                                    x="160"
                                    y="478"
                                    textAnchor="middle"
                                    fontSize="11"
                                    fill="#6d7588"
                                >
                                    {shortId} · {t('tickets.singleUse')}
                                </SvgText>
                            </Svg>
                        </View>
                        <Text
                            style={{
                                color: c.muted,
                                textAlign: 'center',
                                lineHeight: 20,
                            }}
                        >
                            {t('tickets.shareHint')}
                        </Text>
                        {!!error && (
                            <Text
                                accessibilityRole="alert"
                                style={{ color: '#c83d53' }}
                            >
                                {error}
                            </Text>
                        )}
                        <CommunityButton
                            label={t('tickets.share')}
                            onPress={share}
                            busy={busy}
                            disabled={ticket.state !== 'issued'}
                        />
                        {ticket.state === 'issued' &&
                            ticket.payment_status === 'pending' && (
                                <CommunityButton
                                    secondary
                                    label={t('tickets.markPaid')}
                                    onPress={() => change('paid')}
                                    disabled={busy}
                                />
                            )}
                        {ticket.state === 'issued' &&
                            (confirm ? (
                                <View style={{ gap: 10 }}>
                                    <Text style={{ color: c.fg }}>
                                        {t('tickets.cancelHint')}
                                    </Text>
                                    <CommunityButton
                                        label={t('tickets.confirmCancel')}
                                        onPress={() => change('cancel')}
                                        disabled={busy}
                                    />
                                    <CommunityButton
                                        secondary
                                        label={t('cancel')}
                                        onPress={() => setConfirm(false)}
                                        disabled={busy}
                                    />
                                </View>
                            ) : (
                                <CommunityButton
                                    outlined
                                    label={t('tickets.cancelTicket')}
                                    onPress={() => setConfirm(true)}
                                    disabled={busy}
                                />
                            ))}
                    </ScrollView>
                </SafeAreaView>
            </View>
        </Modal>
    );
}
