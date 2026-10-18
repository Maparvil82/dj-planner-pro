import { useScrollHeader } from '../src/hooks/useScrollHeader';
import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useLiveSessions } from '../src/hooks/useLiveSessions';
import { useAuthStore } from '../src/store/useAuthStore';
import { useTranslation } from '../src/i18n/useTranslation';
import { entryCounterService } from '../src/services/entryCounter';
import { guestService, guestSearch } from '../src/services/guests';
import { sessionDisplayTitle } from '../src/utils/sessionNaming';
import { CommunityButton, CommunityMessage, useCommunityColors } from '../src/components/community/CommunityUI';
import { SessionFormHeader } from '../src/components/sessions/SessionFormLayout';

export default function LiveScreen() {
    const { progress: headerProgress, onScroll: onHeaderScroll, onScrollBeginDrag: onHeaderScrollBeginDrag } = useScrollHeader('compact');
    const c = useCommunityColors(), router = useRouter(), {t,currentLanguage} = useTranslation();
    const userId = useAuthStore(s => s.session?.user.id);
    const ready = useAuthStore(s => s.initialized && s.hasHydrated);
    const sessions = useLiveSessions();
    const [selected, setSelected] = useState(''), [search,setSearch] = useState('');
    const [refreshing,setRefreshing] = useState(false);
    const event = sessions.live.find(s => s.id === selected) || sessions.live[0];
    const sessionId = event?.id || '';
    const enabled = !!event && sessions.active;
    const entries = useQuery({
        queryKey:['entry-counter',userId,sessionId],
        queryFn:() => entryCounterService.count(sessionId),
        enabled, staleTime:0, refetchInterval:enabled ? 10000 : false,
    });
    const guests = useQuery({
        queryKey:['guests',userId,sessionId],
        queryFn:() => guestService.list(sessionId),
        enabled, staleTime:0, refetchInterval:enabled ? 10000 : false,
    });
    const totals = guests.data?.reduce((sum,g) => ({admitted:sum.admitted+Number(g.admitted),total:sum.total+Number(g.total)}),{admitted:0,total:0});
    const rows = [...(guests.data || [])].filter(g => guestSearch(g.full_name).includes(guestSearch(search)))
        .sort((a,b) => Number(b.admitted > 0)-Number(a.admitted > 0) || a.full_name.localeCompare(b.full_name,currentLanguage));
    const refresh = async () => {
        setRefreshing(true);
        try { await Promise.all([entries.refetch(),guests.refetch()]); }
        finally { setRefreshing(false); }
    };
    const updatedAt = Math.min(entries.dataUpdatedAt || 0,guests.dataUpdatedAt || 0);
    if (!ready) return <SafeAreaView style={{flex:1,backgroundColor:c.bg,justifyContent:'center'}}><ActivityIndicator color={c.accent}/></SafeAreaView>;
    if (!userId) return <Redirect href="/(auth)/login"/>;
    if (!event) return <SafeAreaView style={{flex:1,backgroundColor:c.bg}}>
        <SessionFormHeader progress={headerProgress} title={t('live.title')} subtitle={t('live.noSessionHint')} onClose={() => router.back()}/>
        {sessions.isPending ? <ActivityIndicator color={c.accent}/> : sessions.isError ?
            <CommunityMessage title={t('tickets.connectionError')} retry={() => void sessions.refetch()}/> :
            <CommunityMessage title={t('live.noSession')} hint={t('live.noSessionHint')}/>}
    </SafeAreaView>;
    const metric = (id:string,label:string,value:number | undefined,loading:boolean,failed:boolean) =>
        <View style={{flex:1,minWidth:0,backgroundColor:c.card,borderRadius:22,padding:18,gap:12}}>
            <Text style={[{color:c.muted,fontSize:13,fontWeight:'600'}, c.dark && { color: c.cardText }]}>{label}</Text>
            <View style={{minHeight:50,justifyContent:'center'}}>{loading ? <ActivityIndicator color={c.accent}/> : <Text testID={id} style={[{fontSize:40,fontWeight:'800',color:c.accent}, c.dark && { color: c.cardText }]}>{failed ? '—' : value}</Text>}</View>
        </View>;
    return <SafeAreaView style={{flex:1,backgroundColor:c.bg}}>
        <SessionFormHeader progress={headerProgress} title={t('live.title')} subtitle={sessionDisplayTitle(event,t)} onClose={() => router.back()}/>
        <FlatList scrollEventThrottle={16} onScrollBeginDrag={onHeaderScrollBeginDrag} onTouchStart={onHeaderScrollBeginDrag} onScroll={onHeaderScroll} data={rows} keyExtractor={g => g.id} contentContainerStyle={{padding:20,paddingBottom:36,gap:12}}
            keyboardShouldPersistTaps="handled" refreshing={refreshing} onRefresh={refresh}
            ListHeaderComponent={<View style={{gap:18,marginBottom:12}}>
                {sessions.live.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10}}>
                    {sessions.live.map(s => <TouchableOpacity key={s.id} accessibilityRole="button" accessibilityState={{selected:s.id===sessionId}}
                        onPress={() => {setSelected(s.id);setSearch('');}} style={{borderRadius:18,padding:12,backgroundColor:s.id===sessionId ? c.accent : c.card}}>
                        <Text style={{color:s.id===sessionId ? c.onAccent : c.fg,fontWeight:'700'}}>{sessionDisplayTitle(s,t)}</Text>
                    </TouchableOpacity>)}
                </ScrollView>}
                <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                    <View style={{width:7,height:7,borderRadius:4,backgroundColor:'#cf3e61'}}/>
                    <Text style={{color:c.fg,fontWeight:'700'}}>{t('live.ongoing')}</Text>
                    <Text style={{color:c.muted,flex:1,textAlign:'right',fontSize:12}}>{t('live.refreshHint')}</Text>
                </View>
                <Text style={{color:c.muted}}>{event.venue} · {event.start_time} – {event.end_time}</Text>
                <View style={{flexDirection:'row',gap:12}}>
                    {metric('live-entries',t('live.entries'),entries.data,entries.isPending,entries.isError)}
                    {metric('live-guests',t('live.guests'),totals?.admitted,guests.isPending,guests.isError)}
                </View>
                {!!totals && !guests.isError && <Text style={{color:c.muted}}>{t('live.guestProgress',{admitted:totals.admitted,total:totals.total,pending:Math.max(0,totals.total-totals.admitted)})}</Text>}
                {(entries.isError || guests.isError) ? <CommunityMessage title={t('live.connectionError')} retry={refresh}/> : updatedAt > 0 &&
                    <Text style={{color:c.muted,fontSize:12}}>{t('live.updated',{time:new Date(updatedAt).toLocaleTimeString(currentLanguage,{hour:'2-digit',minute:'2-digit',second:'2-digit'})})}</Text>}
                <Text style={{color:c.muted,fontSize:12,lineHeight:18}}>{t('live.countHint')}</Text>
                <View style={{flexDirection:'row',gap:10}}>
                    <View style={{flex:1}}><CommunityButton secondary compact label={t('tickets.title')} onPress={() => router.push({pathname:'/tickets',params:{sessionId}})}/></View>
                    <View style={{flex:1}}><CommunityButton secondary compact label={t('guests.title')} onPress={() => router.push({pathname:'/guests',params:{sessionId}})}/></View>
                </View>
                <CommunityButton secondary compact label={t('door.manage')} onPress={() => router.push({pathname:'/door-access',params:{sessionId}})}/>
                <Text style={{color:c.fg,fontSize:22,fontWeight:'800'}}>{t('live.guestList')}</Text>
                <TextInput accessibilityLabel={t('guests.search')} placeholder={t('guests.search')} placeholderTextColor={c.muted} value={search} onChangeText={setSearch}
                    style={{backgroundColor:c.field,color:c.fg,borderRadius:16,padding:15}}/>
            </View>}
            ListEmptyComponent={guests.isPending ? <ActivityIndicator color={c.accent}/> : guests.isError ? null :
                <Text style={{color:c.muted,textAlign:'center',padding:20}}>{t(search ? 'live.noResults' : 'live.noGuests')}</Text>}
            renderItem={({item:g}) => <View style={{backgroundColor:c.card,borderRadius:18,padding:18,gap:8}}>
                <Text style={[{color:c.fg,fontSize:16,fontWeight:'700'}, c.dark && { color: c.cardText }]}>{g.full_name}{g.companions > 0 ? ` +${g.companions}` : ''}</Text>
                <Text style={[{color:g.admitted > 0 ? c.accent : c.muted}, c.dark && { color: c.cardText }]}>{t('live.guestAccess',{admitted:g.admitted,total:g.total})}</Text>
            </View>}/>
    </SafeAreaView>;
}
