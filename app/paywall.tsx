import { AppLogo } from '../src/components/ui/AppLogo';
import { captureAnalytics } from '../src/analytics';
import type { ComponentRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ProMarketingButton, useProMarketingColors } from '../src/components/profile/ProMarketing';
import { PRO_TOOL_ROUTES, proEducationFeature, PRO_TRIAL_DAYS } from '../src/config/proEducation';
import { rcService } from '../src/services/revenuecat';
import { freeIntroDuration, hasBillingPeriod, subscriptionManagementUrl } from '../src/utils/billingPresentation';
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
    ActivityIndicator,
    AppState,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter, useIsFocused } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { X, Check, ChevronLeft, ShieldCheck, CalendarDays, ChartNoAxesCombined, UsersRound } from 'lucide-react-native';
import { useTranslation } from '../src/i18n/useTranslation';
import { useSubscription } from '../src/hooks/useSubscription';
import { useAuthStore } from '../src/store/useAuthStore';
import { startProTrial, syncSubscriptionAccess } from '../src/services/subscriptionAccess';
import { showError } from '../src/utils/showError';
import { bookingCall, type BookingStatus } from '../src/services/bookings';
import { hasReferencePrices, needsSpanishPriceConfirmation, planPricingState, annualReferencePrice, PRO_REFERENCE_PRICES } from '../src/config/proPricing';
import { FREE_SESSION_LIMIT } from '../src/utils/sessionLimit';
import { annualCampaignPrice } from '../src/config/annualCampaign';
import { paywallStage } from '../src/utils/paywallStage';

export default function PaywallScreen() {
    const { t, currentLanguage, dateLocale, numberLocale, regionCode } = useTranslation();
    const p = useProMarketingColors();

    const router = useRouter();
    const focused = useIsFocused();
    const [pricingNow, setPricingNow] = useState(() => new Date());
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const update = () => {
            clearTimeout(timer);
            const now = new Date();
            setPricingNow(now);
            timer = setTimeout(update, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime());
        };
        update();
        const listener = AppState.addEventListener('change', state => { if (state === 'active') update(); });
        return () => { clearTimeout(timer); listener.remove(); };
    }, [focused]);
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
    const referencePrice = (plan: 'monthly' | 'yearly') => new Intl.NumberFormat(numberLocale, { style: 'currency', currency: PRO_REFERENCE_PRICES.currency }).format(plan === 'monthly' ? PRO_REFERENCE_PRICES.monthly : annualReferencePrice());
    const monthlyPackage = storeMonthly && hasBillingPeriod(storeMonthly.product, 'monthly') ? storeMonthly : null;
    const annualPackage = storeAnnual && hasBillingPeriod(storeAnnual.product, 'yearly') ? storeAnnual : null;
    const nativeStore = rcService.supportsPurchases() && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
    const annualCampaign = Platform.OS === 'ios' || !nativeStore ? annualCampaignPrice(storefrontCountryCode, regionCode, pricingNow) : null;
    const formatAnnualPrice = (price: number) => new Intl.NumberFormat(numberLocale, { style: 'currency', currency: annualCampaign?.currency || PRO_REFERENCE_PRICES.currency }).format(price);
    const referencePrices = !nativeStore && hasReferencePrices(regionCode);
    const [showPaidPlans, setShowPaidPlans] = useState(false);
    const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
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
    const view = paywallStage(paidPro || verified, trial, showPaidPlans);
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
    const showPlans = (next: 'intro' | 'plans') => { setShowPaidPlans(next === 'plans'); setMessage(''); scroll.current?.scrollTo({ y: 0, animated: false }); };
    useEffect(() => {
        if (selected === 'yearly' && !annualPackage && monthlyPackage) setSelected('monthly');
        if (selected === 'monthly' && !monthlyPackage && annualPackage) setSelected('yearly');
    }, [selected, annualPackage, monthlyPackage]);
    useEffect(() => {
        if (focused && view === 'plans' && nativeStore) void refreshSubscriptionStatus();
    }, [focused, view, nativeStore, refreshSubscriptionStatus]);
    const paywallTracked = useRef(false);
    useEffect(() => {
        if (!focused) { paywallTracked.current = false; return; }
        if (!usage.isSuccess || isLoading || paywallTracked.current) return;
        paywallTracked.current = captureAnalytics('paywall_viewed', { paid_pro: paidPro });
    }, [focused, usage.isSuccess, isLoading, paidPro]);
    const close = () =>
        router.canGoBack() ? router.back() : router.replace('/');
    const activateTrial = async () => {
        if (busy || !trial?.eligible) return;
        const userId = session?.user.id;
        setBusy(true); setMessage('');
        try {
            const access = await startProTrial();
            if (useAuthStore.getState().session?.user.id !== userId) return;
            if (access.trial?.status === 'active') captureAnalytics('pro_trial_started', {}, userId);
            client.setQueryData(['session-usage', userId], access);
            await client.invalidateQueries({ queryKey: ['session-usage', userId] });
            if (access.trial?.status === 'active') continueToTool();
            else { setShowPaidPlans(true); setMessage(t('trial.expired')); }
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
    if (!initialized || (session && usage.isPending && !storeIsPro)) return <View style={{ flex: 1, backgroundColor: p.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={p.accent} /></View>;
    if (!session) return <Redirect href="/(auth)/login" />;
    if (usage.isError && !usage.data && !storeIsPro) return <SafeAreaView style={{ flex: 1, backgroundColor: p.background, padding: 24, justifyContent: 'center', gap: 16 }}><Text accessibilityRole="alert" style={{ color: p.ink }}>{t('billing.usageError')}</Text><ProMarketingButton label={t('retry')} onPress={() => void usage.refetch()} /><ProMarketingButton secondary label={t('proEducation.close')} onPress={close} /></SafeAreaView>;
    const benefits = ['proPage.unlimited', 'proPage.analytics', 'paywallUx.eventTools'];
    const trialBenefits = [
        { Icon: CalendarDays, title: 'proPage.unlimited', detail: 'prepaywall.agendaDetail' },
        { Icon: ChartNoAxesCombined, title: 'proPage.analytics', detail: 'prepaywall.statsDetail' },
        { Icon: UsersRound, title: 'paywallUx.eventTools', detail: 'prepaywall.eventsDetail' },
    ];
    const screenBackground = view === 'intro' || view === 'plans' ? p.surface : p.background;
    const benefitsList = <View testID="paywall-benefits" style={{ gap: 12 }}>
        {benefits.map(key => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: p.planTint, alignItems: 'center', justifyContent: 'center' }}><Check size={14} color={p.accent} /></View>
            <Text style={{ color: p.ink, fontSize: 14, lineHeight: 20, flex: 1 }}>{t(key)}</Text>
        </View>)}
    </View>;
    const legal = <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 20 }}>
        {[['terms_of_use', 'terms_of_use_url'], ['privacy_policy', 'privacy_policy_url']].map(([label, url]) => <TouchableOpacity key={label} accessibilityRole="link" onPress={() => void Linking.openURL(t(url))} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: p.muted, fontSize: 11 }}>{t(label)}</Text></TouchableOpacity>)}
    </View>;
    const canReturnToTrial = view === 'plans' && !paidPro && (trial?.eligible === true || trial?.status === 'active');
    const free = !isPro && !verified ? <TouchableOpacity accessibilityRole="button" disabled={busy || isLoading} onPress={close} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: p.ink, fontSize: 13, fontWeight: '600' }}>{t('billing.stayFree')}</Text></TouchableOpacity> : null;
    return <View style={{ flex: 1, backgroundColor: screenBackground }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            {focused && <StatusBar style={p.dark ? 'light' : 'dark'} />}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 6, backgroundColor: view === 'intro' || view === 'plans' ? 'transparent' : p.dark ? 'transparent' : p.nav }}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t(canReturnToTrial ? 'back' : 'proEducation.close')} disabled={busy || isLoading} onPress={() => canReturnToTrial ? showPlans('intro') : close()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.nav, alignItems: 'center', justifyContent: 'center' }}>{canReturnToTrial ? <ChevronLeft size={23} color={p.ink} /> : <X size={23} color={p.ink} />}</TouchableOpacity>{view !== 'intro' && view !== 'plans' && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><AppLogo size={26} decorative /><Text style={{ color: p.ink, fontSize: 14, fontWeight: '600' }}>DJ Planner <Text style={{ color: p.accent }}>PRO</Text></Text></View>}<View style={{ width: 44 }} />
            </View>
            <ScrollView ref={scroll} testID="paywall-scroll" contentContainerStyle={{ flexGrow: 1, maxWidth: 540, width: '100%', alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 }}>
                <Animated.View key={view} entering={FadeIn.duration(180)} testID={`paywall-stage-${view}`} style={{ gap: view === 'intro' ? 24 : 18, flexGrow: 1, flexShrink: 0 }}>
                    {view === 'plans' && <View testID="plans-heading" style={{ alignItems: 'center', gap: 9 }}>
                        <AppLogo size={44} decorative />
                        <Text accessibilityRole="header" style={{ color: p.ink, fontSize: 24, lineHeight: 30, fontWeight: '800', textAlign: 'center', letterSpacing: -0.6 }}>{t('paywallUx.title')}</Text>
                        <Text style={{ color: p.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 310 }}>{t('paywallUx.sameFeatures')}</Text>
                    </View>}
                    {view === 'plans' && trial?.status === 'expired' && <Text testID="trial-status" style={{ color: p.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>{t('trial.expiredTitle')}</Text>}
                    {view === 'plans' && trial?.status === 'active' && <View testID="trial-status" style={{ gap: 4 }}><Text style={{ color: p.ink, fontSize: 12, lineHeight: 18 }}>{t('trial.activeUntil', { date: trialDate })}</Text><Text style={{ color: p.muted, fontSize: 12, lineHeight: 18 }}>{t('trial.purchaseTiming')}</Text></View>}
                    {view === 'intro' ? <>
                        <View testID="pro-trial-card" style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 2, gap: 12 }}>
                            <AppLogo size={60} decorative />
                            <Text style={{ color: p.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}>DJ PLANNER PRO</Text>
                            <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: p.ink, width: '100%', textAlign: 'center', fontSize: width < 360 ? 22 : 25, lineHeight: 32, letterSpacing: -0.6, fontWeight: '800' }}>{t('proEducation.trialTitle', { days: PRO_TRIAL_DAYS })}</Text>
                            <Text style={{ color: p.muted, textAlign: 'center', maxWidth: 310, fontSize: 14, lineHeight: 21 }}>{t('prepaywall.subtitle')}</Text>
                        </View>
                        <View testID="trial-benefits" style={{ gap: 20, paddingVertical: 4 }}>
                            {trialBenefits.map(({ Icon, title, detail }) => <View key={title} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                                <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: p.planTint, alignItems: 'center', justifyContent: 'center' }}><Icon size={21} strokeWidth={1.8} color={p.accent} /></View>
                                <View style={{ flex: 1, gap: 4, paddingTop: 1 }}>
                                    <Text style={{ color: p.ink, fontSize: 15, lineHeight: 21, fontWeight: '700' }}>{t(title)}</Text>
                                    <Text style={{ color: p.muted, fontSize: 13, lineHeight: 19 }}>{t(detail)}</Text>
                                </View>
                            </View>)}
                        </View>
                        <Text testID="trial-afterwards" style={{ color: p.muted, textAlign: 'center', fontSize: 12, lineHeight: 19, paddingHorizontal: 6 }}>{t('prepaywall.afterTrial')}</Text>
                        {params.reason === 'session-limit' && <Text style={{ color: p.muted, fontSize: 12, lineHeight: 18 }}>{t('billing.limitUsage', { count: Number(params.count) || 0, limit: FREE_SESSION_LIMIT })}</Text>}
                    </> : view === 'active' || view === 'member' ? <>
                        <View testID={`pro-${view}-card`} style={{ padding: 24, borderRadius: 26, backgroundColor: p.planTint, gap: 14 }}>
                            <View style={{ alignSelf: 'flex-start', padding: 10, borderRadius: 14, backgroundColor: p.surface }}><ShieldCheck size={28} color={p.accent} /></View>
                            <Text accessibilityRole="header" style={{ color: p.ink, fontSize: 28, lineHeight: 35, fontWeight: '800', letterSpacing: -0.7 }}>{t(view === 'active' ? 'trial.activeTitle' : 'billing.proPlan')}</Text>
                            <Text style={{ color: p.ink, fontSize: 15, lineHeight: 23 }}>{t(view === 'active' ? 'trial.activeUntil' : 'trial.memberSummary', { date: trialDate })}</Text>
                            {view === 'active' && <Text style={{ color: p.muted, fontSize: 13, lineHeight: 20 }}>{t('proEducation.trialEnd')}</Text>}
                        </View>
                        {benefitsList}
                        {view === 'active' && <Text style={{ color: p.muted, fontSize: 13, lineHeight: 20 }}>{t('trial.noRenewal')}</Text>}
                    </> : <>
                        {FEATURES.bookings && params.reason === 'bookings' && <Text style={{ color: p.muted, fontSize: 12 }}>{t(bookings.data?.serviceReady ? 'bookings.proBenefit' : 'bookings.setupPendingHint')}</Text>}
                        <View testID="plans-benefits" style={{ gap: 12 }}>
                            {trialBenefits.map(({ Icon, title }) => <View key={title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: p.planTint, alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={p.accent} /></View>
                                <Text style={{ flex: 1, color: p.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' }}>{t(title)}</Text>
                            </View>)}
                        </View>
                        <View testID="paywall-plans" accessibilityRole="radiogroup" accessibilityLabel={t('billingFlow.plansTitle')} style={{ flexDirection: 'row', alignItems: 'stretch', gap: 12 }}>
                            {(['monthly', 'yearly'] as const).map(plan => {
                                const item = plan === 'monthly' ? monthlyPackage : annualPackage, chosen = selected === plan;
                                const state = planPricingState(plan, item?.product, nativeStore, storefrontCountryCode, regionCode, pricingNow);
                                const campaign = plan === 'yearly' ? annualCampaign : null;
                                const { needsConfirmation } = state;
                                const launch = campaign ? campaign.promotion : !nativeStore && state.launch;
                                const source = campaign ? 'reference' : state.source;
                                const PlanIcon = plan === 'monthly' ? CalendarDays : ShieldCheck;
                                return <TouchableOpacity key={plan} testID={`paywall-plan-${plan}`} accessibilityRole="radio" accessibilityLabel={t(plan === 'monthly' ? 'plan_monthly' : 'plan_yearly')} accessibilityState={{ checked: chosen, disabled: busy || isLoading }} aria-checked={chosen} disabled={busy || isLoading} onPress={() => setSelected(plan)} style={{ flex: 1, minWidth: 0, minHeight: 174, borderRadius: 18, borderWidth: 1.5, borderColor: chosen ? p.accent : p.border, backgroundColor: chosen ? p.planTint : p.surface, padding: width < 360 ? 12 : 14, gap: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <PlanIcon size={22} strokeWidth={1.8} color={chosen ? p.accent : p.muted} />
                                        <View style={{ width: 19, height: 19, borderRadius: 10, borderWidth: chosen ? 0 : 1.5, borderColor: p.muted, backgroundColor: chosen ? p.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{chosen && <Check size={12} color={p.onAccent} />}</View>
                                    </View>
                                    <Text style={{ color: p.ink, fontSize: 13, fontWeight: '700', marginTop: 3 }}>{t(plan === 'monthly' ? 'plan_monthly' : 'plan_yearly')}</Text>
                                    {needsConfirmation && <Text testID={`reference-label-${plan}`} style={{ color: p.muted, fontSize: 10, lineHeight: 14 }}>{t('billingFlow.spainReference')}</Text>}

                                    <Text numberOfLines={source !== 'unavailable' ? 1 : 2} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: p.ink, fontSize: source !== 'unavailable' ? 24 : 14, lineHeight: 29, fontWeight: '800', letterSpacing: -0.6 }}>{campaign ? formatAnnualPrice(campaign.price) : source === 'reference' ? referencePrice(plan) : item ? item.product.priceString : t('billing.priceUnavailable')}</Text>
                                    <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>{t(plan === 'monthly' ? 'proDesign.billedMonthly' : launch ? 'billingFlow.firstYear' : 'proDesign.billedAnnually')}</Text>
                                    {launch ? <Text testID="annual-standard-price" style={{ color: p.ink, fontSize: 12, lineHeight: 18, fontWeight: '600' }}>{t('billingFlow.annualRenews', { price: formatAnnualPrice(campaign?.standard ?? PRO_REFERENCE_PRICES.annualStandardPlanned) })}</Text> : plan === 'monthly' && <Text style={{ color: p.muted, fontSize: 12, lineHeight: 18 }}>{t('paywallUx.monthlyRenewal')}</Text>}
                                </TouchableOpacity>;
                            })}
                        </View>
                        {annualCampaign?.promotion && <Text testID="annual-launch-label" style={{ color: p.accent, fontSize: 12, lineHeight: 18, textAlign: 'center', fontWeight: '600' }}>{t('billingFlow.launchLabel', { date: new Date(2027, 0, 6).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }) })}</Text>}
                        {annualCampaign && annualPackage && Math.abs(annualPackage.product.price - annualCampaign.price) > 0.005 && <Text testID="annual-current-store-price" style={{ color: p.muted, fontSize: 11, lineHeight: 17 }}>{t('billingFlow.currentStorePrice', { price: annualPackage.product.priceString })}</Text>}
                        {hasPriceMismatch && <Text testID="store-currency-notice" accessibilityRole="alert" style={{ color: p.muted, fontSize: 12, lineHeight: 18 }}>{t('billingFlow.currencyMismatch')}</Text>}
                        {!pkg && <Text style={{ color: p.muted, fontSize: 12, lineHeight: 18 }}>{t(referencePrices ? 'trial.referencePrices' : 'billingFlow.pricesUnavailable')}</Text>}
                        {nativeStore && (!pkg || hasPriceMismatch) && <TouchableOpacity accessibilityRole="button" onPress={() => void refreshSubscriptionStatus()} disabled={busy || isLoading} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ color: p.accent, fontSize: 13, fontWeight: '700' }}>{t('billingFlow.reloadPrices')}</Text></TouchableOpacity>}
                        {!!message && <Text accessibilityRole="alert" style={{ color: verified ? p.accent : p.muted, fontSize: 13, lineHeight: 20 }}>{message}</Text>}
                    </>}
                {view !== 'intro' && <View style={{ gap: 0 }}>
                <TouchableOpacity accessibilityRole="button" disabled={busy || isLoading || !nativeStore} onPress={() => void act(true)} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: p.ink, fontSize: 12, fontWeight: '600', opacity: nativeStore ? 1 : 0.55 }}>{t('restore_purchases')}</Text></TouchableOpacity>
                {legal}

                </View>}
                </Animated.View>
            </ScrollView>
            <View style={{ maxWidth: 540, width: '100%', alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4, gap: 5, borderTopWidth: view === 'intro' || view === 'plans' ? 0 : 1, borderTopColor: p.border, backgroundColor: screenBackground }}>
                {view === 'intro' ? <>
                    <ProMarketingButton disabled={busy || usage.isPending || !trial?.eligible} busy={busy} label={t('prepaywall.start')} onPress={() => void activateTrial()} />
                    <Text style={{ color: p.muted, fontSize: 10, textAlign: 'center', marginTop: 3 }}>{t(usage.isError ? 'billing.usageError' : 'prepaywall.noCommitment')}</Text>{usage.isError && <TouchableOpacity accessibilityRole="button" onPress={() => void usage.refetch()} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: p.accent }}>{t('retry')}</Text></TouchableOpacity>}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', gap: 12 }}>
                    <TouchableOpacity accessibilityRole="button" onPress={() => showPlans('plans')} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}><Text style={{ color: p.ink, fontSize: 12, fontWeight: '500' }}>{t('billingFlow.seePrices')}</Text></TouchableOpacity>
                    {free}
                    </View>
                </> : view === 'active' || view === 'member' ? <>
                    <ProMarketingButton label={t('trial.continue')} onPress={continueToTool} />
                    {view === 'active' ? <TouchableOpacity accessibilityRole="button" onPress={() => showPlans('plans')} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: p.muted, fontSize: 13 }}>{t('billingFlow.seePrices')}</Text></TouchableOpacity> : (nativeStore || customerInfo?.managementURL) && <TouchableOpacity accessibilityRole="link" onPress={() => void Linking.openURL(subscriptionManagementUrl(Platform.OS, customerInfo?.managementURL))} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: p.muted, fontSize: 13 }}>{t('billingFlow.cancelLink')}</Text></TouchableOpacity>}
                </> : <>
                    {!paidPro && !verified && storeTrial && <Text style={{ color: p.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' }}>{t('billingFlow.storeTrial', { duration: storeTrial })}</Text>}
                    {!paidPro && !verified && pkg && <Text testID="paywall-checkout-total" style={{ color: p.ink, fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 5 }}>{selectedPriceConfirmation ? `${t('billingFlow.spainReference')}: ` : ''}{t(selected === 'monthly' ? 'billingFlow.monthTotal' : annualCampaign?.promotion ? 'billingFlow.firstYearTotal' : 'billingFlow.yearTotal', { price: selectedPriceConfirmation ? referencePrice(selected) : pkg.product.priceString })} · {t('paywallUx.renews')}</Text>}
                    {!nativeStore && !paidPro && !verified && <Text testID="paywall-purchase-unavailable" style={{ color: p.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 7 }}>{t('paywallUx.purchaseUnavailable')}</Text>}
                    <ProMarketingButton label={t(verified ? 'billing.return' : paidPro ? 'billing.verify' : selectedPriceConfirmation ? 'billingFlow.confirmStorePrice' : 'billingFlow.subscribe')} busy={busy || isLoading} disabled={!verified && !paidPro && !available} onPress={verified ? close : () => void act()} />
                </>}
                {view === 'plans' && free}
                {view === 'plans' && <Text style={{ color: p.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', paddingBottom: 4 }}>{t('paywallUx.renewalNotice')}</Text>}
                {view === 'intro' && legal}
                {!isPro && !verified && view === 'intro' && <Text style={{ color: p.muted, fontSize: 10, textAlign: 'center', lineHeight: 15 }}>{t('billingFlow.freeHint', { limit: FREE_SESSION_LIMIT })}</Text>}

            </View>
        </SafeAreaView>
    </View>;
}
