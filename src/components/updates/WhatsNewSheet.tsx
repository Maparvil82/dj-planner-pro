import { useResearchOverlayStore } from '../../store/useResearchOverlayStore';
import { recordUpdatesVisit } from '../../services/researchInvitation';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { SegmentedTabs } from '../ui/SegmentedTabs';
import { useCommunityColors } from '../community/communityColors';
import { useTranslation } from '../../i18n/useTranslation';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../lib/supabase';
import { updatesForVersion, type ProductUpdate as Item } from './versionUpdates';
export function WhatsNewSheet() {
    const c = useCommunityColors();
    const { t, currentLanguage } = useTranslation();
    const user = useAuthStore(s => s.session?.user.id);
    const segments = useSegments();
    const router = useRouter();
    const feedbackPending = useRef(false);
    const inTabs = segments[0] === '(tabs)';
    const version = Constants.executionEnvironment === 'storeClient' || Platform.OS === 'web' ? Constants.expoConfig?.version : Application.nativeApplicationVersion;
    // Isolate preview acknowledgements from the installed production version.
    const previewRevision = __DEV__ && Constants.executionEnvironment === 'storeClient' ? ':preview-20261103-calendar' : '';
    const contentRevision = version === '1.0.6' ? ':calendar-r1' : '';
    const key = user && version ? `whats-new:${user}:${version}${contentRevision}${previewRevision}` : null;
    const [readyKey, setReadyKey] = useState<string | null>(null);
    const [dismissedKey, setDismissedKey] = useState<string | null>(null);
    const [tab, setTab] = useState<'release' | 'roadmap'>('release');
    const [page, setPage] = useState(0);
    const list = useRef<FlatList<Item>>(null);
    const [width, setWidth] = useState(0);
    const { height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const query = useQuery({
        queryKey: ['whats-new', version], enabled: !!key && inTabs,
        queryFn: async () => {
            const { data, error } = await supabase.from('product_updates').select('id,kind,version,content,status').eq('visible', true).order('sort_order').order('created_at');
            if (error) throw error;
            return (data as Item[]).filter(item => item.kind === 'roadmap' || item.version === version);
        }, staleTime: 60_000,
    });
    useEffect(() => {
        let active = true;
        setReadyKey(null);
        if (key) void AsyncStorage.getItem(key).then(seen => { if (active && !seen) setReadyKey(key); else if (active && seen && user) void recordUpdatesVisit(user).catch(() => {}); }).catch(() => {});
        return () => { active = false; };
    }, [key]);
    const contentFor = (item: Item) => item.content[currentLanguage.split('-')[0]] || item.content.en || item.content.es;
    const updates = updatesForVersion(query.data || [], version || '');
    const releases = updates.filter(item => item.kind === 'release' && contentFor(item)) || [];
    const items = updates.filter(item => item.kind === tab && contentFor(item));
    const close = async () => {
        if (!key) return;
        setDismissedKey(key);
        try { await AsyncStorage.setItem(key, 'seen'); if (user) await recordUpdatesVisit(user, true); } catch { /* Retry display on next launch if local storage is unavailable. */ }
    };
    const changeTab = (next: 'release' | 'roadmap') => { setTab(next); setPage(0); };
    const showFeedback = tab === 'roadmap' && page >= items.length - 1;
    const visible = !!key && key === readyKey && key !== dismissedKey && inTabs && !query.isPending && releases.length > 0;
    useEffect(() => {
        useResearchOverlayStore.setState({ updatesVisible: visible });
        return () => { useResearchOverlayStore.setState({ updatesVisible: false }); };
    }, [visible]);
    const openFeedbackAfterClose = () => {
        if (!feedbackPending.current) return;
        feedbackPending.current = false;
        router.push('/feedback');
    };
    useEffect(() => {
        if (!visible && Platform.OS !== 'ios') openFeedbackAfterClose();
    }, [visible]);
    return <Modal transparent visible={visible} animationType="slide" onDismiss={openFeedbackAfterClose} onRequestClose={() => void close()}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
            <View accessibilityViewIsModal style={{ maxHeight: height - insets.top - 20, height: Math.min(580, height - insets.top - 20), backgroundColor: c.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Math.max(insets.bottom, 16) }}>
                <View style={{ alignItems: 'center', paddingTop: 10 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.border }} /></View>
                <View style={{ paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ flex: 1, color: c.fg, fontSize: 18, fontWeight: '700' }}>DJ Planner · {version}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('whatsNew.close')} onPress={() => void close()} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.muted, fontSize: 26 }}>×</Text></Pressable>
                </View>
                <View style={{ paddingHorizontal: 20 }}><SegmentedTabs value={tab} onChange={changeTab} label={t('whatsNew.title')} options={[{ value: 'release', label: t('whatsNew.title') }, { value: 'roadmap', label: t('whatsNew.roadmap') }]} /></View>
                <View style={{ flex: 1 }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
                    {width > 0 ? <FlatList key={`${tab}:${width}`} ref={list} data={items} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={item => item.id} getItemLayout={(_, index) => ({ length: width, offset: width * index, index })} onMomentumScrollEnd={event => setPage(Math.round(event.nativeEvent.contentOffset.x / width))} renderItem={({ item }) => {
                        const content = contentFor(item);
                        return <ScrollView style={{ width }} contentContainerStyle={{ padding: 24, gap: 16 }}>
                            {tab === 'roadmap' ? <Text style={{ color: c.accent, fontSize: 12, fontWeight: '600' }}>{t(item.status === 'in_development' ? 'whatsNew.development' : 'whatsNew.study')}</Text> : null}
                            <Text style={{ color: c.fg, fontSize: 23, fontWeight: '700' }}>{content.title}</Text>
                            <Text style={{ color: c.muted, fontSize: 16, lineHeight: 25 }}>{content.body}</Text>
                            {tab === 'roadmap' ? <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{t('whatsNew.hint')}</Text> : null}
                        </ScrollView>;
                    }} ListEmptyComponent={<View style={{ width, padding: 24 }}><Text style={{ color: c.muted }}>{t('whatsNew.empty')}</Text></View>} /> : <ActivityIndicator color={c.accent} />}
                </View>
                <View style={{ paddingHorizontal: 24, gap: 14 }}>
                    <Text accessibilityLiveRegion="polite" style={{ color: c.muted, textAlign: 'center', fontSize: 13 }}>{items.length ? `${page + 1} / ${items.length}` : ''}</Text>
                    <Pressable accessibilityRole="button" onPress={() => { if (page < items.length - 1) { list.current?.scrollToIndex({ index: page + 1 }); setPage(page + 1); } else if (tab === 'release') changeTab('roadmap'); else void close(); }} style={{ minHeight: 48, borderRadius: 16, backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center', padding: 12 }}>
                        <Text style={{ color: c.onAccent, fontWeight: '600', fontSize: 15 }}>{page < items.length - 1 ? t('whatsNew.next') : tab === 'release' ? t('whatsNew.roadmap') : t('whatsNew.done')}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" disabled={!showFeedback} accessible={showFeedback} accessibilityElementsHidden={!showFeedback} importantForAccessibility={showFeedback ? 'auto' : 'no-hide-descendants'} onPress={() => { feedbackPending.current = true; void close(); }} style={{ minHeight: 44, opacity: showFeedback ? 1 : 0, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 }}>
                        <Text style={{ color: c.accent, fontSize: 14, fontWeight: '600', textAlign: 'center' }}>{t('whatsNew.suggest')}</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    </Modal>;
}
