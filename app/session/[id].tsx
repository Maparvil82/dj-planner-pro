import { SaveSessionTemplateButton } from '../../src/components/sessionTemplates/SessionTemplates';
import { SessionReviewPrompt } from '../../src/components/sessions/SessionReviewPrompt';
import { useSessionUsage } from '../../src/hooks/useSessionUsage';
import { SessionExpensesCard } from '../../src/components/sessions/SessionExpenses';
import { useCommunityColors } from '../../src/components/community/communityColors';
import { useScrollHeader } from '../../src/hooks/useScrollHeader';
import { ScrollHeaderContainer } from '../../src/components/ui/ScrollHeaderContainer';
import { useDarkPalette } from '../../src/contexts/ThemeContext';
import { StorageImage as Image } from '../../src/components/ui/StorageImage';
import { cityLabel } from '../../src/utils/cities';
import { FeeAgreementCard } from '../../src/components/sessions/FeeAgreementCard';
import { useUpdateSessionMutation } from '../../src/hooks/useSessionsQuery';
import { agreementAmount } from '../../src/utils/feeAgreement';
import { sessionPhase } from '../../src/utils/sessionWorkflow';
import { sessionDisplayTitle } from '../../src/utils/sessionNaming';
import { SessionPayments } from '../../src/components/sessions/SessionPayments';
import { SessionCollaborationDetails } from '../../src/components/sessions/SessionCollaborationDetails';
import { SessionCommunitySharing } from '../../src/components/community/SessionCommunitySharing';
import { sessionRange } from '../../src/utils/sessionPlanning';
import { sessionDuration } from '../../src/utils/sessionPlanning';
import { SessionStatusBadge } from '../../src/components/sessions/SessionStatusBadge';
import { FEATURES } from '../../src/config/features';
import React, { useContext, useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    KeyboardAvoidingView,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Share,
    Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import {
    useSessionByIdQuery,
} from '../../src/hooks/useSessionsQuery';
import {
    Share2,
    ChevronLeft,
    Pencil,
    Folder,
    Plus,
    MapPin,
    Clock3,
    Wallet,
    Users,
    Ticket,
    Receipt,
    Mic,
    StickyNote,
    ChevronRight,
} from 'lucide-react-native';
import {
    useVaultFoldersByAssociationQuery,
    useCreateFolderMutation,
} from '../../src/hooks/useVaultQuery';
import { useAuthStore } from '../../src/store/useAuthStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { ThemeContext } from '../../src/contexts/ThemeContext';

export default function SessionDetailScreen() {
    const darkPalette = useDarkPalette();
    const { progress: headerProgress, onScroll: onHeaderScroll, onScrollBeginDrag: onHeaderScrollBeginDrag } = useScrollHeader('compact');
    const { id, voiceReminder, postSessionReview } = useLocalSearchParams();
    const router = useRouter();
    const usage = useSessionUsage();
    const { t, currentLanguage, dateLocale } = useTranslation();
    const themeCtx = useContext(ThemeContext);
    const { session: authSession } = useAuthStore();

    const isDark = themeCtx?.activeTheme === 'dark';

    const {
        data: session,
        isLoading,
        error,
    } = useSessionByIdQuery(id as string);
    const agreementUpdate = useUpdateSessionMutation();

    const { data: associatedFolders = [], isLoading: isLoadingFolders } =
        useVaultFoldersByAssociationQuery('session', id as string);
    const createFolderMutation = useCreateFolderMutation();

    const c = useCommunityColors();
    const [posterAspect, setPosterAspect] = useState(3 / 4);
    // Keep previous notification links working after moving notices to a tool.
    useEffect(() => {
        if (voiceReminder === '1' && usage.data?.isPro && session &&
            !session.is_guest && session.user_id === authSession?.user.id)
            router.replace({ pathname: '/session-notice', params: { sessionId: session.id, voiceReminder: '1' } });
    }, [voiceReminder, usage.data?.isPro, session?.id, session?.is_guest, session?.user_id, authSession?.user.id, router]);

    useEffect(() => {
        let active = true;
        setPosterAspect(3 / 4);
        if (session?.poster_url) Image.getSize(session.poster_url, (width, height) => {
            if (active && width > 0 && height > 0) setPosterAspect(width / height);
        }, () => {});
        return () => { active = false; };
    }, [session?.poster_url]);

    const handleShare = async () => {
        if (!session) return;
        try {
            const message = `${sessionDisplayTitle(session, t)}\n📍 ${session.venue}\n📅 ${capitalizedDate}\n⏰ ${session.start_time} - ${session.end_time}`;
            await Share.share({ message });
        } catch (error) {
            console.error('Error sharing session:', error);
        }
    };

    if (!authSession) return <Redirect href="/(auth)/login" />;

    if (isLoading) {
        return (
            <View className="flex-1 bg-white dark:bg-djDark-background items-center justify-center">
                <ActivityIndicator
                    size="large"
                    color={isDark ? darkPalette.primary : '#3B82F6'}
                />
            </View>
        );
    }

    if (error || !session) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-djDark-background items-center justify-center p-6">
                <Text className="text-xl font-bold text-red-500 mb-2">{t('error')}</Text>
                <Text className="text-gray-500 dark:text-djDark-muted mb-6 text-center">
                    {t('error_loading_session') ||
                        'No pudimos cargar la información de esta sesión.'}
                </Text>
                <TouchableOpacity
                    className="bg-black dark:bg-djDark-tint px-8 py-4 rounded-2xl shadow-lg"
                    onPress={() => router.back()}
                >
                    <Text className="text-white font-bold">
                        {t('go_back') || 'Volver atrás'}
                    </Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const [y, m, d] = session.date.split('-');
    const sessionDateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const formattedDate = sessionDateObj.toLocaleDateString(dateLocale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    const capitalizedDate =
        formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    const duration = sessionDuration(session);

    const owner = !session.is_guest && session.user_id === authSession.user.id;
    const openTool = (pathname: '/tickets' | '/guests' | '/expenses' | '/preparation' | '/door-access' | '/session-notice' | '/session-notes') => {
        if (!usage.data?.isPro && (pathname === '/tickets' || pathname === '/guests' || pathname === '/session-notice')) {
            router.push({ pathname: '/paywall', params: { reason: pathname === '/tickets' ? 'access' : pathname === '/guests' ? 'guests' : 'voiceNotes', sessionId: session.id } });
            return;
        }
        router.push({ pathname, params: { sessionId: session.id } });
    };
    const card = { backgroundColor: c.card, borderRadius: 26, padding: 20, gap: 18, borderWidth: c.dark ? 0 : 1, borderColor: c.border };
    const iconButton = { width: 40, height: 40, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: c.dark ? darkPalette.raised : '#e9eaf3' };
    const label = { color: c.dark ? c.cardText : c.muted, fontSize: 12, lineHeight: 18 };
    const value = { color: c.cardText, fontSize: 15, fontWeight: '700' as const, lineHeight: 22 };
    const sectionHeading = (text: string, Icon: typeof MapPin) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon size={19} color={c.accent} /><Text accessibilityRole="header" style={{ color: c.cardText, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }}>{text}</Text></View>;
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollHeaderContainer progress={headerProgress} hasIcons>
                <View testID="session-detail-header" style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 22, gap: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('go_back')} onPress={() => router.back()} style={iconButton}><ChevronLeft size={22} color={c.fg} /></TouchableOpacity>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {owner && <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('sessionDetail.edit')} onPress={() => router.push(`/edit-session/${id}`)} style={iconButton}><Pencil size={19} color={c.fg} /></TouchableOpacity>}
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('sessionDetail.share')} onPress={handleShare} style={iconButton}><Share2 size={19} color={c.fg} /></TouchableOpacity>

                        </View>
                    </View>
                    <Text accessibilityRole="header" style={{ fontSize: 29, lineHeight: 35, letterSpacing: -0.9, fontWeight: '800', color: c.fg }} numberOfLines={2}>{sessionDisplayTitle(session, t)}</Text>
                </View>
            </ScrollHeaderContainer>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView testID="session-detail-scroll" keyboardDismissMode="on-drag" scrollEventThrottle={16} onScrollBeginDrag={onHeaderScrollBeginDrag} onTouchStart={onHeaderScrollBeginDrag} onScroll={onHeaderScroll} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40, gap: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {owner && postSessionReview === '1' && <SessionReviewPrompt venue={session.venue}
                    onEdit={() => router.push(`/edit-session/${session.id}`)}
                    onNotes={() => openTool('/session-notes')} onAudio={() => openTool('/session-notice')} />}
                {owner && <SaveSessionTemplateButton session={session} />}
                <View testID="session-detail-place" style={card}>
                    {sectionHeading(t('sessionDetail.place'), MapPin)}
                    <TouchableOpacity accessibilityRole={session.venue_id && !session.is_guest ? 'button' : undefined} accessibilityLabel={session.venue} disabled={!session.venue_id || session.is_guest} onPress={() => router.push(`/venue/${session.venue_id}`)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        <View style={{ flex: 1, gap: 5 }}>
                            <Text style={{ ...value, fontSize: 20, lineHeight: 27 }}>{session.venue}</Text>
                            {!!session.venue_city && <Text style={label}>{cityLabel(session.venue_city, session.venue_city_location)}</Text>}
                            {!!session.venue_address && <Text style={label}>{session.venue_address}</Text>}
                        </View>
                        {!!session.venue_id && !session.is_guest && <ChevronRight size={20} color={c.accent} />}
                    </TouchableOpacity>
                </View>
                <View testID="session-detail-information" style={card}>
                    {sectionHeading(t('sessionDetail.details'), Clock3)}


                    <View style={{ gap: 18 }}>
                        {!!session.event_type && <View style={{ gap: 4 }}><Text style={label}>{t('sessionType.label')}</Text><Text style={value}>{t(`sessionType.${session.event_type}`)}</Text></View>}
                        <View style={{ gap: 4 }}><Text style={label}>{t('date')}</Text><Text style={value}>{capitalizedDate}</Text></View>
                        <View style={{ flexDirection: 'row', gap: 20 }}>
                            <View style={{ flex: 1, gap: 4 }}><Text style={label}>{t('time_label')}</Text><Text style={value}>{session.start_time} — {session.end_time}</Text>{!!session.booking_timezone && <Text style={label}>{session.booking_timezone}</Text>}</View>
                            <View style={{ gap: 4 }}><Text style={label}>{t('duration')}</Text><Text style={value}>{duration.toFixed(1)} h</Text></View>
                        </View>
                        <View style={{ gap: 4 }}><Text style={label}>{t('djs_label')}</Text><Text style={value}>{session.is_collective && session.djs?.length ? session.djs.join(', ') : t('solo_me')}</Text></View>
                    </View>
                    {owner && !session.poster_url && session.status !== 'cancelled' && sessionRange(session).start.getTime() > Date.now() && <TouchableOpacity testID="session-create-poster" accessibilityRole="button" accessibilityLabel="Crear cartel" onPress={() => router.push({ pathname: '/carteles', params: { createForSession: session.id } })} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 50, borderRadius: 16, backgroundColor: c.accent, paddingHorizontal: 16 }}><Plus size={20} color={c.onAccent} /><Text style={{ color: c.onAccent, fontWeight: '800', fontSize: 15 }}>Crear cartel</Text></TouchableOpacity>}
                    {!!session.poster_url && <View testID="session-detail-poster" style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: c.field }}><Image accessibilityLabel={t('sessionDetail.poster')} source={{ uri: session.poster_url }} style={{ width: '100%', aspectRatio: posterAspect }} resizeMode="contain" /></View>}
                {/* VAULT SECTION (MOVED TO BOTTOM) */}
                {FEATURES.documents && (
                    <>
                        <View className="mt-8 px-2">
                            <View className="flex-row items-center justify-between mb-4">
                                <View className="flex-row items-center">
                                    <View className="w-8 h-8 rounded-full bg-blue-50 dark:bg-djDark-tint/20 items-center justify-center mr-3">
                                        <Folder size={18} color="#2563EB" />
                                    </View>
                                    <Text className="text-lg font-bold text-gray-900 dark:text-djDark-text">
                                        {t('session_vault') ||
                                            'Documentos y Carpetas'}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        Alert.prompt(
                                            t('new_folder') || 'Nueva Carpeta',
                                            t('folder_name_placeholder') ||
                                                'Ejem: Contratos, Riders...',
                                            [
                                                {
                                                    text: t('cancel'),
                                                    style: 'cancel',
                                                },
                                                {
                                                    text: t('create'),
                                                    onPress: (
                                                        name?: string,
                                                    ) => {
                                                        if (name)
                                                            createFolderMutation.mutate(
                                                                {
                                                                    name,
                                                                    type: 'session',
                                                                    associatedId:
                                                                        id as string,
                                                                },
                                                            );
                                                    },
                                                },
                                            ],
                                        );
                                    }}
                                    className="flex-row items-center bg-blue-50 dark:bg-djDark-tint/20 px-3 py-1.5 rounded-lg"
                                >
                                    <Plus
                                        size={14}
                                        color="#2563EB"
                                        className="mr-1"
                                    />
                                    <Text className="text-xs font-bold text-blue-600 dark:text-djDark-primary">
                                        {t('add_folder') || 'Añadir'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {isLoadingFolders ? (
                                <ActivityIndicator
                                    size="small"
                                    color="#2563EB"
                                />
                            ) : associatedFolders.length > 0 ? (
                                <View className="gap-2">
                                    {associatedFolders.map((folder) => (
                                        <TouchableOpacity
                                            key={folder.id}
                                            onPress={() =>
                                                router.push(
                                                    `/vault/${folder.id}?name=${encodeURIComponent(folder.name)}` as any,
                                                )
                                            }
                                            className="bg-white dark:bg-djDark-surface border border-gray-100 dark:border-djDark-border p-4 rounded-xl flex-row items-center justify-between shadow-sm shadow-black/5 dark:border-0"
                                        >
                                            <View className="flex-row items-center">
                                                <Folder
                                                    size={20}
                                                    color="#2563EB"
                                                    fill="#2563EB"
                                                    fillOpacity={0.1}
                                                />
                                                <Text style={isDark && { color: darkPalette.onSurface }} className="text-sm font-bold text-gray-900 dark:text-djDark-text ml-3">
                                                    {folder.name}
                                                </Text>
                                            </View>
                                            <ChevronLeft
                                                size={16}
                                                color={
                                                    isDark
                                                        ? darkPalette.muted
                                                        : '#9CA3AF'
                                                }
                                                style={{
                                                    transform: [
                                                        { rotate: '180deg' },
                                                    ],
                                                }}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => {
                                        Alert.prompt(
                                            t('new_folder') || 'Nueva Carpeta',
                                            t('folder_name_placeholder') ||
                                                'Ejem: Contratos, Riders...',
                                            [
                                                {
                                                    text: t('cancel'),
                                                    style: 'cancel',
                                                },
                                                {
                                                    text: t('create'),
                                                    onPress: (
                                                        name?: string,
                                                    ) => {
                                                        if (name)
                                                            createFolderMutation.mutate(
                                                                {
                                                                    name,
                                                                    type: 'session',
                                                                    associatedId:
                                                                        id as string,
                                                                },
                                                            );
                                                    },
                                                },
                                            ],
                                        );
                                    }}
                                    className="bg-gray-50 dark:bg-djDark-background/50 border border-dashed border-gray-200 dark:border-djDark-border rounded-2xl p-8 items-center"
                                >
                                    <Text className="text-sm font-medium text-gray-500 dark:text-djDark-muted mt-3 text-center">
                                        {t('no_associated_folders') ||
                                            'No hay carpetas para esta sesión.\nCrea una para guardar contratos o riders.'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </>
                )}

                </View>

                <View testID="session-detail-payment" style={card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        {sectionHeading(t('sessionDetail.payment'), Wallet)}
                        {!session.is_guest && <SessionStatusBadge session={session} />}
                    </View>
                    {session.is_guest ? <Text style={label}>{t('sessionDetail.guestPayment')}</Text> : <>
                        {(FEATURES.feeAgreements || session.fee_agreement?.version === 2) && session.fee_agreement && <FeeAgreementCard value={session.fee_agreement} documentSession={session} names={session.djs || []} currency={session.currency} canSettle={sessionPhase(session) === 'finished'} onChange={a => agreementUpdate.mutateAsync({ sessionId: session.id, input: { fee_agreement: a, earning_amount: agreementAmount(a) }, updateAll: false })} />}
                        <SessionPayments session={session} embedded />
                    </>}
                </View>
                <SessionExpensesCard session={session} />
                <View testID="session-detail-community" style={card}>
                    {sectionHeading(t('community.title'), Users)}
                    {!session.is_guest && <SessionCommunitySharing session={session} embedded />}
                    <SessionCollaborationDetails session={session} />
                </View>
                {owner && <View testID="session-detail-tools" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {[
                        { label: t('entryCounter.title'), Icon: Ticket, path: '/tickets' as const },
                        { label: t('guests.title'), Icon: Users, path: '/guests' as const },
                        { label: t('tools.expenses'), Icon: Receipt, path: '/expenses' as const },
                        { label: t('tools.preparation'), Icon: Clock3, path: '/preparation' as const },
                        { label: t('voiceNotes.title'), Icon: Mic, path: '/session-notice' as const },
                        { label: t('sessionNotes.title'), Icon: StickyNote, path: '/session-notes' as const },
                    ].map(item => <TouchableOpacity key={item.label} accessibilityRole="button" onPress={() => openTool(item.path)}
                        style={{ flexBasis: '45%', flexGrow: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 16, backgroundColor: c.card, borderWidth: c.dark ? 0 : 1, borderColor: c.border }}>
                        <item.Icon size={20} color={c.accent} />
                        <Text style={{ color: c.cardText, fontSize: 13, fontWeight: '700', flexShrink: 1 }}>{item.label}</Text>
                    </TouchableOpacity>)}
                </View>}
            </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
