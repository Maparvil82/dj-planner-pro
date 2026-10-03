import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { BookingThreadScreen } from '../../src/components/bookings/BookingThread';
import {
    BookingPage,
    BookingCard,
    BookingText,
} from '../../src/components/bookings/BookingUI';
import { useTranslation } from '../../src/i18n/useTranslation';
export default function PromoterConversation() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { t } = useTranslation();
    const router = useRouter();
    const [access, setAccess] = useState<string | null>(null);
    useEffect(() => {
        if (Platform.OS !== 'web') {
            setAccess('');
            return;
        }
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const incoming = fragment.get('access');
        const key = `booking-access:${id}`;
        try {
            if (incoming && /^[a-f0-9]{64}$/.test(incoming))
                sessionStorage.setItem(key, incoming);
            setAccess(sessionStorage.getItem(key) || '');
        } catch {
            setAccess(incoming || '');
        }
        // Clear navigation state too: Expo may restore the initial fragment during hydration.
        if (incoming)
            router.replace({ pathname: '/booking/[id]', params: { id } });
        window.history.replaceState(
            window.history.state,
            '',
            window.location.pathname,
        );
    }, [id]);
    if (access === null)
        return (
            <BookingPage
                guest
                title={t('bookings.conversation')}
                subtitle={t('bookings.privateConversation')}
            >
                <BookingText muted>{t('community.loading')}</BookingText>
            </BookingPage>
        );
    if (!access)
        return (
            <BookingPage
                guest
                title={t('bookings.conversation')}
                subtitle={t('bookings.privateConversation')}
            >
                <BookingCard>
                    <BookingText>{t('bookings.openEmailLink')}</BookingText>
                </BookingCard>
            </BookingPage>
        );
    return (
        <>
            <Head>
                <meta name="robots" content="noindex,nofollow" />
                <meta name="referrer" content="no-referrer" />
            </Head>
            <BookingThreadScreen key={id} id={id} guest access={access} />
        </>
    );
}
