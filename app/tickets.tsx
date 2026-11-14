import { useSessionToolBack } from '../src/hooks/useSessionToolBack';
import { useSessionToolContext } from '../src/hooks/useSessionToolContext';
import { useScrollHeader } from '../src/hooks/useScrollHeader';
import { useEffect, useRef, useState } from 'react';
import { AppState, ActivityIndicator, FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Redirect, useIsFocused, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../src/store/useAuthStore';
import { useTranslation } from '../src/i18n/useTranslation';
import { entryCounterService } from '../src/services/entryCounter';
import { sessionRange } from '../src/utils/sessionPlanning';
import { sessionDisplayTitle } from '../src/utils/sessionNaming';
import { CommunityButton, CommunityMessage, useCommunityColors } from '../src/components/community/CommunityUI';
import { SessionSelectionEmpty } from '../src/components/sessionTools/SessionSelectionEmpty';
import { SessionFormHeader } from '../src/components/sessions/SessionFormLayout';

export default function EntryCounterScreen() {
    const goBack = useSessionToolBack();
    const { progress: headerProgress, onScroll: onHeaderScroll, onScrollBeginDrag: onHeaderScrollBeginDrag } = useScrollHeader('compact');
    const { sessionId, setSessionId, isSessionBound, sessions } = useSessionToolContext();
    const [search, setSearch] = useState('');
    const [adding, setAdding] = useState(false), [error, setError] = useState('');
    const pendingManual = useRef<{sessionId: string; requestId: string} | null>(null);
    const working = useRef(false);
    const client = useQueryClient();
    const userId = useAuthStore(s => s.session?.user.id);
    const router = useRouter(), focused = useIsFocused(), c = useCommunityColors();
    const { t, currentLanguage } = useTranslation();
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        if (!focused) return;
        setNow(new Date());
        const timer = setInterval(() => setNow(new Date()), 30000);
        const listener = AppState.addEventListener('change', state => {
            if (state === 'active') setNow(new Date());
        });
        return () => {clearInterval(timer);listener.remove();};
    }, [focused]);
    const owned = sessions.data?.filter(s => s.user_id === userId && !s.is_guest) || [];
    const event = owned.find(s => s.id === sessionId);
    const canRegister = !!event && event.status !== 'cancelled' && sessionRange(event).end > now;
    const count = useQuery({
        queryKey: ['entry-counter', userId, sessionId],
        queryFn: () => entryCounterService.count(sessionId),
        enabled: !!event && focused,
        refetchInterval: focused ? 10000 : false,
        staleTime: 0,
    });
    async function addAccess() {
        if (!canRegister || working.current) return;
        working.current = true;
        setAdding(true);
        setError('');
        const request = pendingManual.current?.sessionId === sessionId
            ? pendingManual.current
            : {sessionId, requestId: Crypto.randomUUID()};
        pendingManual.current = request;
        try {
            const result = await entryCounterService.addManual(request.sessionId, request.requestId);
            client.setQueryData(['entry-counter', userId, request.sessionId], result.count);
            pendingManual.current = null;
        } catch (e) {
            setError(t(e instanceof Error ? e.message : 'tickets.connectionError'));
        } finally {
            working.current = false;
            setAdding(false);
        }
    }
    const ready = useAuthStore(s => s.initialized && s.hasHydrated);
    if (!ready) return <SafeAreaView style={{flex:1,backgroundColor:c.bg,justifyContent:'center'}}><ActivityIndicator color={c.accent}/></SafeAreaView>;
    if (!userId) return <Redirect href="/(auth)/login" />;
    const available = owned.filter(s => s.status !== 'cancelled' && sessionRange(s).end > now);
    const rows = available
        .filter(s => `${sessionDisplayTitle(s,t)} ${s.venue} ${s.date}`.toLowerCase().includes(search.toLowerCase()))
        .sort((a,b) => sessionRange(a).start.getTime() - sessionRange(b).start.getTime());
    return <SafeAreaView style={{flex:1,backgroundColor:c.bg}}>
        <SessionFormHeader navigationBack progress={headerProgress} title={t('entryCounter.title')} subtitle={event ? sessionDisplayTitle(event,t) : isSessionBound ? '' : t('tickets.chooseSession')} onClose={goBack} />
        {sessions.isPending ? <ActivityIndicator color={c.accent}/> : sessions.isError ?
            <CommunityMessage title={t('tickets.connectionError')} retry={() => void sessions.refetch()}/> : isSessionBound && !event ? <CommunityMessage title={t('tools.invalidSession')}/> : !event ?
            <FlatList scrollEventThrottle={16} onScrollBeginDrag={onHeaderScrollBeginDrag} onTouchStart={onHeaderScrollBeginDrag} onScroll={onHeaderScroll} data={rows} keyExtractor={s => s.id} contentContainerStyle={{padding:20,gap:12}}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={available.length ? <TextInput accessibilityLabel={t('search')} placeholder={t('search')} placeholderTextColor={c.muted} value={search} onChangeText={setSearch}
                    style={{backgroundColor:c.field,color:c.fg,padding:16,borderRadius:16,marginBottom:12}}/> : undefined}
                ListEmptyComponent={available.length ? <CommunityMessage title={t('sessionSelection.noResults')} /> : <SessionSelectionEmpty purpose="entries" />}
                renderItem={({item:s}) => <TouchableOpacity accessibilityRole="button" onPress={() => setSessionId(s.id)} style={{backgroundColor:c.card,padding:20,borderRadius:20,gap:8}}>
                    <Text style={{color:c.fg,fontSize:18,fontWeight:'700'}}>{sessionDisplayTitle(s,t)}</Text>
                    <Text style={{color:c.muted}}>{new Date(s.date+'T12:00:00').toLocaleDateString(currentLanguage)} · {s.venue}</Text>
                </TouchableOpacity>}/> :
            <ScrollView scrollEventThrottle={16} onScrollBeginDrag={onHeaderScrollBeginDrag} onTouchStart={onHeaderScrollBeginDrag} onScroll={onHeaderScroll} style={{flex:1}} contentContainerStyle={{flexGrow:1,padding:20,gap:20,paddingBottom:12}} keyboardShouldPersistTaps="handled">
                {!isSessionBound && <CommunityButton secondary label={t('entryCounter.changeSession')} disabled={adding || (!!pendingManual.current && canRegister)} onPress={() => {if (!canRegister) pendingManual.current = null;setSessionId('');setError('');}}/>}
                <View style={{backgroundColor:c.card,borderRadius:28,padding:28,alignItems:'center',gap:12}}>
                    <Text style={{color:c.muted,fontSize:16}}>{t('entryCounter.countLabel')}</Text>
                    {count.isPending ? <ActivityIndicator color={c.accent}/> : count.isError ?
                        <CommunityMessage title={t('tickets.connectionError')} retry={() => void count.refetch()}/> :
                        <Text accessibilityRole="text" style={{color:c.accent,fontSize:76,fontWeight:'800'}}>{count.data}</Text>}
                </View>
                <CommunityButton label={t('tickets.scan')} disabled={adding || !!pendingManual.current || !canRegister} onPress={() => router.push({pathname:'/ticket-scanner',params:{sessionId,mode:'counter'}})}/>
                <CommunityButton secondary label={t(pendingManual.current ? 'entryCounter.retryManual' : 'entryCounter.addManual')} disabled={adding || !canRegister} onPress={() => void addAccess()}/>
                {adding && <ActivityIndicator color={c.accent}/>}
                {!!error && <Text accessibilityRole="alert" style={{color:'#cb435b'}}>{error}</Text>}
                <Text style={{color:c.muted,lineHeight:22}}>{t('entryCounter.hint')}</Text>
                {event.status !== 'cancelled' && !canRegister && <Text style={{color:c.muted}}>{t('entryCounter.closed')}</Text>}
                {event.status === 'cancelled' && <Text style={{color:c.muted}}>{t('tickets.eventCancelled')}</Text>}
                <View style={{flexGrow:1}} />
                <TouchableOpacity accessibilityRole="link" accessibilityLabel={t('door.grant')} accessibilityState={{disabled: adding || !!pendingManual.current}} disabled={adding || !!pendingManual.current} onPress={() => router.push({pathname:'/door-access',params:{sessionId}})} hitSlop={8}
                    style={{alignSelf:'center',marginTop:12,minHeight:44,justifyContent:'center',paddingHorizontal:12,opacity:adding || !!pendingManual.current ? 0.5 : 1}}>
                    <Text style={{color:c.accent,fontSize:14,fontWeight:'600'}}>{t('door.grant')}</Text>
                </TouchableOpacity>
            </ScrollView>}
    </SafeAreaView>;
}
