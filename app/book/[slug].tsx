import { sessionDisplayTitle } from '../../src/utils/sessionNaming';
import { useRef, useState } from 'react';
import { View, Image, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTranslation } from '../../src/i18n/useTranslation';
import { communityService } from '../../src/services/community';
import { bookingCall } from '../../src/services/bookings';
import { normalizeDJLink, DJ_PLATFORMS } from '../../src/utils/communityLinks';
import {
    validBookingSchedule,
    bookingAmount,
} from '../../src/utils/bookingWorkflow';
import {
    BookingPage,
    BookingCard,
    BookingText,
    BookingField,
    BookingDate,
    BookingCurrency,
    BookingError,
} from '../../src/components/bookings/BookingUI';
import { CommunityButton } from '../../src/components/community/CommunityUI';
import { validAuthEmail } from '../../src/utils/authExperience';
export default function PublicBooking() {
    const { slug, preview } = useLocalSearchParams<{
        slug: string;
        preview?: string;
    }>();
    const own = useAuthStore((s) => s.user?.id);
    const { t, currentLanguage } = useTranslation();
    const [showForm, setShowForm] = useState(false);
    const [externalError, setExternalError] = useState<Error | null>(null);
    const [form, setForm] = useState({
        promoter_name: '',
        promoter_email: '',
        event_title: '',
        venue: '',
        city: '',
        date: '',
        start_time: '22:00',
        end_time: '04:00',
        budget: '',
        currency: 'EUR',
        body: '',
    });
    const submission = useRef<string>('');
    const submittedPayload = useRef<string>('');
    const demo = preview === '1';
    const q = useQuery({
        queryKey: ['public-booking', slug, demo ? own : null],
        queryFn: async () =>
            demo
                ? {
                      profile: own ? await communityService.profile(own) : null,
                      sessions: [],
                      timezone:
                          Intl.DateTimeFormat().resolvedOptions().timeZone ||
                          'Europe/Madrid',
                  }
                : bookingCall('profile', { slug }),
        enabled: !demo || !!own,
        retry: false,
    });
    const send = useMutation({
        mutationFn: () => {
            const payload = JSON.stringify({
                ...form,
                slug,
                language: currentLanguage,
            });
            if (!submission.current || submittedPayload.current !== payload) {
                if (Platform.OS !== 'web')
                    throw new Error('bookings.errors.web_required');
                submission.current = crypto.randomUUID();
                submittedPayload.current = payload;
            }
            return bookingCall('request', {
                ...form,
                slug,
                budget: bookingAmount(form.budget),
                language: currentLanguage,
                submission_key: submission.current,
            });
        },
    });
    const profile = q.data?.profile;
    const field = (
        key: keyof typeof form,
        label: string,
        multiline = false,
        number = false,
    ) => (
        <BookingField
            label={t(`bookings.${label}`)}
            value={form[key]}
            onChange={(v) => setForm({ ...form, [key]: v })}
            multiline={multiline}
            number={number}
            email={key === 'promoter_email'}
            autoFocus={key === 'promoter_name'}
            maxLength={
                key === 'body'
                    ? 3000
                    : key === 'promoter_email'
                      ? 254
                      : key === 'promoter_name'
                        ? 80
                        : key === 'venue'
                          ? 160
                          : key.endsWith('_time')
                            ? 5
                            : key === 'budget'
                              ? 11
                              : 120
            }
        />
    );
    const canSubmit =
        validBookingSchedule(form) &&
        validAuthEmail(form.promoter_email) &&
        !!form.promoter_name.trim() &&
        !!form.event_title.trim() &&
        !!form.venue.trim() &&
        !!form.city.trim() &&
        bookingAmount(form.budget) !== null;
    return (
        <BookingPage
            guest
            title={profile?.artist_name || t('bookings.publicTitle')}
            subtitle={t('bookings.publicHint')}
        >
            {demo && (
                <BookingCard>
                    <BookingText large>{t('bookings.preview')}</BookingText>
                    <BookingText muted>{t('bookings.previewHint')}</BookingText>
                </BookingCard>
            )}
            {q.isPending && (
                <BookingText muted>{t('community.loading')}</BookingText>
            )}
            {q.isError && <BookingError error={q.error} />}
            {profile && (
                <>
                    <BookingCard>
                        {profile.cover_url && (
                            <Image
                                source={{ uri: profile.cover_url }}
                                resizeMode="cover"
                                style={{
                                    width: '100%',
                                    height: 230,
                                    borderRadius: 18,
                                }}
                            />
                        )}
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 14,
                            }}
                        >
                            {profile.avatar_url && (
                                <Image
                                    source={{ uri: profile.avatar_url }}
                                    style={{
                                        width: 64,
                                        height: 64,
                                        borderRadius: 32,
                                    }}
                                />
                            )}
                            <View style={{ flex: 1 }}>
                                <BookingText large>
                                    {profile.artist_name}
                                </BookingText>
                                <BookingText muted>
                                    {[profile.city, profile.genres]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </BookingText>
                            </View>
                        </View>
                        {!!profile.bio && (
                            <BookingText>{profile.bio}</BookingText>
                        )}
                        {DJ_PLATFORMS.map((platform) =>
                            profile[`${platform}_url`] ? (
                                <CommunityButton
                                    key={platform}
                                    secondary
                                    label={
                                        platform === 'mixcloud'
                                            ? 'Mixcloud'
                                            : platform === 'soundcloud'
                                              ? 'SoundCloud'
                                              : 'Instagram'
                                    }
                                    onPress={() => {
                                        try {
                                            void Linking.openURL(
                                                normalizeDJLink(
                                                    profile[`${platform}_url`],
                                                    platform,
                                                ),
                                            ).catch(() =>
                                                setExternalError(
                                                    new Error(
                                                        'bookings.errors.link_unavailable',
                                                    ),
                                                ),
                                            );
                                        } catch {
                                            setExternalError(
                                                new Error(
                                                    'bookings.errors.link_unavailable',
                                                ),
                                            );
                                        }
                                    }}
                                />
                            ) : null,
                        )}
                        {externalError && (
                            <BookingError error={externalError} />
                        )}
                        <CommunityButton
                            label={t('bookings.enquire')}
                            onPress={() => setShowForm(true)}
                            disabled={demo}
                        />
                    </BookingCard>
                    {!!q.data.sessions?.length && (
                        <>
                            <BookingText large>
                                {t('bookings.publishedSessions')}
                            </BookingText>
                            {q.data.sessions.map((s: any) => (
                                <BookingCard key={s.id}>
                                    <BookingText large>{sessionDisplayTitle(s, t)}</BookingText>
                                    <BookingText muted>
                                        {s.title?.trim() ? `${s.venue} · ` : ''}
                                        {new Date(
                                            s.date + 'T12:00:00',
                                        ).toLocaleDateString(currentLanguage)}
                                    </BookingText>
                                </BookingCard>
                            ))}
                        </>
                    )}
                </>
            )}
            {demo && !profile && (
                <BookingCard>
                    <BookingText>{t('bookings.completeProfile')}</BookingText>
                </BookingCard>
            )}
            {showForm && !demo && (
                <BookingCard>
                    {send.isSuccess ? (
                        <>
                            <BookingText large>
                                {t('bookings.verifyEmail')}
                            </BookingText>
                            <BookingText muted>
                                {t('bookings.verifyEmailHint')}
                            </BookingText>
                        </>
                    ) : (
                        <>
                            <BookingText large>
                                {t('bookings.enquire')}
                            </BookingText>
                            <BookingText muted>
                                {t('bookings.noReservation')} ·{' '}
                                {q.data?.timezone}
                            </BookingText>
                            {field('promoter_name', 'yourName')}
                            {field('promoter_email', 'email')}
                            {field('event_title', 'event')}
                            {field('venue', 'venue')}
                            {field('city', 'city')}
                            <BookingDate
                                value={form.date}
                                onChange={(date) => setForm({ ...form, date })}
                            />
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                    {field('start_time', 'start')}
                                </View>
                                <View style={{ flex: 1 }}>
                                    {field('end_time', 'end')}
                                </View>
                            </View>
                            {field('budget', 'budget', false, true)}
                            <BookingCurrency
                                value={form.currency}
                                onChange={(currency) =>
                                    setForm({ ...form, currency })
                                }
                            />
                            {field('body', 'details', true)}
                            <BookingText muted>
                                {t('bookings.contactConsent')}
                            </BookingText>
                            <CommunityButton
                                label={t('bookings.sendEnquiry')}
                                busy={send.isPending}
                                disabled={!canSubmit}
                                onPress={() => send.mutate()}
                            />
                            {send.isError && (
                                <BookingError error={send.error} />
                            )}
                        </>
                    )}
                </BookingCard>
            )}
        </BookingPage>
    );
}
