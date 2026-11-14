import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCommunityColors } from '../components/community/communityColors';
import { SafeAreaView as AppSafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { SvgXml } from 'react-native-svg';
import { templates, templateNames, getTemplate, posterSvg } from './templates';

const artists = ['ALEX NOVA', 'LUNA', 'MARCO BEAT', 'SARA K'];
const sessions = [
  { id: 's1', title: 'MIDNIGHT SESSION', djs: ['ALEX NOVA', 'LUNA'], date: '24 OCT 2026', time: '23:30', venue: 'SALA ÓRBITA · MADRID' },
  { id: 's2', title: 'SUNDAY GROOVE', djs: ['MARCO BEAT'], date: '25 OCT 2026', time: '18:00', venue: 'TERRAZA SOL · VALENCIA' },
];
const examples = templates.map((template, i) => ({
  ...sessions[0], id: `template-${i}`, style: template.name, format: 'Cartel',
  author: 'DJ Planner', photos: {},
}));
const empty = { title: '', djs: [], date: '', time: '', venue: '' };
function Button({ children, onPress, secondary, disabled }) {
  const s = makeStyles(useCommunityColors());
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}><Text style={[s.buttonText, secondary && { color: '#e0d0ff' }]}>{children}</Text></Pressable>;
}
function Chip({ label, selected, onPress }) {
  const s = makeStyles(useCommunityColors());
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.chip, selected && s.selected]}><Text style={s.chipText}>{label}</Text></Pressable>;
}
function Poster({ data }) {
  const aspectRatio = data.format === 'Historia' ? 600 / 1067 : data.format === 'Cuadrado' ? 1 : 2 / 3;
  return <View accessible accessibilityRole="image" accessibilityLabel={`${data.style}: ${data.title || 'LIVE SESSION'}`} style={{ width: '100%', aspectRatio, overflow: 'hidden' }}>
    <SvgXml xml={posterSvg(data)} width="100%" height="100%" />
  </View>;
}
export default function App() {
  const s = makeStyles(useCommunityColors());
  const [screen, setScreen] = useState('gallery');
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState('Explorar');
  const [filter, setFilter] = useState('Todos');
  const [source, setSource] = useState('manual');
  const [sessionId, setSessionId] = useState(null);
  const [form, setForm] = useState(empty);
  const [customDj, setCustomDj] = useState('');
  const [photos, setPhotos] = useState({});
  const [style, setStyle] = useState(templateNames[0]);
  const [format, setFormat] = useState('Cartel');
  const [mine, setMine] = useState([]);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  if (!__DEV__) return <AppSafeAreaView><Text>Solo disponible en el laboratorio local.</Text></AppSafeAreaView>;
  function newPoster(nextStyle = templateNames[0]) {
    setForm(empty); setSource('manual'); setSessionId(null); setPhotos({}); setCustomDj(''); setError(''); setStyle(nextStyle); setFormat('Cartel'); setSaved(false); setScreen('choose');
  }
  function toggleDj(name) {
    setForm(current => ({ ...current, djs: current.djs.includes(name) ? current.djs.filter(dj => dj !== name) : [...current.djs, name] })); setError('');
  }
  async function choosePhoto(name) {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert('Acceso a fotos', 'Permite el acceso a tu fototeca para añadir una foto del DJ.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false });
      if (!result.canceled && result.assets?.[0]?.uri) setPhotos(current => ({ ...current, [name]: result.assets[0].uri }));
    } catch { Alert.alert('No se ha podido abrir la foto', 'Vuelve a intentarlo.'); }
  }
  function generate() {
    if (!form.djs.length || !form.date.trim() || !form.time.trim() || !form.venue.trim() || (source === 'session' && !sessionId)) { setError('Elige al menos un DJ y completa fecha, hora y sitio. Si usas una sesión, selecciónala primero.'); return; }
    setPreview({ ...form, style, format, photos: Object.fromEntries(form.djs.filter(name => photos[name]).map(name => [name, photos[name]])), id: `local-${Date.now()}`, own: true }); setSaved(false); setError(''); setScreen('preview');
  }
  const availableDjs = [...new Set([...artists, ...form.djs])];
  const gallery = (tab === 'Explorar' ? examples : mine).filter(item => filter === 'Todos' || item.style === filter);
  return <AppSafeAreaView style={s.page}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={s.header}><Pressable accessibilityRole="button" disabled={screen === 'gallery'} hitSlop={12} onPress={() => setScreen(screen === 'editor' ? 'choose' : 'gallery')}><Text style={s.back}>{screen === 'gallery' ? 'DJ PLANNER' : '‹ Volver'}</Text></Pressable><Text style={s.headerTitle}>{screen === 'home' ? '' : 'Carteles'}</Text><Text style={s.badge}>LAB · 0 €</Text></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      {screen === 'home' && <><Text style={s.eyebrow}>LABORATORIO LOCAL</Text><Text style={s.title}>Tu próxima sesión merece un cartel.</Text><Text style={s.body}>Entra en + → Carteles para explorar diseños y crear el tuyo.</Text><View style={s.card}><Text style={s.heading}>Sin escribir prompts</Text><Text style={s.body}>Elige una sesión o añade los datos. Nosotros prepararemos las instrucciones para la IA.</Text></View></>}
      {screen === 'gallery' && <>
        <View accessibilityRole="tablist" style={s.tabs}>{['Explorar', 'Mis carteles'].map(name => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === name }} key={name} onPress={() => { setTab(name); setFilter('Todos'); }} style={[s.tab, tab === name && s.activeTab]}><Text style={[s.tabLabel, tab === name && { color: '#fff' }]}>{name}</Text></Pressable>)}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{['Todos', ...templateNames].map(name => <Chip key={name} label={name} selected={filter === name} onPress={() => setFilter(name)} />)}</ScrollView>
        <Text style={s.note}>{tab === 'Explorar' ? '8 propuestas de plantilla · Compara los estilos con los mismos datos de sesión.' : 'Tus pruebas guardadas durante esta ejecución del laboratorio.'}</Text>
        <View style={s.grid}>{gallery.map(item => <Pressable accessibilityRole="button" accessibilityLabel={`Abrir cartel ${item.title}`} key={item.id} style={s.tile} onPress={() => { setPreview(item); setSaved(Boolean(item.own)); setScreen('preview'); }}><View style={s.tileArtwork}><Poster data={item} small /></View><Text numberOfLines={1} style={s.tileTitle}>{item.own ? item.title || 'LIVE SESSION' : item.style}</Text><Text style={s.note}>{item.own ? item.style : getTemplate(item.style).description}</Text></Pressable>)}</View>
        {!gallery.length && <View style={s.card}><Text style={s.heading}>{mine.length ? 'Sin carteles de este estilo' : 'Tu primer cartel empieza aquí'}</Text><Text style={s.body}>Crea una propuesta con los datos de tu sesión, sin escribir instrucciones.</Text><Button onPress={() => newPoster()}>Crear nuevo cartel</Button></View>}
      </>}
      {screen === 'choose' && <>
        <Text style={s.eyebrow}>NUEVO CARTEL</Text>
        <Text style={s.title}>¿De dónde cogemos los datos?</Text>
        <Text style={s.body}>Elige una sesión que ya tengas o empieza con datos nuevos.</Text>
        <View style={s.card}><Text style={s.heading}>Sesión ya creada</Text><Text style={s.body}>Selecciona una sesión para rellenar los DJs, la fecha, la hora y el sitio.</Text><Button onPress={() => { setSource('session'); setScreen('editor'); }}>Elegir sesión</Button><Text style={s.note}>En este laboratorio se utilizan sesiones de ejemplo.</Text></View>
        <View style={s.card}><Text style={s.heading}>Datos nuevos</Text><Text style={s.body}>Añade los DJs y los datos de la sesión. Las fotos son opcionales.</Text><Button secondary onPress={() => { setSource('manual'); setScreen('editor'); }}>Introducir datos nuevos</Button></View>
      </>}
      {screen === 'editor' && <>
        <Text style={s.eyebrow}>NUEVO CARTEL</Text><Text style={s.title}>Los datos. El estilo. Y listo.</Text><Text style={s.body}>{source === 'session' ? 'Elige una sesión y ajusta sus datos si lo necesitas.' : 'Añade los datos de tu sesión. Sin escribir prompts.'}</Text>
        {source === 'session' && <View style={s.card}><Text style={s.heading}>Sesiones de ejemplo</Text><Text style={s.note}>La agenda real no está conectada en este laboratorio.</Text>{sessions.map(session => <Pressable key={session.id} accessibilityRole="button" accessibilityState={{ selected: sessionId === session.id }} onPress={() => { const { id, ...fields } = session; setSessionId(id); setForm(fields); setPhotos({}); setError(''); }} style={[s.session, sessionId === session.id && s.selected]}><Text style={s.tileTitle}>{session.title}</Text><Text style={s.note}>{session.date} · {session.time}</Text><Text style={s.note}>{session.djs.join(' / ')} · {session.venue}</Text></Pressable>)}</View>}
        <View style={s.card}><Text style={s.heading}>¿Quién pincha?</Text><Text style={s.note}>Puedes seleccionar varios DJs.</Text><View style={s.options}>{availableDjs.map(name => <Chip key={name} label={name} selected={form.djs.includes(name)} onPress={() => toggleDj(name)} />)}</View><TextInput accessibilityLabel="Nombre de otro DJ" placeholder="Añadir otro DJ" placeholderTextColor="#85859c" value={customDj} onChangeText={setCustomDj} maxLength={50} style={s.input} /><Button secondary onPress={() => { const name = customDj.trim(); if (!name) return; setForm(current => ({ ...current, djs: [...new Set([...current.djs, name])] })); setCustomDj(''); setError(''); }}>Añadir DJ</Button>
        {form.djs.map(name => <View key={name} style={s.photoRow}>{photos[name] ? <Image source={{ uri: photos[name] }} style={s.avatar} /> : <View style={[s.avatar, s.avatarEmpty]}><Text style={s.chipText}>{name.slice(0, 1)}</Text></View>}<View style={s.flex}><Text style={s.tileTitle}>{name}</Text><Pressable accessibilityRole="button" onPress={() => choosePhoto(name)}><Text style={s.link}>{photos[name] ? 'Cambiar foto' : 'Añadir foto (opcional)'}</Text></Pressable>{photos[name] && <Pressable accessibilityRole="button" onPress={() => setPhotos(current => { const next = { ...current }; delete next[name]; return next; })}><Text style={s.note}>Quitar foto</Text></Pressable>}</View></View>)}<Text style={s.note}>Las fotos se usan solo en esta prueba y no se suben a ningún servidor.</Text></View>
        <View style={s.card}><Text style={s.heading}>Datos de la sesión</Text>{[['title', 'Nombre de la sesión (opcional)', 'Ej. Midnight Session', 60], ['date', 'Fecha', 'Ej. 24 OCT 2026', 40], ['time', 'Hora', 'Ej. 23:30', 30], ['venue', 'Sitio', 'Ej. Sala Órbita · Madrid', 100]].map(([key, label, placeholder, length]) => <View key={key} style={{ gap: 8 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={form[key]} onChangeText={value => { setForm(current => ({ ...current, [key]: value })); setError(''); }} placeholder={placeholder} placeholderTextColor="#85859c" maxLength={length} style={s.input} /></View>)}</View>
        <Text style={s.heading}>Estilo visual</Text><View style={s.options}>{templateNames.map(name => <Chip key={name} label={name} selected={style === name} onPress={() => setStyle(name)} />)}</View><Text style={s.note}>{getTemplate(style).description}</Text><Text style={s.heading}>Formato</Text><View style={s.options}>{['Cartel', 'Historia', 'Cuadrado'].map(name => <Chip key={name} label={name} selected={format === name} onPress={() => setFormat(name)} />)}</View>
        <View style={s.notice}><Text style={s.body}>Vista previa de prueba · 0 €</Text><Text style={s.note}>Composición local. La generación con IA y los créditos todavía no están conectados.</Text></View>{!!error && <Text accessibilityRole="alert" style={{ color: '#ffb4b4' }}>{error}</Text>}<Button onPress={generate}>Crear vista previa</Button>
      </>}
      {screen === 'preview' && preview && <><Text style={s.eyebrow}>{preview.own ? 'TU VISTA PREVIA' : 'INSPIRACIÓN · EJEMPLO'}</Text><Poster data={preview} /><Text style={s.note}>{preview.style} · {preview.format} · Composición de prueba</Text>{preview.own ? <><Button secondary onPress={() => { const { title, djs, date, time, venue } = preview; setForm({ title, djs, date, time, venue }); setPhotos(preview.photos); setStyle(preview.style); setFormat(preview.format); setSource('manual'); setScreen('editor'); }}>Editar datos y diseño</Button><Button disabled={saved} onPress={() => { setMine(current => [preview, ...current.filter(item => item.id !== preview.id)]); setSaved(true); setTab('Mis carteles'); setFilter('Todos'); setScreen('gallery'); }}>Guardar en Mis carteles</Button></> : <Button onPress={() => newPoster(preview.style)}>Crear con este estilo</Button>}<Text style={s.note}>Los carteles propios son privados en esta prueba. No se publican en Explorar. Los borradores se pierden al cerrar o recargar el laboratorio.</Text></>}
    </ScrollView>
    </KeyboardAvoidingView>
    {['home', 'gallery'].includes(screen) && <Pressable accessibilityRole="button" accessibilityLabel={screen === 'home' ? 'Abrir menú de creación' : 'Crear nuevo cartel'} onPress={() => screen === 'home' ? setMenu(true) : newPoster()} style={s.fab}><Text style={s.plus}>+</Text></Pressable>}
    <Modal transparent visible={menu} animationType="slide" onRequestClose={() => setMenu(false)}><View style={s.modal}><Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú" style={s.flex} onPress={() => setMenu(false)} /><View accessibilityViewIsModal style={s.sheet}><View style={s.header}><Text style={s.heading}>Crear</Text><Pressable accessibilityRole="button" onPress={() => setMenu(false)}><Text style={s.back}>Cerrar</Text></Pressable></View><Button secondary onPress={() => { setMenu(false); setScreen('gallery'); }}>▧  Carteles</Button><Text style={s.note}>Solo en el laboratorio local</Text></View></View></Modal>
  </AppSafeAreaView>;
}
const makeStyles = (c) => StyleSheet.create({
  flex: { flex: 1 }, page: { flex: 1, backgroundColor: c.bg }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 }, headerTitle: { color: c.fg, fontWeight: '700', fontSize: 20 }, back: { color: c.accent, fontSize: 14, fontWeight: '600' }, badge: { color: '#c6f798', borderColor: '#333339', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20, fontSize: 11 },
  content: { padding: 20, paddingBottom: 130, gap: 20 }, eyebrow: { color: '#b49bf8', fontSize: 11, letterSpacing: 2, fontWeight: '700' }, title: { color: c.fg, fontSize: 32, lineHeight: 39, fontWeight: '800' }, body: { color: c.fg, fontSize: 15, lineHeight: 23 }, note: { color: c.muted, fontSize: 12, lineHeight: 18 }, heading: { color: c.fg, fontSize: 18, fontWeight: '700' }, card: { backgroundColor: c.card, borderRadius: 20, padding: 18, gap: 16 },
  button: { backgroundColor: c.accent, padding: 16, minHeight: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: c.onAccent, fontSize: 15, fontWeight: '700', textAlign: 'center' }, secondary: { backgroundColor: c.tint },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#38383f' }, tab: { flex: 1, paddingVertical: 16, alignItems: 'center', borderBottomWidth: 3, borderColor: 'transparent' }, activeTab: { borderColor: '#9878ff' }, tabLabel: { color: '#9a9aa7', fontSize: 16, fontWeight: '600' }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: c.border, borderRadius: 24, minHeight: 44, backgroundColor: c.card, justifyContent: 'center' }, selected: { borderColor: '#b99afc', backgroundColor: '#30243f' }, chipText: { color: c.fg, fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, tile: { width: '48%', flexGrow: 1, maxWidth: '49%', gap: 5 }, tileArtwork: { borderRadius: 16, overflow: 'hidden' }, tileTitle: { color: c.fg, fontSize: 13, fontWeight: '700' },
  input: { color: c.fg, backgroundColor: c.field, borderWidth: 1, borderColor: '#393942', borderRadius: 12, padding: 13, fontSize: 16, minHeight: 48 }, label: { color: c.muted, fontSize: 14 }, session: { padding: 14, gap: 6, borderRadius: 12, borderWidth: 1, borderColor: c.border }, photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 52, height: 52, borderRadius: 26 }, avatarEmpty: { backgroundColor: '#39304b', alignItems: 'center', justifyContent: 'center' }, link: { color: c.accent, fontSize: 13, paddingVertical: 8 }, notice: { borderLeftWidth: 3, borderColor: '#b99afc', paddingLeft: 15, gap: 8 },
  poster: { width: '100%', overflow: 'hidden', justifyContent: 'space-between' }, orbit: { position: 'absolute', width: 350, height: 350, borderRadius: 175, borderWidth: 42, left: -110, top: 65, transform: [{ scaleX: 0.7 }, { rotate: '-30deg' }] }, posterCenter: { flex: 1, justifyContent: 'center', gap: 12 }, portraits: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 12 },
  fab: { position: 'absolute', bottom: 35, right: 24, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, borderWidth: 1, borderColor: '#b99afc', elevation: 5 }, plus: { color: c.fg, fontSize: 39, lineHeight: 45 }, modal: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0009' }, sheet: { backgroundColor: c.card, padding: 22, paddingBottom: 44, borderTopLeftRadius: 25, borderTopRightRadius: 25, gap: 20 },
});
