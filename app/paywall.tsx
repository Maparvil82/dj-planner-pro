import { StatusBar } from 'expo-status-bar';
import { ProMarketingButton, useProMarketingColors } from '../src/components/profile/ProMarketing';
import { PRO_TOOL_ROUTES, proEducationFeature, PRO_TRIAL_DAYS } from '../src/config/proEducation';
import { LinearGradient } from 'expo-linear-gradient';
import { rcService } from '../src/services/revenuecat';
import { annualSaving, freeIntroDuration, hasBillingPeriod, subscriptionManagementUrl } from '../src/utils/billingPresentation';
import { useSessionUsage } from '../src/hooks/useSessionUsage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import Animated, { FadeIn } from 'react-native-reanimated';
import { FEATURES } from '../src/config/features';
import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Platform,
    ImageBackground,
    ActivityIndicator,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter, useIsFocused } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { X, Check, ChevronLeft, ArrowUpRight, ShieldCheck, CalendarDays, CreditCard } from 'lucide-react-native';
import { useTranslation } from '../src/i18n/useTranslation';
import { useSubscription } from '../src/hooks/useSubscription';
import { useAuthStore } from '../src/store/useAuthStore';
import { startProTrial, syncSubscriptionAccess } from '../src/services/subscriptionAccess';
import { showError } from '../src/utils/showError';
import { bookingCall, type BookingStatus } from '../src/services/bookings';
import { hasReferencePrices, needsSpanishPriceConfirmation, planPricingState, PRO_REFERENCE_PRICES } from '../src/config/proPricing';
import { FREE_SESSION_LIMIT } from '../src/utils/sessionLimit';

export default function PaywallScreen() {
    const { t, currentLanguage, dateLocale, numberLocale, regionCode } = useTranslation();
    const p = useProMarketingColors();

    const router = useRouter();
    const focused = useIsFocused();
    const { width } = useWindowDimensions();
    const client = useQueryClient();
    const session = useAuthStore((state) => state.session);
    const initialized = useAuthStore((state) => state.initialized);
    const params = useLocalSearchParams<{
        reason?: string;
        count?: string;
        requested?: string;
        sessionId?: string;
    }>();
    const {
        purchaseMonthly,
        purchaseAnnual,
        restorePurchases,
        isLoading,
        isPro: storeIsPro,
        monthlyPackage: storeMonthly,
        annualPackage: storeAnnual,
        customerInfo,
        storefrontCountryCode,
        refreshSubscriptionStatus,
    } = useSubscription();
    const usage = useSessionUsage();
    const isPro = storeIsPro || usage.data?.isPro === true;
    const paidPro = storeIsPro || usage.data?.paidPro === true;
    const trial = usage.data?.trial;
    const trialDate = trial?.expiresAt ? new Date(trial.expiresAt).toLocaleDateString(dateLocale) : '';
    const referencePrice = (plan: 'monthly' | 'yearly') => new Intl.NumberFormat(numberLocale, { style: 'currency', currency: PRO_REFERENCE_PRICES.currency }).format(plan === 'monthly' ? PRO_REFERENCE_PRICES.monthly : PRO_REFERENCE_PRICES.annualLaunch);
    const annualStandardPrice = new Intl.NumberFormat(numberLocale, { style: 'currency', currency: PRO_REFERENCE_PRICES.currency }).format(PRO_REFERENCE_PRICES.annualStandardPlanned);
    const monthlyPackage = storeMonthly && hasBillingPeriod(storeMonthly.product, 'monthly') ? storeMonthly : null;
    const annualPackage = storeAnnual && hasBillingPeriod(storeAnnual.product, 'yearly') ? storeAnnual : null;
    const nativeStore = rcService.supportsPurchases() && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
    const referencePrices = !nativeStore && hasReferencePrices(regionCode);
    const [view, setView] = useState<'intro' | 'plans'>('intro');
    const scroll = useRef<ScrollView>(null);
    const bookings = useQuery({
        queryKey: ['booking-status', session?.user.id],
        queryFn: () => bookingCall<BookingStatus>('owner_status'),
        enabled: FEATURES.bookings && !!session && params.reason === 'bookings',
        retry: false,
    });
    const [selected, setSelected] = useState<'monthly' | 'yearly'>('yearly');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [verified, setVerified] = useState(false);
    const pkg = selected === 'monthly' ? monthlyPackage : annualPackage;
    const priceConfirmation = (item: typeof monthlyPackage) => nativeStore && needsSpanishPriceConfirmation(item?.product, storefrontCountryCode);
    const selectedPriceConfirmation = priceConfirmation(pkg);
    const hasPriceMismatch = priceConfirmation(monthlyPackage) || priceConfirmation(annualPackage);
    const productIds = [monthlyPackage, annualPackage].flatMap(item => item ? [item.product.identifier] : []);
    const introEligibility = useQuery({
        queryKey: ['intro-eligibility', session?.user.id, ...productIds],
        queryFn: () => rcService.getIntroEligibility(productIds),
        enabled: nativeStore && Platform.OS === 'ios' && view === 'plans' && !paidPro && productIds.length > 0,
        staleTime: 0,
    });
    const storeTrial = freeIntroDuration(pkg?.product.introPrice, !!introEligibility.data?.[pkg?.product.identifier || ''], currentLanguage);
    const available = nativeStore && !!pkg;
    const showPlans = (next: 'intro' | 'plans') => { setView(next); setMessage(''); scroll.current?.scrollTo({ y: 0, animated: false }); };
    useEffect(() => {
        if (selected === 'yearly' && !annualPackage && monthlyPackage) setSelected('monthly');
        if (selected === 'monthly' && !monthlyPackage && annualPackage) setSelected('yearly');
    }, [selected, annualPackage, monthlyPackage]);
    useEffect(() => {
        if (focused && view === 'plans' && nativeStore) void refreshSubscriptionStatus();
    }, [focused, view, nativeStore, refreshSubscriptionStatus]);
    const close = () =>
        router.canGoBack() ? router.back() : router.replace('/');
    const activateTrial = async () => {
        if (busy || !trial?.eligible) return;
        const userId = session?.user.id;
        setBusy(true); setMessage('');
        try {
            const access = await startProTrial();
            if (useAuthStore.getState().session?.user.id !== userId) return;
            client.setQueryData(['session-usage', userId], access);
            await client.invalidateQueries({ queryKey: ['session-usage', userId] });
            setView('plans');
            setMessage(t(access.trial?.status === 'active' ? 'trial.activated' : 'trial.expired'));
        } catch (error) {
            showError(t('error'), t(error instanceof Error && error.message.startsWith('trial.') ? error.message : 'trial.activationError'));
        } finally { setBusy(false); }
    };
    const continueToTool = () => {
        const feature = proEducationFeature(params.reason);
        if (feature) router.replace({ pathname: PRO_TOOL_ROUTES[feature], params: params.sessionId ? { sessionId: params.sessionId } : {} });
        else close();
    };
    const verify = async () => {
        const usage = await syncSubscriptionAccess();
        if (!usage.paidPro) throw new Error('billing.verificationError');
        await client.invalidateQueries({ queryKey: ['session-usage'] });
        await client.invalidateQueries({ queryKey: ['booking-status'] });
        setVerified(true);
        setMessage(t('billing.activated'));
    };
    const act = async (restore = false) => {
        if (busy || isLoading) return;
        setBusy(true);
        setMessage('');
        try {
            const success = restore
                ? await restorePurchases()
                : paidPro ||
                  (await (selected === 'monthly'
                      ? purchaseMonthly()
                      : purchaseAnnual()));
            if (success) await verify();
            else if (restore) setMessage(t('billing.noPurchases'));
        } catch (error) {
            const key =
                error instanceof Error && error.message.startsWith('billing.')
                    ? error.message
                    : 'billing.purchaseError';
            showError(t('error'), t(key));
        } finally {
            setBusy(false);
        }
    };
    useEffect(() => { if (isPro || trial?.status === 'expired') setView('plans'); }, [isPro, trial?.status]);
    if (!initialized) return <View style={{ flex: 1, backgroundColor: p.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={p.accent} /></View>;
    if (!session) return <Redirect href="/(auth)/login" />;
    const saving = annualSaving(monthlyPackage?.product, annualPackage?.product);
    const legal = <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 20 }}>
        {[['terms_of_use', 'terms_of_use_url'], ['privacy_policy', 'privacy_policy_url']].map(([label, url]) => <TouchableOpacity key={label} accessibilityRole="link" onPress={() => void Linking.openURL(t(url))} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: p.muted, fontSize: 11 }}>{t(label)}</Text></TouchableOpacity>)}
    </View>;
    const free = !isPro && !verified ? <TouchableOpacity accessibilityRole="button" disabled={busy || isLoading} onPress={close} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: p.ink, fontSize: 13, fontWeight: '600' }}>{t('billing.stayFree')}</Text></TouchableOpacity> : null;
    return <ImageBackground source={require('../assets/paywall_header_new.png')} resizeMode="cover" style={{ flex: 1, backgroundColor: p.background }} imageStyle={{ width, height: 510, opacity: view === 'intro' ? 1 : 0 }}>
        <LinearGradient pointerEvents="none" colors={p.paywallGradient} locations={[0, 0.23, 0.49, 0.65, 1]} style={{ position: 'absolute', inset: 0 }} />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            {focused && <StatusBar style={p.dark ? 'light' : 'dark'} />}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 6, backgroundColor: p.dark ? 'transparent' : p.nav }}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t(view === 'plans' && !isPro ? 'back' : 'proEducation.close')} disabled={busy || isLoading} onPress={() => view === 'plans' && !isPro ? showPlans('intro') : close()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.nav, alignItems: 'center', justifyContent: 'center' }}>{view === 'plans' && !isPro ? <ChevronLeft size={23} color={p.ink} /> : <X size={23} color={p.ink} />}</TouchableOpacity>
            </View>
            <ScrollView ref={scroll} testID="paywall-scroll" contentContainerStyle={{ flexGrow: 1, maxWidth: 540, width: '100%', alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 }}>
                <Animated.View key={view} entering={FadeIn.duration(180)} testID={`paywall-stage-${view}`} style={{ gap: 22, flexGrow: 1, flexShrink: 0 }}>
                    {view === 'plans' && <Text accessibilityRole="header" style={{ color: p.ink, fontSize: 32, lineHeight: 37, letterSpacing: -1, fontWeight: '900' }}>{t(paidPro ? 'billing.proPlan' : trial?.status === 'active' ? 'trial.activeTitle' : 'billingFlow.plansTitle')}</Text>}
                    {view === 'plans' && trial?.status !== 'available' && trial && <View testID="trial-status" style={{ gap: 8 }}><Text style={{ color: p.muted, fontSize: 14, lineHeight: 21 }}>{t(trial.status === 'active' ? 'trial.activeUntil' : 'trial.expired', { date: trialDate })}</Text><Text style={{ color: p.muted, fontSize: 12, lineHeight: 18 }}>{t('trial.noRenewal')}</Text>{trial.status === 'active' && <ProMarketingButton label={t('trial.continue')} onPress={continueToTool} />}</View>}
                    {view === 'intro' ? <>
                        <View style={{ height: 246 }} />
                        <View testID="pro-trial-card" style={{ gap: 14 }}>
                            <Text accessibilityRole="header" style={{ color: p.ink, fontSize: 40, lineHeight: 44, letterSpacing: -1.5, fontWeight: '900' }}>{t('billingFlow.trialHeadline', { days: PRO_TRIAL_DAYS })}</Text>
                            <Text style={{ color: p.muted, fontSize: 14, lineHeight: 21 }}>{t('billingFlow.trialSummary')}</Text>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                {[[CreditCard, 'noCard'], [ShieldCheck, 'noCharge'], [CalendarDays, 'keepData']].map(([Icon, key]) => {
                                    const BadgeIcon = Icon as typeof CreditCard;
                                    return <View key={String(key)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: p.surface, paddingVertical: 12, paddingHorizontal: 5, borderRadius: 14 }}><BadgeIcon size={18} color={p.accent} /><Text style={{ color: p.ink, fontSize: 10, textAlign: 'center' }}>{t(`billingFlow.${key}`)}</Text></View>;
                                })}
                            </View>
                        </View>
                        {params.reason === 'session-limit' && <Text style={{ color: p.muted, fontSize: 12, lineHeight: 18 }}>{t('billing.limitUsage', { count: Number(params.count) || 0, limit: FREE_SESSION_LIMIT })}</Text>}
                    </> : <>
                        {FEATURES.bookings && params.reason === 'bookings' && <Text style={{ color: p.muted, fontSize: 12 }}>{t(bookings.data?.serviceReady ? 'bookings.proBenefit' : 'bookings.setupPendingHint')}</Text>}
                        {trial?.status === 'active' && !paidPro && <Text style={{ color: p.muted, fontSize: 12, lineHeight: 18 }}>{t('trial.purchaseTiming')}</Text>}
                        <View testID="paywall-plans" accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 12 }}>
                            {(['monthly', 'yearly'] as const).map(plan => {
                                const item = plan === 'monthly' ? monthlyPackage : annualPackage, chosen = selected === plan;
                                const { needsConfirmation, launch, source } = planPricingState(plan, item?.product, nativeStore, storefrontCountryCode, regionCode);
                                return <TouchableOpacity key={plan} testID={`paywall-plan-${plan}`} accessibilityRole="radio" accessibilityLabel={t(plan === 'monthly' ? 'plan_monthly' : 'plan_yearly')} accessibilityState={{ checked: chosen }} aria-checked={chosen} disabled={busy || isLoading} onPress={() => setSelected(plan)} style={{ flex: 1, minWidth: 0, minHeight: 144, borderRadius: 20, borderWidth: 1, borderColor: chosen ? p.accent : p.border, backgroundColor: chosen ? p.planTint : p.surface, padding: 16, gap: 10 }}>
                                    {chosen && <View style={{ position: 'absolute', right: 12, top: -9, width: 21, height: 21, borderRadius: 11, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}><Check size={13} color={p.onAccent} /></View>}
                                    <Text style={{ color: p.ink, fontSize: 14, fontWeight: '700' }}>{t(plan === 'monthly' ? 'plan_monthly' : 'plan_yearly')}</Text>
                                    {needsConfirmation && <Text testID={`reference-label-${plan}`} style={{ color: p.muted, fontSize: 10, lineHeight: 14 }}>{t('billingFlow.spainReference')}</Text>}
                                    {launch && <Text testID="annual-launch-label" style={{ color: p.accent, fontSize: 10, fontWeight: '800' }}>{t('billingFlow.launchLabel')}</Text>}
                                    <Text numberOfLines={source !== 'unavailable' ? 1 : 2} adjustsFontSizeToFit minimumFontScale={0.65} style={{ color: p.ink, fontSize: source !== 'unavailable' ? (width < 360 ? 24 : 28) : 17, lineHeight: 30, fontWeight: '900', letterSpacing: -0.7 }}>{source === 'reference' ? referencePrice(plan) : item ? item.product.priceString : t('billing.priceUnavailable')}</Text>
                                    <Text style={{ color: p.muted, fontSize: 11 }}>{t(plan === 'monthly' ? 'proDesign.billedMonthly' : 'proDesign.billedAnnually')}</Text>
                                    {launch && <Text testID="annual-standard-price" style={{ color: p.muted, fontSize: 12, lineHeight: 18, fontWeight: '600' }}>{t('billingFlow.standardPlanned', { price: annualStandardPrice })}</Text>}
                                    {plan === 'yearly' && !hasPriceMismatch && saving > 0 && <Text style={{ color: p.accent, fontSize: 11, fontWeight: '800' }}>{t('billing.saving', { percent: saving })}</Text>}
                                </TouchableOpacity>;
                            })}
                        </View>
                        {hasPriceMismatch && <Text testID="store-currency-notice" accessibilityRole="alert" style={{ color: p.muted, fontSize: 12, lineHeight: 18 }}>{t('billingFlow.currencyMismatch')}</Text>}
                        {!pkg && <Text style={{ color: p.muted, fontSize: 12, lineHeight: 18 }}>{t(referencePrices ? 'trial.referencePrices' : 'billingFlow.pricesUnavailable')}</Text>}
                        {nativeStore && <TouchableOpacity accessibilityRole="button" onPress={() => void refreshSubscriptionStatus()} disabled={busy || isLoading} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ color: p.accent, fontSize: 13, fontWeight: '700' }}>{t('billingFlow.reloadPrices')}</Text></TouchableOpacity>}
                        {!!message && <Text accessibilityRole="alert" style={{ color: verified ? p.accent : p.muted, fontSize: 13, lineHeight: 20 }}>{message}</Text>}
                    </>}
                    <View style={{ flex: 1 }} />
                </Animated.View>
            </ScrollView>
            <View style={{ maxWidth: 540, width: '100%', alignSelf: 'center', paddingHorizontal: 24, paddingTop: 16, gap: 5 }}>
                {view === 'intro' ? <>
                    <ProMarketingButton disabled={busy || usage.isPending || !trial?.eligible} busy={busy} label={t('proEducation.startTrial', { days: PRO_TRIAL_DAYS })} onPress={() => void activateTrial()} />
                    <Text style={{ color: p.muted, fontSize: 10, textAlign: 'center', marginTop: 3 }}>{t(usage.isError ? 'billing.usageError' : 'trial.once')}</Text>{usage.isError && <TouchableOpacity accessibilityRole="button" onPress={() => void usage.refetch()} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: p.accent }}>{t('retry')}</Text></TouchableOpacity>}
                    <TouchableOpacity accessibilityRole="button" onPress={() => showPlans('plans')} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}><Text style={{ color: p.ink, fontSize: 14, fontWeight: '700' }}>{t('billingFlow.seePrices')}</Text><ArrowUpRight size={16} color={p.ink} /></TouchableOpacity>
                </> : <>
                    {!paidPro && !verified && <View testID="subscription-disclosure" style={{ gap: 7, paddingBottom: 8 }}>
                        {storeTrial && <Text style={{ color: p.muted, fontSize: 12, textAlign: 'center' }}>{t('billingFlow.storeTrial', { duration: storeTrial })}</Text>}
                        {pkg && <Text style={{ color: p.ink, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>{selectedPriceConfirmation ? `${t('billingFlow.spainReference')}: ` : ''}{t(selected === 'monthly' ? 'billingFlow.monthTotal' : 'billingFlow.yearTotal', { price: selectedPriceConfirmation ? referencePrice(selected) : pkg.product.priceString })}</Text>}
                        {pkg && <Text style={{ color: p.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' }}>{t('billingFlow.storeConfirmation')}</Text>}
                        <Text style={{ color: p.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' }}>{t('billingFlow.autoRenew')}</Text>
                        <TouchableOpacity accessibilityRole="link" onPress={() => void Linking.openURL(subscriptionManagementUrl(Platform.OS, customerInfo?.managementURL))} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: p.accent, fontSize: 12, fontWeight: '600' }}>{t('billingFlow.cancelLink')}</Text></TouchableOpacity>
                    </View>}
                    <ProMarketingButton label={t(verified ? 'billing.return' : paidPro ? 'billing.verify' : selectedPriceConfirmation ? 'billingFlow.confirmStorePrice' : 'billingFlow.subscribe')} busy={busy || isLoading} disabled={!verified && !paidPro && !available} onPress={verified ? close : () => void act()} />
                </>}
                {free}
                {!isPro && !verified && view === 'intro' && <Text style={{ color: p.muted, fontSize: 10, textAlign: 'center', lineHeight: 15 }}>{t('billingFlow.freeHint', { limit: FREE_SESSION_LIMIT })}</Text>}
                <TouchableOpacity accessibilityRole="button" disabled={busy || isLoading || !nativeStore} onPress={() => void act(true)} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: p.ink, fontSize: 12, fontWeight: '600', opacity: nativeStore ? 1 : 0.55 }}>{t('restore_purchases')}</Text></TouchableOpacity>
                {legal}
            </View>
        </SafeAreaView>
    </ImageBackground>;
}
