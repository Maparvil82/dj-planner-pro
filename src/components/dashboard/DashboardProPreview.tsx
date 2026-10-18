import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { LockKeyhole } from 'lucide-react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { ProMarketingButton, useProMarketingColors } from '../profile/ProMarketing';

type PreviewKind = 'metrics' | 'bars' | 'list';
type PreviewPalette = ReturnType<typeof useProMarketingColors>;

// Only decorative shapes are blurred. Real locked data and controls never mount.
function StatisticPreview({ id, title, kind, p }: { id: string; title: string; kind: PreviewKind; p: PreviewPalette }) {
    const target = useRef<View | null>(null);
    return (
        <View testID={`dashboard-pro-preview-card-${id}`} style={[styles.card, { backgroundColor: p.surface, borderWidth: p.dark ? 0 : 1, borderColor: p.border }]}>
            <View style={styles.cardHeader}>
                <Text accessibilityRole="header" style={[styles.cardTitle, { color: p.ink }]}>{title}</Text>
                <View style={[styles.badge, { backgroundColor: p.planTint }]}>
                    <LockKeyhole size={12} color={p.ink} />
                    <Text style={{ color: p.ink, fontSize: 10, fontWeight: '800' }}>PRO</Text>
                </View>
            </View>
            <View style={styles.preview}>
                <BlurTargetView ref={target} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={styles.shapes}>
                    {kind === 'metrics' ? <View style={styles.metrics}>
                        {[0, 1, 2, 3].map(key => <View key={key} style={[styles.metric, { backgroundColor: p.tile }]}>
                            <View style={[styles.caption, { backgroundColor: p.muted }]} />
                            <View style={[styles.amount, { backgroundColor: key % 2 ? p.accent : p.ink }]} />
                        </View>)}
                    </View> : kind === 'bars' ? <>
                        <View style={[styles.caption, { width: '45%', backgroundColor: p.muted }]} />
                        <View style={styles.bars}>
                            {[42, 66, 48, 85, 60, 100, 76].map((height, index) => <View key={index} style={{ flex: 1, height, borderRadius: 7, backgroundColor: index % 2 ? p.accent : '#8b78e6' }} />)}
                        </View>
                    </> : [90, 72, 54].map(width => <View key={width} style={{ gap: 12 }}>
                        <View style={[styles.caption, { width: '45%', backgroundColor: p.muted }]} />
                        <View style={{ width: `${width}%`, height: 18, borderRadius: 8, backgroundColor: p.accent }} />
                    </View>)}
                </BlurTargetView>
                <BlurView testID="dashboard-analytics-blur" pointerEvents="none" blurTarget={target} blurMethod="dimezisBlurView" intensity={40} tint={p.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            </View>
        </View>
    );
}

export function DashboardProPreview() {
    const p = useProMarketingColors();
    const { t } = useTranslation();
    const router = useRouter();
    const openPlans = () => router.push({ pathname: '/paywall', params: { reason: 'analytics' } });
    const previews: { id: string; title: string; kind: PreviewKind }[] = [
        { id: 'activity', title: t('insights.activity'), kind: 'bars' },
        { id: 'payments', title: t('insights.statusTitle'), kind: 'metrics' },
        { id: 'patterns', title: t('insights.patterns'), kind: 'metrics' },
        { id: 'cities', title: t('insights.cities'), kind: 'bars' },
        { id: 'pending', title: t('insights.pendingTitle'), kind: 'list' },
        { id: 'venues', title: t('insights.venueTitle'), kind: 'list' },
        { id: 'next', title: t('insights.nextGig'), kind: 'list' },
        { id: 'margin', title: t('advancedAnalytics.margin'), kind: 'metrics' },
        { id: 'profitable-venues', title: t('advancedAnalytics.venues'), kind: 'list' },
        { id: 'trend', title: t('advancedAnalytics.trend'), kind: 'bars' },
        { id: 'aging', title: t('advancedAnalytics.aging'), kind: 'list' },
        { id: 'concentration', title: t('advancedAnalytics.concentration'), kind: 'bars' },
    ];
    return (
        <View testID="dashboard-analytics-locked" style={styles.container}>
            <View style={styles.message}>
                <Text accessibilityRole="header" style={[styles.title, { color: p.ink }]}>{t('insights.proTitle')}</Text>
                <Text style={[styles.body, { color: p.muted }]}>{t('insights.proBody')}</Text>
                <ProMarketingButton label={t('insights.proAction')} onPress={openPlans} />
            </View>
            {previews.map(preview => <StatisticPreview key={preview.id} {...preview} p={p} />)}
            <View style={styles.message}>
                <Text style={[styles.body, { color: p.muted }]}>{t('insights.proTitle')}</Text>
                <ProMarketingButton label={t('insights.proAction')} onPress={openPlans} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: 18 },
    card: { borderRadius: 26, padding: 22, gap: 18 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardTitle: { flex: 1, minWidth: 0, fontSize: 18, fontWeight: '800' },
    preview: { overflow: 'hidden', borderRadius: 16 },
    shapes: { padding: 10, gap: 24, minHeight: 170 },
    metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    metric: { flexBasis: '42%', flexGrow: 1, padding: 12, gap: 18, borderRadius: 12 },
    amount: { height: 24, width: '75%', borderRadius: 6, opacity: 0.65 },
    caption: { height: 10, width: '70%', borderRadius: 5, opacity: 0.5 },
    bars: { height: 110, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
    message: { paddingVertical: 20, paddingHorizontal: 12, gap: 16, alignItems: 'center' },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 9, borderRadius: 20 },
    title: { fontSize: 25, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center', maxWidth: 460 },
    body: { fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 440 },
});
