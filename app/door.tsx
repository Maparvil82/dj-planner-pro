import { useScrollHeader } from '../src/hooks/useScrollHeader';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Linking, Platform, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { doorAccess, type DoorCredential, type DoorState } from '../src/services/doorAccess';
import { guestSearch } from '../src/services/guests';
import type { EntryCountResult } from '../src/services/entryCounter';
import { useAuthStore } from '../src/store/useAuthStore';
import { useTranslation } from '../src/i18n/useTranslation';
import { CommunityButton, CommunityMessage, useCommunityColors } from '../src/components/community/CommunityUI';
import { SessionFormHeader } from '../src/components/sessions/SessionFormLayout';

export default function DoorScreen() {
    const { progress: headerProgress, onScroll: onHeaderScroll, onScrollBeginDrag: onHeaderScrollBeginDrag } = useScrollHeader('compact');
    const params=useLocalSearchParams<{invite?:string;key?:string}>(),router=useRouter(),c=useCommunityColors(),{t,currentLanguage}=useTranslation();
    const [credential,setCredential]=useState<DoorCredential|null>(null),[state,setState]=useState<DoorState|null>(null);
    const [initializing,setInitializing]=useState(true),[error,setError]=useState(''),[fatal,setFatal]=useState(false),[busy,setBusy]=useState(false);
    const [tab,setTab]=useState<'scan'|'guests'>('scan'),[search,setSearch]=useState(''),[scanning,setScanning]=useState(false),[result,setResult]=useState<EntryCountResult|null>(null),[manual,setManual]=useState('');
    const [foreground,setForeground]=useState(AppState.currentState==='active'),[permission,requestPermission]=useCameraPermissions();
    const signedIn=useAuthStore(s=>!!s.session);
    const focused=useIsFocused(),alive=useRef(true),working=useRef(false),scanLock=useRef(false);
    const pending=useRef<{id:string;guest:string|null;quantity:number}|null>(null),[retryPending,setRetryPending]=useState(false);
    const [,tick]=useState(0);
    const initialization=useRef(0);
    const active=focused&&foreground;
    useEffect(()=>{alive.current=true;const subscription=AppState.addEventListener('change',s=>setForeground(s==='active'));return()=>{alive.current=false;subscription.remove();};},[]);
    const unavailable=(e:unknown)=>e instanceof Error&&(e.message==='door.unavailable'||e.message==='door.alreadyClaimed');
    function fail(e:unknown) {
        setError(t(e instanceof Error?e.message:'tickets.connectionError'));
        if(unavailable(e)){setFatal(true);setState(null);setScanning(false);if(credential)void doorAccess.forget(credential).catch(()=>undefined);}
    }
    async function initialize() {
        const version=++initialization.current;
        const current=()=>alive.current&&version===initialization.current;
        setInitializing(true);setFatal(false);setError('');setCredential(null);setState(null);
        let next:DoorCredential|null=null;
        try {
            next=params.invite?await doorAccess.prepare(params.invite):await doorAccess.active();
            if(!next)throw new Error('door.unavailable');
            if(params.invite&&params.key)await doorAccess.claim(next,params.key);
            const data=await doorAccess.state(next);
            if(!current())return;
            setCredential(next);setState(data);
            // Remove the one-use invitation token from navigation history after claiming.
            if(params.key)router.replace('/door');
        }catch(e){if(!current())return;if(unavailable(e)&&next)await doorAccess.forget(next).catch(()=>undefined);if(current())fail(e);}finally{if(current())setInitializing(false);}
    }
    useEffect(()=>{void initialize();},[params.invite,params.key]);
    useEffect(()=>{
        if(!active||!credential||fatal)return;
        let cancelled=false;
        async function update(){try{const data=await doorAccess.state(credential!);if(!cancelled){setState(data);tick(x=>x+1);}}catch(e){if(!cancelled)fail(e);}}
        void update();const timer=setInterval(()=>void update(),10000);
        return()=>{cancelled=true;clearInterval(timer);};
    },[active,credential,fatal]);
    const canAdmit=!!state&&!fatal&&new Date(state.opens_at)<=new Date()&&new Date()<new Date(state.ends_at);
    async function register(guest:string|null=null,quantity=1) {
        if(!credential||working.current||!canAdmit)return;working.current=true;setBusy(true);setError('');
        pending.current ||= {id:Crypto.randomUUID(),guest,quantity};
        try {
            const request=pending.current;
            await doorAccess.admit(credential,request.id,request.guest,request.quantity);
            pending.current=null;setRetryPending(false);
            setState(await doorAccess.state(credential));
        }catch(e){if(e instanceof Error&&e.message==='guests.changed'){pending.current=null;setRetryPending(false);setState(await doorAccess.state(credential).catch(()=>null));}else setRetryPending(!!pending.current);fail(e);}
        finally{working.current=false;setBusy(false);}
    }
    async function scan(code:string) {
        if(!credential||scanLock.current||working.current||!canAdmit)return;scanLock.current=true;working.current=true;setBusy(true);setError('');
        try{const response=await doorAccess.scan(credential,code);setResult(response);setState(await doorAccess.state(credential));}
        catch(e){fail(e);}finally{working.current=false;setBusy(false);}
    }
    function resetScan(){scanLock.current=false;setResult(null);setError('');setManual('');}
    const totals=state?.guests.reduce((sum,g)=>({admitted:sum.admitted+Number(g.admitted),total:sum.total+Number(g.total)}),{admitted:0,total:0});
    return <SafeAreaView style={{flex:1,backgroundColor:c.bg}}>
        <SessionFormHeader progress={headerProgress} title={t('door.title')} subtitle={state?(state.title||state.venue):''} onClose={()=>router.replace(signedIn?'/(tabs)/home':'/(auth)/welcome')}/>
        {initializing?<ActivityIndicator color={c.accent}/>:fatal||!state?<View style={{padding:20}}><CommunityMessage title={error||t('door.unavailable')} hint={t('door.invalidHint')} retry={initialize}/></View>:scanning?<View style={{flex:1,padding:20,gap:16}}>
            {result||error?<>
                <CommunityMessage title={error||t(result?.status==='accepted'?'entryCounter.result_accepted':'entryCounter.result_already_used')} hint={result?t('entryCounter.total',{count:result.count}):undefined}/>
                <CommunityButton label={t('tickets.scanNext')} disabled={busy} onPress={resetScan}/>
            </>:busy?<ActivityIndicator color={c.accent}/>:!permission?.granted?<>
                <Text style={{color:c.fg,fontSize:20,fontWeight:'700'}}>{t('tickets.cameraTitle')}</Text>
                <Text style={{color:c.muted}}>{t('tickets.cameraHint')}</Text>
                <CommunityButton label={t(permission?.canAskAgain===false?'tickets.openSettings':'tickets.allowCamera')} onPress={()=>void (permission?.canAskAgain===false?Linking.openSettings():requestPermission()).catch(fail)}/>
            </>:<>
                <View style={{flex:1,minHeight:220,backgroundColor:'#111',borderRadius:24,overflow:'hidden'}}>
                    {active&&canAdmit&&<CameraView style={{flex:1}} facing="back" barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={({data})=>void scan(data)} onMountError={()=>setError(t('tickets.cameraError'))}/>}
                </View>
                {Platform.OS==='web'&&<><TextInput accessibilityLabel={t('tickets.manualQr')} value={manual} onChangeText={setManual} style={{padding:16,backgroundColor:c.field,color:c.fg}}/><CommunityButton label={t('tickets.validate')} disabled={!manual||!canAdmit} onPress={()=>scan(manual)}/></>}
            </>}
            <CommunityButton secondary label={t('door.back')} disabled={busy} onPress={()=>{setScanning(false);resetScan();}}/>
        </View>:<FlatList scrollEventThrottle={16} onScrollBeginDrag={onHeaderScrollBeginDrag} onTouchStart={onHeaderScrollBeginDrag} onScroll={onHeaderScroll} data={tab==='guests'?state.guests.filter(g=>guestSearch(g.full_name).includes(guestSearch(search))):[]}
            keyExtractor={g=>g.id} contentContainerStyle={{padding:20,gap:12,paddingBottom:36}} keyboardShouldPersistTaps="handled"
            ListHeaderComponent={<View style={{gap:18,marginBottom:8}}>
                <Text style={{color:c.muted}}>{state.venue} · {state.start_time} – {state.end_time}</Text>
                <Text style={{color:c.accent,fontWeight:'700'}}>{state.label}</Text>
                <View style={{flexDirection:'row',gap:12}}>
                    <View style={{flex:1,backgroundColor:c.card,borderRadius:22,padding:18,gap:8}}><Text style={{color:c.muted,minHeight:36}}>{t('live.entries')}</Text><Text testID="door-entries" style={{color:c.accent,fontSize:36,fontWeight:'800'}}>{state.entries}</Text></View>
                    <View style={{flex:1,backgroundColor:c.card,borderRadius:22,padding:18,gap:8}}><Text style={{color:c.muted,minHeight:36}}>{t('live.guests')}</Text><Text style={{color:c.accent,fontSize:36,fontWeight:'800'}}>{totals?.admitted} / {totals?.total}</Text></View>
                </View>
                <Text style={{color:c.muted,fontSize:12,lineHeight:18}}>{t('live.countHint')}</Text>
                {new Date(state.opens_at)>new Date()&&<Text style={{color:c.muted}}>{t('door.opens',{time:new Date(state.opens_at).toLocaleString(currentLanguage)})}</Text>}
                {!!error&&<CommunityMessage title={error} retry={()=>void doorAccess.state(credential!).then(data=>{setState(data);setError('');}).catch(fail)}/>}
                {retryPending&&<CommunityButton label={t('door.retryAdmission')} busy={busy} onPress={()=>register()}/>}
                <View style={{flexDirection:'row',gap:10}}>
                    <View style={{flex:1}}><CommunityButton secondary={tab!=='scan'} label={t('tickets.title')} onPress={()=>setTab('scan')}/></View>
                    <View style={{flex:1}}><CommunityButton secondary={tab!=='guests'} label={t('guests.title')} onPress={()=>setTab('guests')}/></View>
                </View>
                {tab==='scan'?<>
                    <CommunityButton label={t('tickets.scan')} disabled={!canAdmit||!!error||retryPending} onPress={()=>{resetScan();setScanning(true);}}/>
                    <CommunityButton secondary label={t('entryCounter.addManual')} busy={busy} disabled={!canAdmit||!!error||retryPending} onPress={()=>register()}/>
                    <Text style={{color:c.muted,fontSize:12,lineHeight:18}}>{t('entryCounter.scanHint')}</Text>
                </>:<TextInput accessibilityLabel={t('guests.search')} placeholder={t('guests.search')} placeholderTextColor={c.muted} value={search} onChangeText={setSearch} style={{color:c.fg,backgroundColor:c.field,padding:16,borderRadius:16}}/>}
            </View>}
            ListEmptyComponent={tab==='guests'?<Text style={{color:c.muted,textAlign:'center'}}>{t(search?'live.noResults':'live.noGuests')}</Text>:undefined}
            renderItem={({item:g})=><View style={{backgroundColor:c.card,padding:18,borderRadius:20,gap:12}}>
                <Text style={{color:c.fg,fontSize:17,fontWeight:'700'}}>{g.full_name}{g.companions>0?` +${g.companions}`:''}</Text>
                <Text style={{color:c.muted}}>{t('live.guestAccess',{admitted:g.admitted,total:g.total})}</Text>
                <CommunityButton compact label={t('door.admitOne')} accessibilityLabel={`${t('door.admitOne')} ${g.full_name}`} disabled={!canAdmit||!!error||busy||retryPending||Number(g.admitted)>=Number(g.total)} onPress={()=>register(g.id)}/>
            </View>}/>
        }
    </SafeAreaView>;
}
