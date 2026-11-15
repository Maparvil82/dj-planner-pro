import { useScrollHeader } from '../src/hooks/useScrollHeader';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, Platform, Text, TextInput, View } from 'react-native';
import { Redirect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../src/store/useAuthStore';
import { useSessionByIdQuery } from '../src/hooks/useSessionsQuery';
import { useTranslation } from '../src/i18n/useTranslation';
import { shareDoorQr } from '../src/services/doorInvitationQr';
import { doorAccess } from '../src/services/doorAccess';
import { sessionDisplayTitle } from '../src/utils/sessionNaming';
import { sessionRange } from '../src/utils/sessionPlanning';
import { CommunityButton, CommunityMessage, useCommunityColors } from '../src/components/community/CommunityUI';
import { SessionFormHeader } from '../src/components/sessions/SessionFormLayout';

export default function DoorAccessScreen() {
    const { progress: headerProgress, onScroll: onHeaderScroll, onScrollBeginDrag: onHeaderScrollBeginDrag } = useScrollHeader('compact');
    const {sessionId}=useLocalSearchParams<{sessionId:string}>(),router=useRouter(),c=useCommunityColors(),{t}=useTranslation();
    const user=useAuthStore(s=>s.session?.user.id),ready=useAuthStore(s=>s.initialized&&s.hasHydrated),focused=useIsFocused();
    const event=useSessionByIdQuery(sessionId),client=useQueryClient();
    const allowed=!!user&&event.data?.user_id===user&&!event.data?.is_guest;
    const queryKey=['door-invites',user,sessionId];
    const list=useQuery({queryKey,queryFn:()=>doorAccess.list(sessionId),enabled:allowed&&focused,refetchInterval:focused?10000:false});
    const [label,setLabel]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
    const [issued,setIssued]=useState<{id:string;token:string;label:string}|null>(null);
    const qr=useRef<{toDataURL(callback:(value:string)=>void):void}|null>(null);
    const pending=useRef<typeof issued>(null),locked=useRef(false);
    const fail=(e:unknown)=>setError(t(e instanceof Error?e.message:'tickets.connectionError'));
    async function create() {
        if(locked.current)return;locked.current=true;setBusy(true);setError('');
        try {
            pending.current ||= await doorAccess.invitation(label);
            const data=await doorAccess.create(sessionId,pending.current);
            client.setQueryData(queryKey,data);setIssued(pending.current);pending.current=null;setLabel('');
        }catch(e){fail(e);}finally{locked.current=false;setBusy(false);}
    }
    async function shareQr() {
        if(!issued||!qr.current||locked.current)return;
        locked.current=true;setBusy(true);setError('');
        try {
            const encoded=await new Promise<string>((resolve,reject)=>{
                const timeout=setTimeout(()=>reject(new Error('door.shareUnavailable')),10000);
                qr.current!.toDataURL(value=>{clearTimeout(timeout);resolve(value);});
            });
            await shareDoorQr(issued.id,encoded);
        }catch(e){fail(e);}finally{locked.current=false;setBusy(false);}
    }
    async function revoke(id:string) {
        if(locked.current)return;locked.current=true;setBusy(true);setError('');
        try{client.setQueryData(queryKey,await doorAccess.revoke(sessionId,id));if(issued?.id===id)setIssued(null);}catch(e){fail(e);}finally{locked.current=false;setBusy(false);}
    }
    if(!ready)return <SafeAreaView style={{flex:1,backgroundColor:c.bg}}><ActivityIndicator color={c.accent}/></SafeAreaView>;
    if(!user)return <Redirect href="/(auth)/login"/>;
    const canCreate=allowed&&!!event.data&&event.data.status!=='cancelled'&&sessionRange(event.data).end>new Date();
    return <SafeAreaView style={{flex:1,backgroundColor:c.bg}}>
        <SessionFormHeader navigationBack progress={headerProgress} title={t('door.manage')} subtitle={event.data?sessionDisplayTitle(event.data,t):''} onClose={()=>router.back()}/>
        <ScrollView scrollEventThrottle={16} onScrollBeginDrag={onHeaderScrollBeginDrag} onTouchStart={onHeaderScrollBeginDrag} onScroll={onHeaderScroll} contentContainerStyle={{padding:20,gap:20,paddingBottom:40}} keyboardShouldPersistTaps="handled">
            {event.isPending?<ActivityIndicator color={c.accent}/>:!allowed?<CommunityMessage title={t('door.unavailable')}/>:<>
                <Text style={{color:c.muted,lineHeight:21}}>{t('door.ownerHint')}</Text>
                {canCreate&&<View style={{gap:12}}>
                    <TextInput accessibilityLabel={t('door.person')} placeholder={t('door.person')} placeholderTextColor={c.muted} value={label} editable={!busy&&!pending.current} maxLength={80} onChangeText={setLabel}
                        style={{color:c.fg,backgroundColor:c.field,padding:16,borderRadius:16}}/>
                    <CommunityButton label={t(pending.current?'door.retryCreate':'door.create')} busy={busy} disabled={!pending.current&&!label.trim()} onPress={create}/>
                </View>}
                {!!error&&<Text accessibilityRole="alert" style={{color:'#cb435b'}}>{error}</Text>}
                {!!issued&&<View style={{backgroundColor:c.card,borderRadius:22,padding:20,gap:16,alignItems:'center'}}>
                    <Text style={{fontSize:20,fontWeight:'700',color:c.fg}}>{issued.label}</Text>
                    <View style={{backgroundColor:'#fff',padding:12,borderRadius:12}}><QRCode value={doorAccess.link(issued)} size={180} getRef={value=>{qr.current=value;}}/></View>
                    <Text style={{color:c.muted,lineHeight:20,textAlign:'center'}}>{t('door.shareHint')}</Text>
                    <View style={{alignSelf:'stretch',gap:10}}>
                        <CommunityButton label={t('door.share')} onPress={()=>void Share.share({url:doorAccess.link(issued),message:t('door.shareMessage',{event:event.data?sessionDisplayTitle(event.data,t):'',link:doorAccess.link(issued)})}).catch(fail)}/>
                        {Platform.OS!=='web'&&<CommunityButton secondary busy={busy} label={t('door.shareQr')} onPress={shareQr}/>}
                        <CommunityButton secondary label={t('door.copy')} onPress={()=>void Clipboard.setStringAsync(doorAccess.link(issued)).then(()=>Alert.alert(t('door.copied'))).catch(fail)}/>
                    </View>
                </View>}
                <Text style={{fontSize:22,fontWeight:'800',color:c.fg}}>{t('door.team')}</Text>
                {list.isPending?<ActivityIndicator color={c.accent}/>:list.isError?<CommunityMessage title={t('tickets.connectionError')} retry={()=>void list.refetch()}/>:!list.data?.length?<Text style={{color:c.muted}}>{t('door.empty')}</Text>:list.data.map(invite=><View key={invite.id} style={{padding:18,borderRadius:20,backgroundColor:c.card,gap:10}}>
                    <Text style={{fontSize:17,fontWeight:'700',color:c.fg}}>{invite.label}</Text>
                    <Text style={{color:invite.revoked_at?c.muted:c.accent}}>{t(invite.revoked_at?'door.revoked':!canCreate?'door.ended':invite.claimed_at?'door.active':'door.pending')}</Text>
                    <Text style={{color:c.muted}}>{t('door.activity',{entries:Number(invite.qr_count)+Number(invite.manual_count),guests:invite.guest_count})}</Text>
                    {!invite.revoked_at&&<CommunityButton secondary compact disabled={busy} label={t('door.revoke')} accessibilityLabel={`${t('door.revoke')} ${invite.label}`} onPress={()=>Alert.alert(t('door.revoke'),t('door.revokeConfirm',{name:invite.label}),[{text:t('cancel'),style:'cancel'},{text:t('door.revoke'),style:'destructive',onPress:()=>void revoke(invite.id)}])}/>}
                </View>)}
            </>}
        </ScrollView>
    </SafeAreaView>;
}
