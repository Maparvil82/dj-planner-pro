import { StorageImage } from '../components/ui/StorageImage';
import Constants from 'expo-constants';
import { rcService } from '../services/revenuecat';
import { randomUUID } from 'expo-crypto';
import { posterAIRequest, pickPosterAIPhoto, sharePosterAI, posterAIMessage } from '../services/posterAI';
import { sessionRange } from '../utils/sessionPlanning';
import DateTimePicker from '@react-native-community/datetimepicker';
import { posterSessionDjs } from '../utils/posterSessionDjs';
import { formatRegionalDate } from '../i18n/regionalDates';
import { useTranslation } from '../i18n/useTranslation';
import { Plus, Minus, Share2, ArrowUp, CalendarDays, FilePlus2, ChevronRight, Search, X, Check, Clock3, Camera, UserRound, Trash2, Image as ImageIcon } from 'lucide-react-native';
import { SessionFormHeader } from '../components/sessions/SessionFormLayout';
import { PageHeader } from '../components/ui/PageHeader';
import { SegmentedTabs } from '../components/ui/SegmentedTabs';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs/index.js';
import { useQueryClient } from '@tanstack/react-query';
import { useAllSessionsQuery } from '../hooks/useSessionsQuery';
import { useAuthStore } from '../store/useAuthStore';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCommunityColors } from '../components/community/communityColors';
import { useSafeAreaInsets, SafeAreaView as AppSafeAreaView } from 'react-native-safe-area-context';

const artists = ['ALEX NOVA', 'LUNA', 'MARCO BEAT', 'SARA K'];
const sessions = [
  { id: 's1', title: 'MIDNIGHT SESSION', djs: ['ALEX NOVA', 'LUNA'], date: '24 OCT 2026', time: '23:30', venue: 'SALA ÓRBITA · MADRID' },
  { id: 's2', title: 'SUNDAY GROOVE', djs: ['MARCO BEAT'], date: '25 OCT 2026', time: '18:00', venue: 'TERRAZA SOL · VALENCIA' },
];
const editorialArtwork = require('../../assets/posters/previews/retrato-editorial-v1.jpg');
const aiArtworks = { Pulso: require('../../assets/posters/previews/pulso-v2.jpg'), 'Verde Indie': require('../../assets/posters/previews/verde-indie-v1.jpg'), 'Cabina Analógica': require('../../assets/posters/previews/cabina-analogica-v1.jpg'), 'Collage Sereno': require('../../assets/posters/previews/collage-sereno-v1.jpg'), 'Vinilo a Mano': require('../../assets/posters/previews/vinilo-a-mano-v3.jpg'), 'Offset Radical': require('../../assets/posters/previews/offset-radical-v1.jpg'), 'Coral Manifesto': require('../../assets/posters/previews/coral-manifesto-v1.jpg'), 'Impacto Amarillo': require('../../assets/posters/previews/impacto-amarillo-v1.jpg'), 'Duotono Editorial': require('../../assets/posters/previews/duotono-editorial-v1.jpg'), Remember: require('../../assets/posters/previews/remember-v1.jpg'), 'Summer Club': require('../../assets/posters/previews/summer-club-v1.jpg'), 'Urban Chrome': require('../../assets/posters/previews/urban-chrome-v1.jpg'), 'Premium Night': require('../../assets/posters/previews/premium-night-v1.jpg'), 'Pop Club': require('../../assets/posters/previews/pop-club-v1.jpg'), 'Bauhaus Sonoro': require('../../assets/posters/previews/bauhaus-sonoro-v1.jpg'), 'Jardín Surreal': require('../../assets/posters/previews/jardin-surreal-v1.jpg'), 'Jazz de Autor': require('../../assets/posters/previews/jazz-de-autor-v1.jpg'), 'Disco Collage': require('../../assets/posters/previews/disco-collage-v1.jpg'), 'Rave Industrial': require('../../assets/posters/previews/rave-industrial-v1.jpg'), 'Retrato Editorial': editorialArtwork, Headliner: require('../../assets/posters/previews/headliner-v1.jpg') };
const templateThumbnails = { Pulso: require('../../assets/posters/thumbnails/pulso-v2.jpg'), 'Verde Indie': require('../../assets/posters/thumbnails/verde-indie-v1.jpg'), 'Cabina Analógica': require('../../assets/posters/thumbnails/cabina-analogica-v1.jpg'), 'Collage Sereno': require('../../assets/posters/thumbnails/collage-sereno-v1.jpg'), 'Vinilo a Mano': require('../../assets/posters/thumbnails/vinilo-a-mano-v3.jpg'), 'Offset Radical': require('../../assets/posters/thumbnails/offset-radical-v1.jpg'), 'Coral Manifesto': require('../../assets/posters/thumbnails/coral-manifesto-v1.jpg'), 'Impacto Amarillo': require('../../assets/posters/thumbnails/impacto-amarillo-v1.jpg'), 'Duotono Editorial': require('../../assets/posters/thumbnails/duotono-editorial-v1.jpg'), Remember: require('../../assets/posters/thumbnails/remember-v1.jpg'), 'Summer Club': require('../../assets/posters/thumbnails/summer-club-v1.jpg'), 'Urban Chrome': require('../../assets/posters/thumbnails/urban-chrome-v1.jpg'), 'Premium Night': require('../../assets/posters/thumbnails/premium-night-v1.jpg'), 'Pop Club': require('../../assets/posters/thumbnails/pop-club-v1.jpg'), 'Bauhaus Sonoro': require('../../assets/posters/thumbnails/bauhaus-sonoro-v1.jpg'), 'Jardín Surreal': require('../../assets/posters/thumbnails/jardin-surreal-v1.jpg'), 'Jazz de Autor': require('../../assets/posters/thumbnails/jazz-de-autor-v1.jpg'), 'Disco Collage': require('../../assets/posters/thumbnails/disco-collage-v1.jpg'), 'Rave Industrial': require('../../assets/posters/thumbnails/rave-industrial-v1.jpg'), 'Retrato Editorial': require('../../assets/posters/thumbnails/retrato-editorial-v1.jpg'), Headliner: require('../../assets/posters/thumbnails/headliner-v1.jpg') };
const themes = {
  Pulso: ['#d65351', '#151515', '#f5f0df'],
  'Verde Indie': ['#f0f0ed', '#d52a38', '#459771'],
  'Cabina Analógica': ['#181817', '#efe5df', '#e75122'],
  'Collage Sereno': ['#e9e3cf', '#20201d', '#ed3926'],
  'Vinilo a Mano': ['#f3f1ee', '#181818', '#e63822'],
  'Offset Radical': ['#ffffff', '#ed101c', '#22d8e6'],
  'Coral Manifesto': ['#ff969c', '#2100a5', '#ef3aa9'],
  'Impacto Amarillo': ['#ffe000', '#151515', '#ffe000'],
  'Duotono Editorial': ['#f6f5ef', '#302982', '#f54a40'],
  'Pop Club': ['#f40c76', '#fff6db', '#1745c9'],
  'Bauhaus Sonoro': ['#f3ebd7', '#111111', '#ef301b'],
  'Jardín Surreal': ['#290910', '#ffe2a9', '#f48b72'],
  'Jazz de Autor': ['#f4e5be', '#101d37', '#e34a1e'],
  'Disco Collage': ['#ed582d', '#fff1c9', '#d91869'],
  'Rave Industrial': ['#050906', '#22ec73', '#22ec73'],
  Headliner: ['#122428', '#e2ff2e', '#e2ff2e'],
  'Retrato Editorial': ['#080908', '#f3efde', '#8c967a'],
  Remember: ['#10072d', '#f5f4ff', '#b5ff21'],
  'Premium Night': ['#1b130e', '#fff0d8', '#b99151'],
  'Urban Chrome': ['#113dcc', '#edf0f5', '#101114'],
  'Summer Club': ['#20bcc8', '#fff2ce', '#ff8058'],
};
const examples = [
  { id: 'pulso-v2', title: 'FRECUENCIA LIBRE', djs: ['NORA VELA', 'ÁLEX NOX'], date: '14 NOV 2026', time: '23:30', venue: 'SALA PRISMA · VALENCIA', style: 'Pulso', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks.Pulso },
  { id: 'verde-indie-v1', title: 'fuera de onda', djs: ['LUNA', 'MARCO BEAT'], date: '12 DIC 2026', time: '22:30', venue: 'SALA ÓRBITA · MADRID', style: 'Verde Indie', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Verde Indie'] },
  { id: 'cabina-analogica-v1', title: 'SURCO ABIERTO', djs: ['LUNA', 'MARCO BEAT'], date: '05 DIC 2026', time: '23:00', venue: 'SALA ÓRBITA · MADRID', style: 'Cabina Analógica', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Cabina Analógica'] },
  { id: 'collage-sereno-v1', title: 'Pausa sonora', djs: ['LUNA'], date: '28 NOV 2026', time: '21:00', venue: 'SALA ÓRBITA · MADRID', style: 'Collage Sereno', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Collage Sereno'] },
  { id: 'vinilo-a-mano-v3', title: 'OTRA FRECUENCIA', djs: ['LUNA'], date: '21 NOV 2026', time: '22:00', venue: 'SALA ÓRBITA · MADRID', style: 'Vinilo a Mano', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Vinilo a Mano'] },
  { id: 'offset-radical-v1', title: 'OTRA FORMA DE SONAR', djs: ['LUNA'], date: '05 DIC 2026', time: '23:30', venue: 'SALA ÓRBITA · MADRID', style: 'Offset Radical', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Offset Radical'] },
  { id: 'coral-manifesto-v1', title: 'FUERA DE SERIE', djs: ['LUNA'], date: '28 NOV 2026', time: '23:30', venue: 'CLUB CENTRAL · MADRID', style: 'Coral Manifesto', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Coral Manifesto'] },
  { id: 'impacto-amarillo-v1', title: 'OTRA NOCHE', djs: ['LUNA'], date: '21 NOV 2026', time: '23:30', venue: 'SALA ÓRBITA · MADRID', style: 'Impacto Amarillo', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Impacto Amarillo'] },
  { id: 'duotono-editorial-v1', title: 'OTRA FRECUENCIA', djs: ['LUNA'], date: '21 NOV 2026', time: '23:30', venue: 'SALA ÓRBITA · MADRID', style: 'Duotono Editorial', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Duotono Editorial'] },
  { id: 'pop-club-v1', title: 'MODO FIESTA', djs: ['LUNA'], date: '20 NOV 2026', time: '23:00', venue: 'CLUB CENTRAL · MADRID', style: 'Pop Club', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Pop Club'] },
  { id: 'bauhaus-sonoro-v1', title: 'RITMO MODULAR', djs: ['MANUEL PARRA'], date: '07 NOV 2026', time: '23:30', venue: 'SALA ÓRBITA · MADRID', style: 'Bauhaus Sonoro', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Bauhaus Sonoro'] },
  { id: 'jazz-de-autor-v1', title: 'BLUE HOUR', djs: ['MARCO BEAT'], date: '12 DIC 2026', time: '21:00', venue: 'CAFÉ CENTRAL · MADRID', style: 'Jazz de Autor', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Jazz de Autor'] },
  { id: 'disco-collage-v1', title: 'DISCO FEVER', djs: ['LUNA'], date: '05 DIC 2026', time: '22:30', venue: 'CLUB GROOVE · SEVILLA', style: 'Disco Collage', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Disco Collage'] },
  { id: 'rave-industrial-v1', title: 'FREQUENCY CONTROL', djs: ['SARA K'], date: '28 NOV 2026', time: '00:30', venue: 'NAVE 04 · MADRID', style: 'Rave Industrial', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Rave Industrial'] },
  { id: 'headliner-v1', title: 'MAIN ROOM', djs: ['MARCO BEAT'], date: '14 NOV 2026', time: '23:00', venue: 'CLUB DISTRITO · VALENCIA', style: 'Headliner', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks.Headliner },
  { id: 'editorial-v1', title: 'AFTER HOURS', djs: ['LUNA'], date: '24 OCT 2026', time: '23:30', venue: 'SALA ÓRBITA · MADRID', style: 'Retrato Editorial', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: editorialArtwork },
  { id: 'remember-v1', title: 'BACK TO DANCE', djs: ['MANUEL PARRA'], date: '19 DIC 2026', time: '23:30', venue: 'SALA ÓRBITA · MADRID', style: 'Remember', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks.Remember },
  { id: 'premium-night-v1', title: 'GOLDEN HOUR', djs: ['MANUEL PARRA'], date: '28 NOV 2026', time: '20:00', venue: 'AZOTEA · MADRID', style: 'Premium Night', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Premium Night'] },
  { id: 'urban-chrome-v1', title: 'CALLE CLUB', djs: ['MANUEL PARRA'], date: '04 DIC 2026', time: '00:00', venue: 'DISTRITO · MADRID', style: 'Urban Chrome', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Urban Chrome'] },
  { id: 'summer-club-v1', title: 'SOL Y RITMO', djs: ['MANUEL PARRA'], date: '12 JUN 2027', time: '18:00', venue: 'TERRAZA SOL · VALENCIA', style: 'Summer Club', format: 'Cartel', author: 'DJ Planner · Muestra', artwork: aiArtworks['Summer Club'] },
].map(item => ({ ...item, thumbnail: templateThumbnails[item.style] }));
// Active catalogue only. Historical themes/artwork remain available from Explore.
const activeStyles = examples.map(item => item.style);
const empty = { title: '', djs: [], date: '', time: '', venue: '' };
function Button({ children, onPress, secondary, disabled }) {
  const s = makeStyles(useCommunityColors());
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, secondary && s.secondary, disabled && { opacity: 0.4 }]}><Text style={[s.buttonText, secondary && s.secondaryText]}>{children}</Text></Pressable>;
}
function Chip({ label, selected, onPress }) {
  const s = makeStyles(useCommunityColors());
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.chip, selected && s.selected]}><Text style={[s.chipText, selected && s.selectedText]}>{label}</Text></Pressable>;
}
function SessionChoice({ session, dateLocale, onPress }) {
  const colors = useCommunityColors();
  const s = makeStyles(colors);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [session.posterUrl]);
  return <Pressable testID={`poster-session-${session.id}`} accessibilityRole="button" accessibilityLabel={`Elegir ${session.title || 'Sesión'}${session.posterUrl ? ', ya tiene cartel' : ', sin cartel'}`} onPress={onPress} style={[s.sessionCard, { height: 106, padding: 12 }]}>
    <View style={{width:48,height:72,borderRadius:8,overflow:'hidden',backgroundColor:colors.field,alignItems:'center',justifyContent:'center'}}>
      {session.posterUrl && !failed ? <StorageImage accessibilityLabel={`Cartel de ${session.title || 'Sesión'}`} source={{uri:session.posterUrl}} resizeMode="cover" style={{width:48,height:72}} onError={()=>setFailed(true)} /> : <ImageIcon size={23} color={colors.muted} />}
    </View>
    <View style={[s.flex,{minWidth:0}]}><Text style={s.sessionTitle} numberOfLines={1}>{session.title || 'Sesión'}</Text><Text style={s.note} numberOfLines={2}>{formatRegionalDate(session.date,dateLocale)} · {session.time?.slice(0,5)} · {session.venue}</Text></View><ChevronRight size={20} color={colors.muted} />
  </Pressable>;
}
function Poster({ data, small }) {
  const { dateLocale } = useTranslation();
  const displayDate = /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? formatRegionalDate(data.date, dateLocale) : data.date;
  const s = makeStyles(useCommunityColors());
  const colors = useCommunityColors();
  const imageSource = small && data.thumbnail ? data.thumbnail : data.artwork;
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageAttempt, setImageAttempt] = useState(0);
  useEffect(() => { setImageFailed(false); setImageLoading(true); }, [imageSource]);
  if (imageSource) return <View style={{ width: '100%', aspectRatio: small ? 2 / 3 : data.format === 'Historia' ? 9 / 16 : data.format === 'Cuadrado' ? 1 : 2 / 3, backgroundColor: colors.card }}>
    <Image key={imageAttempt} accessibilityLabel={data.aiJob ? `Cartel de ${data.djs.join(' / ')}` : `Muestra de ${data.style}`} source={imageSource} resizeMode="contain" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      onLoad={() => { setImageLoading(false); setImageFailed(false); }}
      onError={() => { setImageLoading(false); setImageFailed(true); }} />
    {(imageLoading || imageFailed) && <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, gap: 10, backgroundColor: colors.card }}>
      {imageFailed ? <>
        <Text style={[s.note, { textAlign: 'center' }]}>No se ha podido cargar la imagen.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Reintentar imagen de ${data.style}`} onPress={() => { setImageFailed(false); setImageLoading(true); setImageAttempt(attempt => attempt + 1); }} style={[s.secondary, { padding: 10, borderRadius: 12 }]}><Text style={s.secondaryText}>Reintentar</Text></Pressable>
      </> : <><ActivityIndicator color={colors.accent} /><Text style={s.note}>Cargando imagen…</Text></>}
    </View>}
  </View>;
  const [bg, fg, accent] = themes[data.style];
  return <View style={[s.poster, { backgroundColor: bg, aspectRatio: small ? 2 / 3 : data.format === 'Historia' ? 9 / 16 : data.format === 'Cuadrado' ? 1 : 2 / 3, padding: small ? 12 : 22 }]}>
    <View pointerEvents="none" style={[s.orbit, { borderColor: accent }]} />
    <Text style={{ color: fg, fontSize: small ? 8 : 13, fontWeight: '800', letterSpacing: 1 }}>{displayDate}</Text>

    <View style={s.posterCenter}><Text numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.45} style={{ color: fg, fontSize: small ? 24 : 42, fontWeight: '900' }}>{data.title || 'LIVE SESSION'}</Text><Text numberOfLines={3} adjustsFontSizeToFit style={{ color: fg, fontSize: small ? 11 : 21, fontWeight: '700' }}>{data.djs.join(' / ')}</Text></View>
    <View style={{ gap: 5 }}><Text numberOfLines={2} style={{ color: fg, fontSize: small ? 8 : 12, fontWeight: '700' }}>{data.venue}</Text><Text style={{ color: fg, fontSize: small ? 9 : 13 }}>{data.time}</Text></View>
  </View>;
}
export default function App({ generationEnabled = false, accessLoading = false }) {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const {posterId, createForSession} = useLocalSearchParams();
  const queryClient = useQueryClient();
  const { dateLocale } = useTranslation();
  const [sessionSearch, setSessionSearch] = useState('');
  const insets = useSafeAreaInsets();
  const colors = useCommunityColors();
  // Keep navigation visible when switching to a short or empty gallery.
  const { progress: headerProgress, onScroll, onScrollBeginDrag } = useScrollHeader('hide');
  const userId = useAuthStore(state => state.session?.user.id);
  const ownerArtistName = useAuthStore(state => state.profile?.id === state.session?.user.id ? state.profile?.artist_name : null);
  const sessionQuery = useAllSessionsQuery();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const sessions = (sessionQuery.data || []).filter(item => item.user_id === userId && !item.is_guest && item.status !== 'cancelled' && sessionRange(item).start.getTime() > now).map(item => ({ id: item.id, title: item.title, djs: posterSessionDjs(ownerArtistName, item.djs), date: item.date, time: item.start_time, venue: item.venue, posterUrl: item.poster_url || null }));
  const s = makeStyles(useCommunityColors());
  const [screen, setScreen] = useState('gallery');
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [screen]);
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState('Plantilla');
  const [explore, setExplore] = useState([]);
  const [sheetStep, setSheetStep] = useState(null);
  const [photoRows, setPhotoRows] = useState([{id:'photo-0',name:''}]);
  const [mineCursor, setMineCursor] = useState(null);
  const [exploreCursor, setExploreCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exploreError, setExploreError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [walletOpen,setWalletOpen] = useState(false);
  const [buyingCredits,setBuyingCredits] = useState(false);
  const [storePackages,setStorePackages] = useState([]);
  const [storeError,setStoreError] = useState('');
  const nativeStoreSupported = Platform.OS === 'ios' && Constants.executionEnvironment !== 'storeClient';
  const nativeStoreTesting = Platform.OS === 'ios' && Constants.executionEnvironment !== 'storeClient' && (__DEV__ || process.env.EXPO_PUBLIC_POSTER_STORE_TESTING === 'true');
  const [filter, setFilter] = useState('Todos');
  const [source, setSource] = useState('session');
  const [sessionId, setSessionId] = useState(null);
  const [expectedPosterUrl, setExpectedPosterUrl] = useState(null);
  const [creationSessionId, setCreationSessionId] = useState(null);
  const [form, setForm] = useState(empty);
  const [picker, setPicker] = useState(null);
  const [pickerValue, setPickerValue] = useState(new Date());
  const [style, setStyle] = useState('Retrato Editorial');
  const [format, setFormat] = useState('Cartel');
  const [mine, setMine] = useState([]);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [aiBudget, setAiBudget] = useState(null);
  const liveCredits = aiBudget?.creditMode === 'production';
  const credits = aiBudget?.credits ?? aiBudget?.testCredits ?? 0;
  const canUseStore = generationEnabled && nativeStoreSupported && (liveCredits ? aiBudget?.purchasesEnabled : (nativeStoreTesting || aiBudget?.sandboxPurchasesEnabled));
  const [aiJobs, setAiJobs] = useState([]);
  const [aiPhotos, setAiPhotos] = useState({});
  const [aiWorking, setAiWorking] = useState(false);
  const [activeAIId, setActiveAIId] = useState(null);
  const [aiConnectionError, setAiConnectionError] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const aiLock = useRef(false);
  const aiUser = useRef(userId); aiUser.current = userId;
  const moreLock = useRef(false);
  useLayoutEffect(() => {
    setMine([]); setExplore([]); setAiJobs([]); setAiBudget(null); setPreview(null);
    setMineCursor(null); setExploreCursor(null); setExploreError(''); setAiConnectionError('');
    setActiveAIId(null); setAiWorking(false); setLoadingMore(false); setWalletOpen(false);
    setScreen('gallery'); setSheetStep(null); setError(''); aiLock.current=false; moreLock.current=false;
  }, [userId]);
  const aiReady = Boolean(generationEnabled && aiBudget?.configured && aiBudget?.enabled && (aiBudget.canGenerate ?? aiBudget.remainingOperations > 0) && !aiJobs.some(job => job.status === 'uncertain'));
  function aiPreview(job) { return { ...job.form, id: job.id, sessionId: job.sessionId, own: true, aiJob: job, artwork: { uri: job.imageUrl } }; }
  const refreshAI = useCallback(async () => {
    if (!generationEnabled) return;
    const account = userId;
    try {
      const result = await posterAIRequest({ action: 'list' });
      if (aiUser.current !== account) return;
      if ((result.jobs || []).some(job => job.sessionPosterApplied)) { queryClient.invalidateQueries({queryKey:['sessions']}); queryClient.invalidateQueries({queryKey:['session']}); }
      setAiBudget(result.budget); setAiJobs(result.jobs || []); setAiConnectionError('');
      setMineCursor(result.nextCursor || null);
      setMine(current => [...(result.jobs || []).filter(job => job.status === 'complete').map(aiPreview), ...current.filter(item => !item.aiJob)]);
      const pending = (result.jobs || []).find(job => job.status === 'running' || job.status === 'uncertain');
      setActiveAIId(pending?.id || null);
    } catch (e) { if (aiUser.current === account) setAiConnectionError(e.message); }
    try {
      const feed = await posterAIRequest({ action: 'explore' });
      if (aiUser.current !== account) return;
      setExplore((feed.jobs || []).map(job => ({ ...job.form, id: job.id, artwork: { uri: job.imageUrl }, community: true })));
      setExploreCursor(feed.nextCursor || null); setExploreError('');
    } catch (e) { if (aiUser.current === account) setExploreError('No se ha podido cargar Explorar. Desliza hacia abajo para reintentar.'); }
  }, [generationEnabled, userId, queryClient]);
  async function loadMorePosters() {
    const browsing=tab==='Explorar';
    const cursor=browsing?exploreCursor:mineCursor;
    if(!cursor||moreLock.current)return;
    const account=userId; moreLock.current=true; setLoadingMore(true);
    try {
      const result=await posterAIRequest({action:browsing?'explore':'list',cursor});
      if(aiUser.current!==account)return;
      if(browsing){
        setExplore(current=>[...current,...(result.jobs||[]).filter(job=>!current.some(item=>item.id===job.id)).map(job=>({...job.form,id:job.id,artwork:{uri:job.imageUrl},community:true}))]);
        setExploreCursor(result.nextCursor||null); setExploreError('');
      }else{
        setMine(current=>[...current,...(result.jobs||[]).filter(job=>job.status==='complete'&&!current.some(item=>item.id===job.id)).map(aiPreview)]);
        setAiJobs(current=>[...current,...(result.jobs||[]).filter(job=>!current.some(item=>item.id===job.id))]);
        setMineCursor(result.nextCursor||null); setAiBudget(result.budget); setAiConnectionError('');
      }
    }catch(e){if(aiUser.current===account){if(browsing)setExploreError('No se han podido cargar más carteles. Vuelve a intentarlo.');else setAiConnectionError(e.message);}}
    finally{if(aiUser.current===account){moreLock.current=false;setLoadingMore(false);}}
  }
  async function pullToRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try { await refreshAI(); } finally { setRefreshing(false); }
  }
  useFocusEffect(useCallback(() => { if (generationEnabled) refreshAI(); }, [generationEnabled, refreshAI]));
  useEffect(() => {
    const listener=AppState.addEventListener('change',state=>{if(state==='active' && generationEnabled)refreshAI();});
    return ()=>listener.remove();
  },[generationEnabled,refreshAI]);
  useEffect(() => {
    if (!generationEnabled || !activeAIId) return;
    let cancelled = false;
    const account = userId;
    async function poll() {
      try {
        const { job, budget } = await posterAIRequest({ action: 'get', id: activeAIId });
        if (cancelled || aiUser.current !== account) return;
        setAiBudget(budget); setAiConnectionError('');
        if (job.status === 'running' || job.status === 'uncertain') { setAiJobs(current=>[job,...current.filter(item=>item.id!==job.id)]); timer = setTimeout(poll, job.status === 'uncertain' ? 10000 : 4000); return; }
        setActiveAIId(null); setAiWorking(false); aiLock.current = false;
        await refreshAI();
        if (job.status === 'complete') { notifyReady(job); }
        else setError(posterAIMessage(job.errorCode || 'poster_provider_uncertain'));
      } catch (e) {
        if (!cancelled) { setAiConnectionError(e.message); timer = setTimeout(poll, 8000); }
      }
    }
    let timer = setTimeout(poll, 1000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeAIId, userId, generationEnabled]);
  useEffect(()=>{
    if(!walletOpen || !canUseStore)return;
    let cancelled=false;
    setStoreError('');
    rcService.configureRevenueCat(userId).then(async ok=>{if(!ok)throw new Error('No se ha podido conectar con la tienda.');return rcService.getPosterCreditPackages();}).then(packages=>{if(!cancelled){setStorePackages(packages);if(!packages.length)setStoreError('Los paquetes todavía no están disponibles en Apple.');}}).catch(e=>{if(!cancelled)setStoreError(e.message);});
    return ()=>{cancelled=true;};
  },[walletOpen,userId,canUseStore]);
  async function syncStoreCredits(){
    const account=userId;
    const result=await posterAIRequest({action:'sync_store'});if(aiUser.current===account)setAiBudget(result.budget);
    return result;
  }
  async function buyStoreCredits(pack){
    if(buyingCredits || !canUseStore)return;
    setBuyingCredits(true);setStoreError('');
    try{
      const result=await rcService.purchasePackage(pack);
      if(result.userCancelled)return;
      if(!result.success)throw new Error('Apple no ha completado la compra.');
      const synced=await syncStoreCredits();
      if(liveCredits && (synced.budget.credits ?? 0) <= credits)setStoreError('Apple ha confirmado la compra. Los créditos pueden tardar unos instantes en aparecer. Comprueba tus créditos antes de volver a comprar.');
    }catch(e){setStoreError(e.message || 'No se ha podido confirmar la compra. Recupera las compras antes de repetir.');}
    finally{setBuyingCredits(false);}
  }
  function openCompleted(job) { setPreview(aiPreview(job)); setSaved(true); setAiInstruction(''); setError(''); setScreen('preview'); }
  function notifyReady(job) {
    queryClient.invalidateQueries({queryKey:['notifications']});
    queryClient.invalidateQueries({queryKey:['sessions']});
    queryClient.invalidateQueries({queryKey:['session']});
    Alert.alert('Tu cartel está listo', job.sessionPosterApplied ? 'Ya se ha generado, guardado en Mis carteles y aplicado a tu sesión.' : 'Guardado en Mis carteles. No se ha podido aplicar a la sesión; su cartel actual se conserva.', [{text:'Ver cartel',onPress:()=>openCompleted(job)}]);
  }
  useEffect(() => {
    if (!generationEnabled || !posterId) return;
    let cancelled=false;
    posterAIRequest({action:'get',id:String(posterId)}).then(({job})=>{if(!cancelled && job?.status==='complete')openCompleted(job);}).catch(e=>{if(!cancelled)setError(e.message);});
    return ()=>{cancelled=true;};
  },[posterId,userId,generationEnabled]);
  async function chooseAIPhoto(name, slot = name) {
    try {
      if (!aiPhotos[slot] && Object.keys(aiPhotos).length >= 3) { setError('Puedes añadir hasta tres fotos.'); return; }
      const photo = await pickPosterAIPhoto(name);
      if (photo) { setAiPhotos(current => ({ ...current, [slot]: photo })); setError(''); }
    } catch (e) { setError(e.message); }
  }
  async function startAI(parent = null) {
    if (aiLock.current || activeAIId) return;
    if (credits < (parent ? 0.5 : 1)) {setError('Créditos insuficientes. Puedes añadirlos desde tu saldo.');return;}
    if (!aiReady) { setError('Comprueba la conexión y el presupuesto antes de generar.'); return; }
    if (!parent && !hasFutureSession()) { setError('Selecciona una sesión futura.'); setScreen('select-session'); return; }
    if (parent && !aiInstruction.trim()) { setError('Escribe qué quieres cambiar del cartel.'); return; }
    const fields = parent ? parent.form : { ...form, style, format };
    const account = userId;
    if (!fields.djs.length || !fields.date || !fields.time || !fields.venue) { setError('Completa los DJs, la fecha, la hora y el sitio.'); return; }
    aiLock.current = true; setAiWorking(true); setError('');
    try {
      const { job, budget } = await posterAIRequest({ action: 'generate', id: randomUUID(), sessionId: parent ? parent.sessionId : sessionId, parentId: parent?.id || null,
        expectedPosterUrl: parent ? ((sessionQuery.data || []).find(item => item.id === parent.sessionId)?.poster_url || null) : expectedPosterUrl,
        form: fields, instruction: parent ? aiInstruction.trim() : '', photos: parent ? [] : Object.values(aiPhotos).map(photo => ({ name: photo.name, dataUrl: photo.dataUrl })) });
      if (aiUser.current !== account) return;
      setAiBudget(budget);
      setSheetStep(null);
      await refreshAI();
      if (aiUser.current !== account) return;
      if (job.status === 'complete') { notifyReady(job); setAiWorking(false); aiLock.current = false; }
      else if (job.status === 'running') setActiveAIId(job.id);
      else { setError(posterAIMessage(job.errorCode || 'poster_provider_uncertain')); setAiWorking(false); aiLock.current = false; }
    } catch (e) {
      if (aiUser.current !== account) return;
      setError(e.message); setAiWorking(false); aiLock.current = false;
      if (e.code === 'poster_session_poster_changed') { sessionQuery.refetch(); setSheetStep(1); }
      // A lost response may already have reserved a job. Discover it; never resend blindly.
      await refreshAI();
    }
  }


  function newPoster(nextStyle = 'Retrato Editorial') {
    if (!generationEnabled) {
      const sample = examples.find(item => item.style === nextStyle);
      if (sample) { setPreview(sample); setSaved(false); setError(''); setScreen('preview'); }
      return;
    }
    setAiPhotos({}); setAiInstruction(''); setForm(empty); setSource('session'); setSessionId(null); setExpectedPosterUrl(null); setError(''); setStyle(nextStyle); setFormat('Cartel'); setSaved(false); setSessionSearch(''); setPhotoRows([{id:'photo-0',name:''}]); setScreen('gallery'); setSheetStep(1);
    const requested = sessions.find(item => item.id === creationSessionId);
    if (requested) selectSession(requested, 'sheet');
  }
  useEffect(() => {
    if (!createForSession) return;
    setCreationSessionId(String(createForSession)); setScreen('gallery'); setTab('Plantilla'); setSheetStep(null);
    router.setParams({createForSession: undefined});
    sessionQuery.refetch();
  }, [createForSession]);
  function selectSession(session, destination = 'sheet') {
    const proceed = () => {
      setSessionId(session.id); setExpectedPosterUrl(session.posterUrl || null);
      setForm({title:session.title,djs:[...session.djs],date:session.date,time:session.time,venue:session.venue});
      setAiPhotos({}); setPhotoRows(session.djs.slice(0,3).map((name,index)=>({id:`photo-${index}`,name})));
      setCreationSessionId(null); setError('');
      if (destination === 'sheet') setSheetStep(2); else setScreen('design');
    };
    if (!session.posterUrl) { proceed(); return; }
    const message = 'Esta sesión ya tiene cartel. Si continúas, el nuevo se aplicará cuando termine de generarse. El cartel actual se conservará hasta entonces. ¿Quieres seguir igualmente?';
    if (Platform.OS === 'web') { if (window.confirm(message)) proceed(); }
    else Alert.alert('Esta sesión ya tiene cartel', message, [{text:'Cancelar',style:'cancel'},{text:'Seguir igualmente',onPress:proceed}]);
  }
  function openPicker(kind) {
    const value = new Date();
    if (kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      const [year, month, day] = form.date.split('-').map(Number); value.setFullYear(year, month - 1, day);
    }
    if (kind === 'time' && form.time) { const [hours, minutes] = form.time.split(':').map(Number); value.setHours(hours, minutes, 0, 0); }
    setPickerValue(value); setPicker(kind);
  }
  function commitPicker(value, kind = picker) {
    const pad = n => String(n).padStart(2, '0');
    const text = kind === 'date' ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` : `${pad(value.getHours())}:${pad(value.getMinutes())}`;
    setForm(current => ({ ...current, [kind]: text })); setError(''); setPicker(null);
  }
  function hasFutureSession() {
    const selected = (sessionQuery.data || []).find(item => item.id === sessionId && item.user_id === userId && !item.is_guest);
    return selected && selected.status !== 'cancelled' && sessionRange(selected).start.getTime() > Date.now();
  }
  function continueToDesign() {
    if (!hasFutureSession()) { setError('Selecciona una sesión futura para crear el cartel.'); setScreen('select-session'); return; }
    if (!form.djs.length || !form.date.trim() || !form.time.trim() || !form.venue.trim()) { setError('Añade al menos un DJ y completa la fecha, la hora y el sitio.'); return; }
    const parsed = new Date(`${form.date}T12:00:00`);
    const expected = /^\d{4}-\d{2}-\d{2}$/.test(form.date) && !Number.isNaN(parsed.getTime()) && parsed.getFullYear() === Number(form.date.slice(0, 4)) && parsed.getMonth() + 1 === Number(form.date.slice(5, 7)) && parsed.getDate() === Number(form.date.slice(8, 10));
    if (!expected || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(form.time)) { setError('Revisa la fecha y la hora de la sesión.'); return; }
    setError(''); setScreen('design');
  }
  function editPreview(nextScreen) {
    const { title, djs, date, time, venue } = preview;
    setForm({ title, djs: [...djs], date, time, venue });
    setSessionId(preview.sessionId); setStyle(preview.style); setFormat(preview.format);
    setSource('session'); setError(''); setScreen(nextScreen);
  }
  function generate() {
    if (Boolean(aiArtworks[style])) { startAI(); return; }
    if (!hasFutureSession()) { setError('Selecciona una sesión futura para crear el cartel.'); setScreen('select-session'); return; }
    if (!form.djs.length || !form.date.trim() || !form.time.trim() || !form.venue.trim() || (source === 'session' && !sessionId)) { setError('Elige al menos un DJ y completa fecha, hora y sitio. Si usas una sesión, selecciónala primero.'); return; }
    setPreview({ ...form, style, format, sessionId, id: `local-${Date.now()}`, own: true }); setSaved(false); setError(''); setScreen('preview');
  }

  const normalizeSearch = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  const visibleSessions = sessions.filter(item => normalizeSearch([item.title, item.venue, ...item.djs, item.date, formatRegionalDate(item.date, dateLocale)].join(' ')).includes(normalizeSearch(sessionSearch))).sort((a, b) => b.date.localeCompare(a.date));
  const gallery = (tab === 'Explorar' ? explore : mine).filter(item => filter === 'Todos' || item.style === filter);
  return <AppSafeAreaView edges={['top']} style={s.page}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={s.flex}>
    {screen === 'gallery' ? <PageHeader title="Carteles" subtitle="El estilo de tu próxima sesión." progress={headerProgress} showAccount
      action={generationEnabled ? <Pressable accessibilityRole="button" accessibilityLabel={aiBudget ? `Saldo: ${credits} créditos. Abrir saldo` : 'Consultando saldo de créditos'} onPress={()=>setWalletOpen(!walletOpen)} style={s.creditBadge}><Text style={s.creditBadgeNumber}>{aiBudget ? credits : '…'}</Text><Text style={s.creditBadgeLabel}>{aiBudget ? 'créditos' : 'Consultando…'}</Text></Pressable> : undefined} />
    : <View style={{flexDirection:'row',alignItems:'center'}}><View style={s.flex}><SessionFormHeader navigationBack title="Carteles" subtitle="" progress={headerProgress}
      onClose={() => { if(screen === 'preview') {setTab('Plantilla');setFilter('Todos');setScreen('gallery');return;} setScreen(screen === 'design' ? 'select-session' : screen === 'editor' ? (source === 'session' ? 'select-session' : 'choose') : screen === 'select-session' ? 'choose' : 'gallery'); }} /></View>{screen === 'preview' && preview?.aiJob && <Pressable accessibilityRole="button" accessibilityLabel="Compartir cartel" onPress={async()=>{try{await sharePosterAI(preview.aiJob);}catch(e){setError(e.message);}}} style={{padding:14,marginRight:10}}><Share2 size={24} color={colors.accent} /></Pressable>}</View>}
    <ScrollView ref={scrollRef} style={s.flex} onScroll={onScroll} onScrollBeginDrag={onScrollBeginDrag} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" refreshControl={screen === 'gallery' && generationEnabled ? <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined} contentContainerStyle={[s.content, screen === 'preview' && {paddingBottom:260}]}>
      {screen === 'home' && <><Text style={s.eyebrow}>LABORATORIO LOCAL</Text><Text style={s.title}>Tu próxima sesión merece un cartel.</Text><Text style={s.body}>Crea un cartel para tu próxima sesión.</Text><View style={s.card}><Text style={s.heading}>Sin escribir prompts</Text><Text style={s.body}>Elige una sesión o añade los datos. Nosotros prepararemos las instrucciones para la IA.</Text></View></>}
      {screen === 'gallery' && <>
        {!!activeAIId && <View style={s.card}><Text style={s.heading}>{aiJobs.some(job=>job.id===activeAIId && job.status==='uncertain') ? 'Comprobando tu cartel…' : 'Tu cartel se está generando…'}</Text><Text style={s.note}>Puedes seguir usando la app. Recuperaremos el resultado automáticamente; si no está disponible tras unos diez minutos, liberaremos tu crédito.</Text></View>}
        {!!error && <Text accessibilityRole="alert" style={s.fieldError}>{error}</Text>}
        <SegmentedTabs label="Carteles" options={['Plantilla', 'Explorar', 'Mis carteles'].map(name => ({value:name,label:name}))} value={tab} onChange={name => {setTab(name);setFilter('Todos');}} />

        {tab === 'Plantilla' && <>
          {!!creationSessionId && <View style={s.card}><Text style={s.heading}>Crear cartel para tu sesión</Text><Text style={s.note}>Elige una plantilla. Usaremos los datos de {sessions.find(item => item.id === creationSessionId)?.title || 'la sesión seleccionada'} y le aplicaremos el cartel al terminar.</Text></View>}
          <View style={s.grid}>{examples.map(item => <Pressable accessibilityRole="button" accessibilityLabel={`${generationEnabled ? 'Crear con' : 'Ver plantilla'} ${item.style}`} key={item.id} style={s.tile} onPress={() => newPoster(item.style)}><View style={s.tileArtwork}><Poster data={item} small /></View><View style={s.tileMeta}><Text style={s.tileTitle}>{item.style}</Text></View></Pressable>)}</View>
        </>}
        {!!aiConnectionError && <Text accessibilityRole="alert" style={s.fieldError}>{aiConnectionError}</Text>}
        {tab === 'Explorar' && !!exploreError && <Text accessibilityRole="alert" style={s.fieldError}>{exploreError}</Text>}
        {tab !== 'Plantilla' && <View style={tab === 'Mis carteles' ? s.mineGrid : s.grid}>{gallery.map(item => <Pressable accessibilityRole="button" accessibilityLabel={`Abrir cartel ${item.title}`} key={item.id} style={[s.tile, tab === 'Mis carteles' && s.mineTile]} onPress={() => { setPreview(item); setSaved(Boolean(item.own)); setScreen('preview'); }}><View style={s.tileArtwork}><Poster data={item} small /></View></Pressable>)}</View>}
        {tab !== 'Plantilla' && Boolean(tab === 'Explorar' ? exploreCursor : mineCursor) && <Button secondary disabled={loadingMore} onPress={loadMorePosters}>{loadingMore ? 'Cargando…' : 'Ver más carteles'}</Button>}
        {tab === 'Mis carteles' && aiJobs.filter(job => job.status !== 'complete').map(job => <View key={job.id} style={s.card}><Text style={s.heading}>{job.status === 'running' ? 'Generando cartel…' : job.status === 'uncertain' ? 'Comprobando tu cartel…' : 'No se ha podido crear el cartel'}</Text><Text style={s.note}>{job.form.title || 'Sesión'} · {job.status === 'running' ? 'Puedes cerrar la app. Recuperaremos el resultado cuando vuelvas.' : posterAIMessage(job.errorCode || 'poster_provider_uncertain')}</Text></View>)}
        {tab !== 'Plantilla' && !gallery.length && <View style={s.card}><Text style={[s.heading, s.centered]}>{!generationEnabled ? (accessLoading ? 'Cargando tus carteles…' : 'Próximamente') : tab === 'Explorar' ? 'Todavía no hay carteles creados' : 'Aún no tienes carteles'}</Text><Text style={[s.body, s.centered]}>{!generationEnabled ? 'Puedes descubrir las plantillas mientras preparamos la creación de carteles para tu cuenta.' : tab === 'Explorar' ? 'Aquí aparecen los carteles creados por todos los usuarios.' : 'Elige una plantilla para crear el primero.'}</Text></View>}
      </>}
      {screen === 'choose' && <>
        <View style={s.choiceIntro}><Text style={s.eyebrow}>NUEVO CARTEL</Text>
        <Text style={s.heading}>¿Cómo quieres crear tu cartel?</Text>
        <Text style={s.body}>En esta beta, crea tu cartel con los datos de una sesión futura de tu agenda.</Text></View>
        <View style={s.choiceOptions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Usar una sesión existente" accessibilityHint="Abre tu agenda para seleccionar una sesión" onPress={() => { setSource('session'); setSessionSearch(''); setError(''); setScreen('select-session'); }} style={s.choiceTouchTarget}><View style={s.choiceOption}>
          <View style={s.choiceHeading}><View style={s.choiceIcon}><CalendarDays size={24} color={colors.accent} /></View><Text style={[s.heading, s.flex]}>Usar una sesión existente</Text><ChevronRight size={20} color={colors.muted} /></View>
          <Text style={s.body}>Elige una sesión futura de tu agenda. Cargaremos los DJs, la fecha, la hora y el sitio para tu cartel.</Text>
          <Text style={s.note}>Podrás revisar los datos antes de continuar. El cartel generado se aplicará a tu sesión.</Text>
        </View></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Crear desde cero, próximamente" accessibilityState={{ disabled: true }} disabled style={s.choiceTouchTarget}><View style={[s.choiceOption, { opacity: 0.5 }]}>
          <View style={s.choiceHeading}><View style={s.choiceIcon}><FilePlus2 size={24} color={colors.muted} /></View><Text style={[s.heading, s.flex]}>Crear desde cero</Text></View>
          <Text style={s.photoActionText}>Próximamente</Text><Text style={s.body}>Más adelante podrás crear un cartel sin tener una sesión guardada.</Text>
        </View></Pressable>
        </View>
      </>}
      {screen === 'select-session' && <>
        {!!error && <Text accessibilityRole="alert" style={s.fieldError}>{error}</Text>}
        <View style={s.searchField}><Search size={20} color={colors.muted} /><TextInput accessibilityLabel="Buscar sesión, sitio o DJ" placeholder="Buscar sesión, sitio o DJ…" placeholderTextColor={colors.muted} value={sessionSearch} onChangeText={setSessionSearch} autoCorrect={false} style={s.searchInput} />{!!sessionSearch && <Pressable accessibilityRole="button" accessibilityLabel="Borrar búsqueda" hitSlop={10} onPress={() => setSessionSearch('')}><X size={18} color={colors.muted} /></Pressable>}</View>
        {sessionQuery.isLoading && <Text style={[s.note, s.centered]}>Cargando tus sesiones…</Text>}
        {sessionQuery.isError && <View style={s.card}><Text style={s.body}>No hemos podido cargar tus sesiones.</Text><Button secondary onPress={() => sessionQuery.refetch()}>Volver a intentarlo</Button></View>}
        {!sessionQuery.isLoading && !sessionQuery.isError && <>
          {!!visibleSessions.length && <Text style={s.note}>{visibleSessions.length === 1 ? '1 sesión disponible' : `${visibleSessions.length} sesiones disponibles`}</Text>}
          {visibleSessions.map(session => <SessionChoice key={session.id} session={session} dateLocale={dateLocale} onPress={() => selectSession(session, 'design')} />)}
          {!visibleSessions.length && <View style={s.card}><Text style={[s.heading, s.centered]}>{sessions.length ? 'Sin resultados' : 'No tienes sesiones futuras'}</Text><Text style={[s.body, s.centered]}>{sessions.length ? 'Prueba con otro nombre, sitio o DJ.' : 'Añade primero una sesión futura a tu agenda. Después podrás crear su cartel aquí.'}</Text>{sessions.length ? <Button secondary onPress={() => setSessionSearch('')}>Limpiar búsqueda</Button> : <Button secondary onPress={() => router.back()}>Volver a la agenda</Button>}</View>}
        </>}
      </>}
      {screen === 'editor' && <>
        <Text style={s.eyebrow}>NUEVO CARTEL</Text><Text style={s.title}>{source === 'session' ? 'Revisa los datos del cartel' : 'Añade los datos del cartel'}</Text><Text style={s.body}>{source === 'session' ? 'Hemos cargado los datos de tu sesión. Puedes ajustarlos solo para este cartel.' : 'Añade los datos de tu sesión. Los datos se aplicarán solo al cartel.'}</Text>

        <View style={s.card}><Text style={s.heading}>DJs del cartel</Text><Text style={s.note}>Se incluirán los nombres de los DJs de tu sesión.</Text>{form.djs.map(name => <View key={name} style={s.photoRow}><UserRound size={20} color={colors.accent} /><Text style={s.djName}>{name}</Text></View>)}</View>
        <View style={s.card}>
          <Text style={s.heading}>Datos de la sesión</Text>
          <View style={{ gap: 8 }}><Text style={s.label}>Nombre de la sesión (opcional)</Text><TextInput accessibilityLabel="Nombre de la sesión" value={form.title} onChangeText={title => setForm(current => ({ ...current, title }))} placeholder="Ej. Midnight Session" placeholderTextColor={colors.muted} maxLength={60} style={s.input} /></View>
          {['date', 'time'].map(kind => <View key={kind} style={{ gap: 8 }}><Text style={s.label}>{kind === 'date' ? 'Fecha' : 'Hora'}</Text>{Platform.OS === 'web' ? <TextInput accessibilityLabel={kind === 'date' ? 'Fecha AAAA-MM-DD' : 'Hora HH:MM'} placeholder={kind === 'date' ? 'AAAA-MM-DD' : 'HH:MM'} value={form[kind]} onChangeText={value => setForm(current => ({ ...current, [kind]: value }))} style={s.input} /> : <Pressable accessibilityRole="button" accessibilityLabel={kind === 'date' ? 'Elegir fecha' : 'Elegir hora'} onPress={() => openPicker(kind)} style={s.pickerField}>{kind === 'date' ? <CalendarDays size={20} color={colors.accent} /> : <Clock3 size={20} color={colors.accent} />}<Text style={[s.body, s.flex]}>{form[kind] ? (kind === 'date' ? formatRegionalDate(form.date, dateLocale) : form.time.slice(0, 5)) : kind === 'date' ? 'Elegir fecha' : 'Elegir hora'}</Text><ChevronRight size={18} color={colors.muted} /></Pressable>}</View>)}
          <View style={{ gap: 8 }}><Text style={s.label}>Sitio</Text><TextInput accessibilityLabel="Sitio del cartel" value={form.venue} onChangeText={venue => { setForm(current => ({ ...current, venue })); setError(''); }} placeholder="Sala, local o lugar del evento" placeholderTextColor={colors.muted} maxLength={100} style={s.input} /></View>
          <Text style={s.note}>Los cambios de estos datos solo se aplican al cartel.</Text>
        </View>
        {!!error && <Text accessibilityRole="alert" style={s.fieldError}>{error}</Text>}
        <Button onPress={continueToDesign}>Continuar</Button>
      </>}
      {screen === 'design' && <>
        <View style={s.choiceIntro}><Text style={s.heading}>Estilo visual</Text><Text style={s.note}>Elige el ambiente que mejor encaje con tu sesión.</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.styleCarousel}>{activeStyles.map(name => <Pressable key={name} accessibilityRole="button" accessibilityLabel={`Estilo ${name}`} accessibilityState={{ selected: style === name }} onPress={() => setStyle(name)} style={s.styleTile}>
          <View style={[s.styleArtwork, style === name && s.selectedStyle]}>{aiArtworks[name] ? <Image source={templateThumbnails[name] || aiArtworks[name]} accessibilityLabel={`Muestra aprobada de ${name}`}  resizeMode="contain" style={{ position: 'absolute', top: 5, right: 5, bottom: 5, left: 5, width: undefined, height: undefined }} /> : <Poster data={{ ...form, date: formatRegionalDate(form.date, dateLocale), style: name, format: 'Cartel' }} small />}{style === name && <View style={s.selectionBadge}><Check size={16} color={colors.onAccent} /></View>}</View>
          <View style={s.styleCaption}><Text style={s.sessionTitle}>{name}</Text><Text style={s.note}>{{ Pulso: 'Coral, ritmo geométrico y tipografía minimalista', 'Verde Indie': 'Fotos en verde, letras rojas y papel claro', 'Cabina Analógica': 'Negro y naranja, collage fotográfico y textura analógica', 'Collage Sereno': 'Collage fotográfico, papel crema y acentos geométricos', 'Vinilo a Mano': 'Tipografía editorial elegante y dibujos rojos de trazo fino', 'Offset Radical': 'Retrato en semitono, capas cian y magenta y gesto rojo', 'Coral Manifesto': 'Coral, letras gigantes y recortes en semitono', 'Impacto Amarillo': 'Retrato urbano, marco amarillo y letras contundentes', 'Duotono Editorial': 'Retrato azul y tipografía coral', 'Pop Club': 'Color, flash y energía de fiesta', 'Bauhaus Sonoro': 'Geometría musical y tipografía contundente', 'Jardín Surreal': 'Flores escultóricas y atmósfera surreal', 'Jazz de Autor': 'Ilustración, tinta y ambiente nocturno', 'Disco Collage': 'Color, vinilo y collage setentero', 'Rave Industrial': 'Texturas, contraste y verde fósforo', Headliner: 'Retrato y nombre protagonista', 'Retrato Editorial': 'Fotografía y paneles · Muestra', Remember: 'Dance, movimiento y nostalgia 90/00', 'Premium Night': 'Luz cálida y elegancia nocturna', 'Urban Chrome': 'Retrato, azul eléctrico y metal', 'Summer Club': 'Sol, piscina y color de verano' }[name]}</Text></View>
        </Pressable>)}</ScrollView>
        {Boolean(aiArtworks[style]) && <View style={s.card}><Text style={s.heading}>Fotos de los DJs</Text><Text style={s.note}>Opcionales · Hasta tres fotos. Sin foto, usaremos una composición gráfica. Se usarán para crear el cartel.</Text>
          {form.djs.map(name => <View key={name} style={s.photoRow}>{aiPhotos[name] ? <Image source={{ uri: aiPhotos[name].uri }} style={s.avatar} /> : <UserRound size={26} color={colors.accent} />}<View style={s.flex}><Text style={s.djName}>{name}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Añadir o cambiar foto de ${name}`} disabled={aiWorking || !!activeAIId} onPress={() => chooseAIPhoto(name)} style={s.photoAction}><Camera size={17} color={colors.accent} /><Text style={s.photoActionText}>{aiPhotos[name] ? 'Cambiar foto' : 'Añadir foto'}</Text></Pressable>{aiPhotos[name] && <Pressable accessibilityRole="button" accessibilityLabel={`Quitar foto de ${name}`} disabled={aiWorking || !!activeAIId} onPress={() => setAiPhotos(current => { const next = { ...current }; delete next[name]; return next; })}><Text style={s.link}>Quitar foto</Text></Pressable>}</View></View>)}
        </View>}
        <View style={s.choiceIntro}><Text style={s.heading}>¿Dónde vas a compartirlo?</Text><Text style={s.note}>Escoge el formato de tu cartel.</Text></View>
        <View style={s.formatOptions}>{[
          { name: 'Cartel', ratio: '2:3', width: 26, height: 39, description: 'Vertical' },
          { name: 'Historia', ratio: '9:16', width: 23, height: 41, description: 'Stories' },
          { name: 'Cuadrado', ratio: '1:1', width: 34, height: 34, description: 'Publicaciones' },
        ].map(item => <Pressable key={item.name} accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.ratio}, ${item.description}`} accessibilityState={{ selected: format === item.name }} onPress={() => setFormat(item.name)} style={[s.formatOption, format === item.name && s.selected]}><View style={s.formatIconArea}><View style={{ width: item.width, height: item.height, borderRadius: 4, borderWidth: 2, borderColor: format === item.name ? colors.accent : colors.muted }} /></View><Text style={[s.chipText, format === item.name && s.selectedText]}>{item.name}</Text><Text style={s.note}>{item.ratio}</Text></Pressable>)}</View>

        <View style={s.notice}><Text style={s.body}>{Boolean(aiArtworks[style]) ? 'Generación de carteles con IA' : 'Vista previa local · 0 €'}</Text><Text style={s.note}>{Boolean(aiArtworks[style]) ? !aiBudget?.configured ? 'Falta configurar la clave del servidor.' : !aiBudget?.enabled ? 'La generación no está disponible en este momento.' : 'Crear un cartel consume 1 crédito; cada modificación, 0,5 créditos. Consulta tu saldo en Tus créditos.' : 'Composición local sin IA.'}</Text></View>
        {Boolean(aiArtworks[style]) && <><Text style={s.note}>La IA puede cometer errores en textos y rostros. Revisa el cartel antes de compartirlo.</Text>{!!aiConnectionError && <Text accessibilityRole="alert" style={s.fieldError}>{aiConnectionError}</Text>}<Button secondary disabled={aiWorking} onPress={refreshAI}>Comprobar conexión y presupuesto</Button></>}
        {!!error && <Text accessibilityRole="alert" style={s.fieldError}>{error}</Text>}
        <Button disabled={aiWorking || !!activeAIId || (Boolean(aiArtworks[style]) && !aiReady)} onPress={generate}>{aiWorking || activeAIId ? 'Generando tu cartel…' : Boolean(aiArtworks[style]) ? 'Generar mi cartel con IA' : 'Crear vista previa'}</Button>
      </>}
      {screen === 'preview' && preview && <>
        <View style={s.previewFrame}><Poster data={preview} /></View>
        {preview.own ? <>
          {!preview.aiJob && generationEnabled && <View style={s.card}><Text style={s.heading}>¿Quieres ajustar algo?</Text><Button secondary onPress={() => setScreen('select-session')}>Elegir otra sesión</Button><Button secondary onPress={() => editPreview('design')}>Cambiar estilo o formato</Button></View>}
          {!preview.aiJob && generationEnabled && <Button disabled={saved} onPress={() => { setMine(current => [preview, ...current.filter(item => item.id !== preview.id)]); setSaved(true); setTab('Plantilla'); setFilter('Todos'); setScreen('gallery'); }}>{saved ? 'Guardado en Mis carteles' : 'Guardar en Mis carteles'}</Button>}
          {!preview.aiJob && generationEnabled && <Text style={[s.note, s.centered]}>Se guarda temporalmente en Mis carteles. Se perderá al cerrar o recargar la app.</Text>}
        </> : generationEnabled ? <Button onPress={() => newPoster(preview.style)}>Crear con este estilo</Button> : null}
        {!preview.aiJob && !preview.community && <View style={s.notice}><Text style={s.note}>{generationEnabled ? 'Muestra de estilo. Para generar con tus datos, elige uno de los estilos de IA en tu sesión.' : 'Muestra de plantilla. La creación de carteles estará disponible próximamente para tu cuenta.'}</Text></View>}
      </>}

    </ScrollView>
    {screen === 'preview' && preview?.own && preview?.aiJob && <View style={[s.floatingEdit, {bottom:tabBarHeight,paddingBottom:12}]}>
      {!!error && <Text accessibilityRole="alert" style={s.fieldError}>{error}</Text>}
      {(aiWorking || !!activeAIId) && <Text style={s.note}>Aplicando cambios…</Text>}
      <Text style={s.note}>Cada cambio: 0,5 créditos · Saldo: {credits}</Text>
      <View style={s.editComposer}><TextInput accessibilityLabel="Qué quieres cambiar del cartel" placeholder="Pide un cambio… (0,5 créditos)" placeholderTextColor={colors.muted} value={aiInstruction} onChangeText={setAiInstruction} multiline maxLength={600} editable={!aiWorking && !activeAIId} style={[s.editComposerInput,s.flex]} /><Pressable accessibilityRole="button" accessibilityLabel="Aplicar cambios al cartel" disabled={!aiReady || !aiInstruction.trim() || aiWorking || !!activeAIId} onPress={()=>startAI(preview.aiJob)} style={[s.composerSend,(!aiReady || !aiInstruction.trim() || aiWorking || !!activeAIId) && {opacity:0.4}]}><ArrowUp size={22} color={colors.onAccent} /></Pressable></View>
    </View>}
    </View></KeyboardAvoidingView>
    <Modal transparent visible={walletOpen} animationType="slide" onRequestClose={()=>!buyingCredits && setWalletOpen(false)}>
      <View style={s.walletOverlay}><Pressable accessibilityRole="button" accessibilityLabel="Cerrar saldo" style={s.flex} onPress={()=>!buyingCredits && setWalletOpen(false)} />
        <View accessibilityViewIsModal style={[s.walletSheet,{paddingBottom:Math.max(24,insets.bottom+12)}]}>
          <View style={s.sheetHandle} />
          <View style={s.choiceHeading}><Text style={[s.heading,s.flex]}>Tus créditos</Text><Pressable accessibilityRole="button" accessibilityLabel="Cerrar saldo" disabled={buyingCredits} onPress={()=>setWalletOpen(false)} hitSlop={12}><X size={22} color={colors.muted} /></Pressable></View>
          <ScrollView contentContainerStyle={{gap:20}}>
            <View style={{gap:6}}><Text style={{color:colors.accent,fontSize:36,fontWeight:'800'}}>{aiBudget ? credits : '…'}<Text style={{fontSize:15,fontWeight:'500'}}>{aiBudget ? ' créditos disponibles' : ' Consultando saldo…'}</Text></Text><Text style={s.note}>Crear cartel: 1 crédito · Cada cambio: 0,5</Text></View>
            <Text style={s.note}>{liveCredits ? aiBudget?.paidCredits ? 'Tus créditos comprados no caducan. Si una compra tarda en aparecer, comprueba el saldo antes de repetirla.' : 'Usa tus créditos para crear carteles y modificar sus detalles.' : canUseStore ? 'Pruebas de Apple · Usa una cuenta Sandbox o TestFlight. Solo se acreditan transacciones de prueba.' : 'Vista previa · Compras simuladas, sin cobros.'}</Text>
            {canUseStore && storePackages.map(pack=><Pressable key={pack.identifier} accessibilityRole="button" accessibilityLabel={`Comprar ${pack.product.identifier.endsWith('12') ? 12 : 5} créditos con Apple`} disabled={buyingCredits} onPress={()=>buyStoreCredits(pack)} style={s.walletPack}><View style={s.flex}><Text style={s.heading}>{pack.product.identifier.endsWith('12') ? 12 : 5} créditos</Text><Text style={s.note}>{pack.product.priceString}</Text></View><Text style={s.photoActionText}>{buyingCredits ? 'Procesando…' : liveCredits ? 'Comprar' : 'Probar con Apple'}</Text></Pressable>)}
            {nativeStoreSupported && (canUseStore || (liveCredits && Boolean(aiBudget?.paidCredits))) && <Button secondary disabled={buyingCredits} onPress={async()=>{setBuyingCredits(true);setStoreError('');try{await syncStoreCredits();}catch(e){setStoreError(e.message);}finally{setBuyingCredits(false);}}}>{liveCredits ? 'Comprobar créditos comprados' : 'Recuperar compras de prueba'}</Button>}
            {liveCredits && !canUseStore && <Text style={s.note}>{!aiBudget?.purchasesEnabled ? 'Próximamente podrás comprar más créditos desde la app.' : 'Para comprar créditos, abre la versión de DJ Planner instalada desde App Store o TestFlight.'}</Text>}
            {liveCredits && aiBudget?.promotionAvailable && <Text style={s.note}>Tus créditos de bienvenida se añaden automáticamente: 3 para Gratis y 5 para Pro, incluido el período de prueba, una vez por cuenta. Si pasas a Pro, se añaden los 2 créditos de diferencia mientras la campaña esté disponible.</Text>}
            {!!storeError && <Text accessibilityRole="alert" style={s.fieldError}>{storeError}</Text>}
            {!liveCredits && !canUseStore && [{id:'starter',credits:5,price:'5,99 €'},{id:'studio',credits:12,price:'12,99 €'}].map(pack=><Pressable key={pack.id} accessibilityRole="button" accessibilityLabel={`Simular ${pack.credits} créditos, sin cobro`} disabled={buyingCredits} onPress={async()=>{setBuyingCredits(true);setError('');try{const result=await posterAIRequest({action:'test_purchase',id:randomUUID(),package:pack.id});setAiBudget(result.budget);}catch(e){setError(e.message);}finally{setBuyingCredits(false);}}} style={[s.walletPack,buyingCredits && {opacity:0.5}]}><View style={s.flex}><Text style={s.heading}>{pack.credits} créditos</Text><Text style={s.note}>Precio provisional · {pack.price}</Text></View><Text style={s.photoActionText}>{buyingCredits ? 'Añadiendo…' : 'Simular'}</Text><ChevronRight size={18} color={colors.accent} /></Pressable>)}
            {!!error && <Text accessibilityRole="alert" style={s.fieldError}>{error}</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
    <Modal transparent visible={sheetStep !== null} animationType="slide" onRequestClose={() => !aiWorking && setSheetStep(null)}>
      <KeyboardAvoidingView style={s.creationOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.flex} accessibilityLabel="Cerrar creación" accessibilityRole="button" onPress={() => !aiWorking && setSheetStep(null)} />
        <View accessibilityViewIsModal style={[s.creationSheet, {paddingBottom:Math.max(20,insets.bottom)}]}>
          <View style={s.sheetHandle} />
          <View style={s.choiceHeading}><Image source={aiArtworks[style]} resizeMode="contain" accessibilityLabel={`Plantilla seleccionada: ${style}`} style={s.sheetThumbnail} /><Text style={[s.heading,s.flex]}>{style}</Text><Pressable accessibilityRole="button" accessibilityLabel="Cerrar" disabled={aiWorking} onPress={() => setSheetStep(null)}><X size={24} color={colors.fg} /></Pressable></View>
          <Text style={s.note}>Paso {sheetStep} de 3 · {sheetStep === 1 ? 'Sesión' : sheetStep === 2 ? 'Fotos' : 'Formato'}</Text>
          <View style={s.stepTrack}>{[1,2,3].map(n => <View key={n} style={[s.stepSegment,{backgroundColor:n <= sheetStep ? colors.accent : colors.border}]} />)}</View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:24,paddingTop:8,paddingBottom:28}}>
            {!!error && <Text accessibilityRole="alert" style={s.fieldError}>{error}</Text>}
            {sheetStep === 1 && <>
              <Text style={s.heading}>Elige tu sesión</Text><Text style={s.note}>Beta · Elige una sesión futura de tu agenda.</Text>
              <TextInput accessibilityLabel="Buscar sesión" placeholder="Buscar sesión…" placeholderTextColor={colors.muted} style={s.input} value={sessionSearch} onChangeText={setSessionSearch} />
              {sessionQuery.isLoading && <Text style={s.note}>Cargando sesiones…</Text>}
              {sessionQuery.isError && <Button secondary onPress={() => sessionQuery.refetch()}>Reintentar</Button>}
              {visibleSessions.map(session => <SessionChoice key={session.id} session={session} dateLocale={dateLocale} onPress={() => selectSession(session)} />)}
              {!sessionQuery.isLoading && !visibleSessions.length && <Text style={s.body}>No hay sesiones futuras disponibles. Guarda primero una en tu agenda.</Text>}
            </>}
            {sheetStep === 2 && <>
              <Text style={s.heading}>¿Quieres añadir fotos?</Text><Text style={s.note}>Hasta 3 fotos · Opcional. Se usarán para crear el cartel.</Text>
              {photoRows.map((row,index) => {const photo=aiPhotos[row.id];return <View key={row.id} style={{gap:10}}>
                <Text style={s.heading}>{row.name || form.djs[0]}</Text>
                <View style={s.choiceHeading}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Subir foto de ${row.name || form.djs[0]}`} onPress={() => chooseAIPhoto(row.name || form.djs[0],row.id)} style={[s.photoUpload,s.flex]}>
                    {photo ? <Image source={{uri:photo.uri}} style={s.avatar} /> : <Camera size={24} color={colors.accent} />}
                    <Text style={[s.photoActionText,s.flex]}>{photo ? 'Cambiar foto' : 'Subir foto'}</Text>
                  </Pressable>
                  {index > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Eliminar foto de ${row.name}`} onPress={() => {setPhotoRows(current=>current.filter(item=>item.id!==row.id));setAiPhotos(current=>{const next={...current};delete next[row.id];return next;});}} style={s.photoCircle}><Minus size={20} color={colors.accent} /></Pressable>}
                  {photoRows.length < 3 && <Pressable accessibilityRole="button" accessibilityLabel="Añadir foto" onPress={() => setPhotoRows(current=>[...current,{id:randomUUID(),name:row.name || form.djs[0]}])} style={s.photoCircle}><Plus size={20} color={colors.accent} /></Pressable>}
                </View>
                {photo && <Pressable accessibilityRole="button" accessibilityLabel={`Quitar imagen de ${row.name}`} onPress={() => setAiPhotos(current=>{const next={...current};delete next[row.id];return next;})}><Text style={s.link}>Quitar imagen</Text></Pressable>}
              </View>;})}
            </>}
            {sheetStep === 3 && <>
              <Text style={s.heading}>Elige el formato</Text>
              <View style={s.formatOptions}>{[{name:'Cartel',ratio:'2:3'},{name:'Historia',ratio:'9:16'},{name:'Cuadrado',ratio:'1:1'}].map(item => <Pressable key={item.name} accessibilityRole="button" accessibilityState={{selected:format===item.name}} onPress={() => setFormat(item.name)} style={[s.formatOption,format===item.name && s.selected]}><Text style={s.chipText}>{item.name}</Text><Text style={s.note}>{item.ratio}</Text></Pressable>)}</View>
              <Text style={s.note}>{form.title} · {form.djs.join(' · ')} · {Object.keys(aiPhotos).length} fotos</Text>
              <Text style={s.note}>El cartel creado aparecerá en Explorar y en Mis carteles.</Text>
              <Text style={s.note}>Generar: 1 crédito · Saldo: {credits}</Text>
              {!!aiConnectionError && <Text style={s.fieldError}>{aiConnectionError}</Text>}
              {!aiReady && <Button secondary onPress={refreshAI}>Comprobar presupuesto</Button>}
            </>}
          </ScrollView>
          <View style={s.choiceHeading}>{sheetStep > 1 && <View style={s.flex}><Button secondary disabled={aiWorking || !!activeAIId} onPress={() => setSheetStep(sheetStep-1)}>Atrás</Button></View>}{sheetStep === 2 && <View style={s.flex}><Button onPress={() => setSheetStep(3)}>Continuar</Button></View>}{sheetStep === 3 && <View style={s.flex}><Button disabled={!aiReady || aiWorking || !!activeAIId} onPress={() => startAI()}>{aiWorking || activeAIId ? 'Generando…' : 'Generar cartel · 1 crédito'}</Button></View>}</View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    {picker && Platform.OS === 'android' && <DateTimePicker value={pickerValue} mode={picker} is24Hour display="default" onChange={(event, value) => { if (event.type === 'set' && value) commitPicker(value); else setPicker(null); }} />}
    <Modal transparent visible={!!picker && Platform.OS === 'ios'} animationType="fade" onRequestClose={() => setPicker(null)}><View style={s.pickerOverlay}><View style={s.pickerCard}><Text style={s.heading}>{picker === 'date' ? 'Elige la fecha' : 'Elige la hora'}</Text>{picker && Platform.OS === 'ios' && <DateTimePicker value={pickerValue} mode={picker} is24Hour display="spinner" themeVariant={colors.dark ? 'dark' : 'light'} locale={dateLocale} onChange={(_, value) => { if (value) setPickerValue(value); }} />}<Button onPress={() => commitPicker(pickerValue)}>Confirmar</Button><Button secondary onPress={() => setPicker(null)}>Cancelar</Button></View></View></Modal>
    <Modal transparent visible={menu} animationType="slide" onRequestClose={() => setMenu(false)}><View style={s.modal}><Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú" style={s.flex} onPress={() => setMenu(false)} /><View accessibilityViewIsModal style={s.sheet}><View style={s.header}><Text style={s.heading}>Crear</Text><Pressable accessibilityRole="button" onPress={() => setMenu(false)}><Text style={s.back}>Cerrar</Text></Pressable></View><Button secondary onPress={() => { setMenu(false); setScreen('gallery'); }}>▧  Carteles</Button><Text style={s.note}>Vista previa privada</Text></View></View></Modal>
  </AppSafeAreaView>;
}
const makeStyles = (c) => StyleSheet.create({
  creditBadge:{minHeight:44,paddingHorizontal:2,flexDirection:'row',gap:4,alignItems:'center',justifyContent:'center'},creditBadgeNumber:{color:c.accent,fontSize:14,fontWeight:'800'},creditBadgeLabel:{color:c.muted,fontSize:11},walletOverlay:{flex:1,backgroundColor:'#0008',justifyContent:'flex-end'},walletSheet:{maxHeight:'72%',backgroundColor:c.bg,padding:24,gap:22,borderTopLeftRadius:28,borderTopRightRadius:28},walletPack:{flexDirection:'row',alignItems:'center',gap:10,padding:18,borderWidth:1,borderColor:c.border,borderRadius:18,backgroundColor:c.card},
  floatingEdit:{position:'absolute',left:16,right:16,bottom:0,gap:8},editComposer:{flexDirection:'row',alignItems:'flex-end',gap:10,padding:10,borderRadius:26,backgroundColor:c.card,borderWidth:1,borderColor:c.border,shadowColor:'#000',shadowOffset:{width:0,height:4},shadowOpacity:0.18,shadowRadius:12,elevation:8},editComposerInput:{color:c.fg,fontSize:16,minHeight:48,maxHeight:130,paddingHorizontal:12,paddingVertical:14},
  photoUpload:{flexDirection:'row',alignItems:'center',gap:12,minHeight:64,padding:12,borderRadius:16,backgroundColor:c.card,borderWidth:1,borderColor:c.border},photoCircle:{width:44,height:44,borderRadius:22,backgroundColor:c.tint,alignItems:'center',justifyContent:'center'},
  sheetThumbnail: {width:48,height:72,borderRadius:6,backgroundColor:c.card},
  composer: {flexDirection:'row',alignItems:'center',gap:10,padding:12,borderTopWidth:1,borderColor:c.border,backgroundColor:c.bg}, composerSend:{width:48,height:48,borderRadius:24,backgroundColor:c.accent,alignItems:'center',justifyContent:'center'}, creationOverlay:{flex:1,backgroundColor:'#0008',justifyContent:'flex-end'}, creationSheet:{height:'95%',backgroundColor:c.bg,borderTopLeftRadius:28,borderTopRightRadius:28,paddingHorizontal:24,paddingTop:14,gap:20}, sheetHandle:{width:40,height:4,borderRadius:2,backgroundColor:c.muted,alignSelf:'center'}, stepTrack:{flexDirection:'row',gap:6},stepSegment:{flex:1,height:3,borderRadius:2},
  editData: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }, styleCarousel: { gap: 12, paddingVertical: 2, alignItems: 'flex-start' }, styleTile: { width: 168, gap: 8 }, styleArtwork: { width: '100%', aspectRatio: 2 / 3, borderWidth: 2, borderColor: 'transparent', borderRadius: 18, padding: 3, overflow: 'hidden' }, selectedStyle: { borderColor: c.accent }, selectionBadge: { position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent }, styleCaption: { paddingHorizontal: 5, paddingBottom: 8 }, formatOptions: { flexDirection: 'row', gap: 10 }, formatOption: { flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4, gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 18 }, formatIconArea: { height: 44, justifyContent: 'center', alignItems: 'center' },
  pickerField: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 52, borderRadius: 16, backgroundColor: c.field }, pickerOverlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 }, pickerCard: { backgroundColor: c.card, borderRadius: 24, padding: 20, gap: 16 },
  djCard: { padding: 18, borderRadius: 20, backgroundColor: c.card, gap: 16 }, djAvatar: { width: 64, height: 64, borderRadius: 20 }, djName: { color: c.cardText, fontSize: 17, fontWeight: '800', marginBottom: 5 }, djRemove: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, djActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, photoAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.tint, paddingHorizontal: 14, borderRadius: 12 }, photoActionText: { color: c.accent, fontSize: 13, fontWeight: '700' }, fieldError: { color: c.dark ? '#ffb4b4' : '#b42318', fontSize: 13 },
  searchField: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 16, paddingHorizontal: 16, minHeight: 52 }, searchInput: { flex: 1, color: c.fg, fontSize: 16, paddingVertical: 14 }, sessionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, padding: 20, borderRadius: 20 }, sessionTitle: { color: c.cardText, fontSize: 18, fontWeight: '800', marginBottom: 6 }, sessionDetail: { color: c.cardText, fontSize: 14, lineHeight: 21, marginBottom: 4 },
  previewFrame: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: c.border },
  titleBeta: { color: c.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  choiceTouchTarget: { width: '100%' }, choiceOptions: { gap: 18 },
  choiceIntro: { gap: 10 },
  choiceOption: { padding: 20, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, gap: 12 },
  choiceHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, choiceIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' }, centered: { textAlign: 'center' }, flex: { flex: 1 }, page: { flex: 1, backgroundColor: c.bg }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 }, headerTitle: { color: c.fg, fontWeight: '700', fontSize: 20 }, back: { color: c.accent, fontSize: 14, fontWeight: '600' }, badge: { color: '#c6f798', borderColor: '#333339', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20, fontSize: 11 },
  content: { width:'100%',maxWidth:940,alignSelf:'center',padding: 20, paddingTop: 0, paddingBottom: 130, gap: 20 }, eyebrow: { color: c.accent, fontSize: 11, letterSpacing: 2, fontWeight: '700' }, title: { color: c.fg, fontSize: 32, lineHeight: 39, fontWeight: '800' }, body: { color: c.fg, fontSize: 15, lineHeight: 23 }, note: { color: c.muted, fontSize: 12, lineHeight: 18 }, heading: { color: c.fg, fontSize: 18, fontWeight: '700' }, card: { backgroundColor: c.card, borderRadius: 20, padding: 18, gap: 16 },
  button: { backgroundColor: c.accent, padding: 16, minHeight: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: c.onAccent, fontSize: 15, fontWeight: '700', textAlign: 'center' }, secondary: { backgroundColor: c.tint }, secondaryText: { color: c.accent },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 11, paddingHorizontal: 16, borderWidth: 1, borderColor: c.border, borderRadius: 14, minHeight: 44, backgroundColor: c.card, justifyContent: 'center' },
  selected: { borderColor: c.accent, backgroundColor: c.tint }, selectedText: { color: c.accent },
  chipText: { color: c.fg, fontSize: 13, fontWeight: '600' },
  mineGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }, mineTile: { width: '31.5%', borderRadius: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, tile: { width: '48%', backgroundColor: c.card, borderRadius: 18, overflow: 'hidden' }, tileArtwork: { overflow: 'hidden' }, tileMeta: { padding: 12, gap: 5 }, tileTitle: { color: c.fg, fontSize: 13, fontWeight: '700' },
  input: { color: c.fg, backgroundColor: c.field, borderWidth: 1, borderColor: '#393942', borderRadius: 12, padding: 13, fontSize: 16, minHeight: 48 }, label: { color: c.muted, fontSize: 14 }, session: { padding: 14, gap: 6, borderRadius: 12, borderWidth: 1, borderColor: c.border }, photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 52, height: 52, borderRadius: 26 }, avatarEmpty: { backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' }, link: { color: c.accent, fontSize: 13, paddingVertical: 8 }, notice: { borderLeftWidth: 3, borderColor: '#b99afc', paddingLeft: 15, gap: 8 },
  poster: { width: '100%', overflow: 'hidden', justifyContent: 'space-between' }, orbit: { position: 'absolute', width: 350, height: 350, borderRadius: 175, borderWidth: 42, left: -110, top: 65, transform: [{ scaleX: 0.7 }, { rotate: '-30deg' }] }, posterCenter: { flex: 1, justifyContent: 'center', gap: 12 }, portraits: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 12 },
  fab: { position: 'absolute', bottom: 35, right: 24, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, borderWidth: 1, borderColor: c.accent, elevation: 5 }, plus: { color: c.fg, fontSize: 39, lineHeight: 45 }, modal: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0009' }, sheet: { backgroundColor: c.card, padding: 22, paddingBottom: 44, borderTopLeftRadius: 25, borderTopRightRadius: 25, gap: 20 },
});
