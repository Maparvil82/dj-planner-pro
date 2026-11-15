// Isolated UI fixture: real recorder component and React Native Web layout,
// simulated microphone/files/server. No application route or real data is used.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'dj-voice-flow-'));
const write = (name, text) => fs.writeFileSync(path.join(fixture, name), text);
let browser;
(async () => {
 fs.symlinkSync(path.join(root,'node_modules'),path.join(fixture,'node_modules'),'dir');
 write('package.json',JSON.stringify({name:'voice-recorder-fixture',version:'1.0.0',main:'index.js',private:true}));
 write('app.json',JSON.stringify({expo:{name:'Voice recorder fixture',slug:'voice-recorder-fixture',platforms:['web'],web:{output:'single'}}}));
 write('index.js',`import React from 'react';import {registerRootComponent} from 'expo';import {View,Text} from 'react-native';import VoiceRecorder from ${JSON.stringify(path.join(root,'src/components/voiceNotes/VoiceRecorder'))};registerRootComponent(function App(){return <View style={{flex:1,backgroundColor:"#171717",padding:24}}><Text style={{color:"#f7f7f7",fontSize:28,fontWeight:"800",marginBottom:24}}>Sesión en Zoco</Text><VoiceRecorder sessionId="fixture" hasVenue venueName="Zoco" onSaved={()=>window.__voice.completed++}/></View>;});`);
 write('theme.js',`export function useCommunityColors(){return {bg:'#171717',card:'#242422',fg:'#f7f7f7',muted:'#b0b0aa',accent:'#dcf58b',onAccent:'#171717',field:'#242422',border:'#45453f',tint:'#333a22'};}`);
 write('translation.js',`import strings from ${JSON.stringify(path.join(root,'src/i18n/languages/es.json'))};const t=(key,vars={})=>{let value=key.split('.').reduce((o,k)=>o?.[k],strings)||key;return value.replace(/{{(\\w+)}}/g,(_,k)=>String(vars[k]??''));};export function useTranslation(){return {t};}`);
 write('safeArea.js',`export {View as SafeAreaView} from 'react-native';`);
 write('files.js',`export class File {constructor(uri){this.uri=uri;}delete(){window.__voice.deleted++;}}`);
 write('service.js',`export const VOICE_MAX_MS=20000;export const voiceNotes={save:async(...args)=>{if(window.__voice.failNext){window.__voice.failNext=false;throw Error('fixture network failure');}window.__voice.saved.push(args);}};`);
 write('audio.js',`import {useRef,useSyncExternalStore} from 'react';
let status={durationMillis:0,isRecording:false,metering:-160};const listeners=new Set();const emit=s=>{status={...status,...s};listeners.forEach(f=>f());};
window.__voice={saved:[],deleted:0,completed:0,failNext:false,advance:(ms,metering=-18)=>emit({durationMillis:ms,metering}),autoStop:()=>emit({durationMillis:20000,isRecording:false})};
const recorder={get isRecording(){return status.isRecording},get uri(){return 'file://fixture.m4a'},getStatus:()=>status,prepareToRecordAsync:async()=>emit({durationMillis:0,isRecording:false,metering:-160}),record:opts=>{window.__voice.limit=opts.forDuration;emit({isRecording:true})},stop:async()=>emit({isRecording:false})};
export function useAudioRecorder(options){window.__voice.meteringEnabled=options.isMeteringEnabled;return recorder;}export function useAudioRecorderState(){return useSyncExternalStore(f=>{listeners.add(f);return()=>listeners.delete(f)},()=>status,()=>status);}
export function useAudioPlayer(){return useRef({pause(){},play(){},replace(){},seekTo:async()=>{}}).current;}export const AudioModule={requestRecordingPermissionsAsync:async()=>({granted:true})};export const RecordingPresets={HIGH_QUALITY:{}};export async function setAudioModeAsync(){};`);
 write('metro.config.js',`const {getDefaultConfig}=require('expo/metro-config');const path=require('path');const config=getDefaultConfig(__dirname);config.watchFolders=[${JSON.stringify(root)}];config.resolver.nodeModulesPaths=[${JSON.stringify(path.join(root,'node_modules'))}];const mocks={'expo-audio':'audio.js','expo-file-system':'files.js','react-native-safe-area-context':'safeArea.js'};config.resolver.resolveRequest=(context,name,platform)=>{let file=mocks[name];if(name.endsWith('/communityColors'))file='theme.js';if(name.endsWith('/i18n/useTranslation'))file='translation.js';if(name.endsWith('/services/voiceNotes'))file='service.js';return file?{type:'sourceFile',filePath:path.join(__dirname,file)}:context.resolveRequest(context,name,platform);};module.exports=config;`);
 const log=fs.openSync(path.join(fixture,'build.log'),'w');
 try {execFileSync(process.execPath,[path.join(root,'node_modules/expo/bin/cli'),'export','--platform','web','--output-dir',path.join(fixture,'dist')],{cwd:fixture,env:{...process.env,EXPO_OFFLINE:'1',EXPO_NO_TELEMETRY:'1'},timeout:120000,stdio:['ignore',log,log]});}
 finally{fs.closeSync(log);}
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM});
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
 await page.route('http://voice-fixture.local/**',async route=>{
  let file=path.join(fixture,'dist',new URL(route.request().url()).pathname);if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  await route.fulfill({status:fs.existsSync(file)?200:404,body:fs.existsSync(file)?fs.readFileSync(file):'',contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':undefined});
 });
 await page.goto('http://voice-fixture.local/');
 const button=name=>page.getByRole('button',{name,exact:true});
 let capturedWaveform=false;
 async function record(ms=5000,automatic=false){
  await button('Grabar nota').click();await page.getByText('Grabando tu nota',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__voice.limit),20);
  assert.equal(await page.evaluate(()=>window.__voice.meteringEnabled),true,'Native microphone metering enabled');
  if(!capturedWaveform){
   await page.getByTestId('voice-recording-waveform').waitFor();
   assert.equal(await page.getByTestId('voice-waveform-bar').evaluateAll(bars=>Math.max(...bars.map(b=>b.getBoundingClientRect().height))),3,'Silence stays flat');
   for(let point=200;point<=ms;point+=400){await page.evaluate(([point,db])=>window.__voice.advance(point,db),[point,[-50,-28,-10,-40,-20,-6,-35][Math.floor(point/400)%7]]);await page.waitForTimeout(20);}
   await page.evaluate(ms=>window.__voice.advance(ms,-12),ms);
   await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-testid="voice-waveform-bar"]')).some(b=>b.getBoundingClientRect().height>60));
   await page.waitForTimeout(400);
   const bounds=await page.getByTestId('voice-recording-sheet').boundingBox();
   assert.ok(bounds.y>0 && Math.abs(bounds.y+bounds.height-844)<2,'Sheet is anchored at the bottom');
   await page.screenshot({path:'/tmp/dj-voice-recording-sheet.png'});capturedWaveform=true;
  }else await page.evaluate(ms=>window.__voice.advance(ms),ms);
  if(automatic)await page.evaluate(()=>window.__voice.autoStop());else await button('Detener').click();
  await page.getByText('¿Quieres guardar esta grabación?',{exact:true}).waitFor();
 }
 await record(10000);await page.waitForTimeout(400);await page.screenshot({path:'/tmp/dj-voice-review.png'});
 assert.equal(await page.evaluate(()=>window.__voice.saved.length),0);await button('No, descartar').click();await button('Grabar nota').waitFor();assert.equal(await page.evaluate(()=>window.__voice.deleted),1);
 await record();await button('Sí, guardar').click();const name=page.getByRole('textbox',{name:'¿Cómo quieres llamar a la grabación?',exact:true});await name.waitFor();assert.equal(await button('Continuar').isDisabled(),true);await name.fill('  Preguntar por el monitor  ');await button('Continuar').click();await page.getByText('¿Quieres que te lo recuerde en tu próxima visita a Zoco?',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__voice.saved.length),0);await page.screenshot({path:'/tmp/dj-voice-reminder-choice.png'});
 await page.evaluate(()=>window.__voice.failNext=true);await button('Sí, recordármelo').click();await page.getByText('No se pudo guardar. Tu grabación sigue disponible para reintentar.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__voice.saved.length),0);await button('Sí, recordármelo').click();await button('Grabar nota').waitFor();assert.deepEqual(await page.evaluate(()=>window.__voice.saved[0]),['fixture','file://fixture.m4a',5000,'Preguntar por el monitor',true]);
 await record(20000,true);await button('Sí, guardar').click();await name.fill('Nota sin aviso');await button('Continuar').click();await button('No, guardar sin recordatorio').click();await button('Grabar nota').waitFor();assert.equal(await page.evaluate(()=>window.__voice.saved[1][4]),false);assert.equal(await page.evaluate(()=>window.__voice.saved[1][2]),20000);
 assert.deepEqual(errors,[]);console.log('PASS: bottom sheet, real metering enabled, silent/active waveform, 20s auto-stop, explicit keep/discard, required name, next-visit yes/no, no premature uploads, retained audio after network failure and repeated recordings.');
 await browser.close();
})().catch(async e=>{console.error(e);console.error('Fixture:',fixture);if(browser)await browser.close();process.exitCode=1;});
