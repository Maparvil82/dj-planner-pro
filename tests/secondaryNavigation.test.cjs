const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const root=path.resolve('node_modules/expo-router/build');
function evaluate(source,dependencies,extra={}){const mod={exports:{}};vm.runInNewContext(source,{module:mod,exports:mod.exports,require:name=>{if(name in dependencies)return dependencies[name];throw new Error(`Missing fixture dependency: ${name}`);},__DEV__:true,console,...extra});return mod.exports;}
function layout(signedIn=true){
 const createElement=(type,props,...children)=>({type,props:{...props,children:children.length===1?children[0]:children}});
 const React={createElement,useContext:()=>({activeTheme:'light'})};
 function Tabs(){}Tabs.Screen='screen';
 const dependencies={
 'react':React,'react-native':{View:'view',ActivityIndicator:'loading',useWindowDimensions:()=>({width:390}),StyleSheet:{create:styles=>styles,absoluteFill:{},absoluteFillObject:{},hairlineWidth:1}},
 'expo-blur':{BlurView:'blur'},
 'expo-glass-effect':{GlassView:'glass',isLiquidGlassAvailable:()=>false,isGlassEffectAPIAvailable:()=>false},
 'expo-router':{Tabs,Redirect:'redirect'},'lucide-react-native':{},
 '../../src/contexts/ThemeContext':{useDarkPalette:()=>({}),ThemeContext:{}},
 '../../src/components/ui/AddSessionButton':{AddSessionButton:'add'},
 '../../src/components/navigation/AccountDrawer':{AccountDrawerProvider:'scope'},
 '../../src/contexts/TabBarVisibilityContext':{TabBarVisibilityProvider:'scope'},
 '../../src/components/ui/ScrollTabBar':{ScrollTabBar:'bar'},
 '../../src/i18n/useTranslation':{useTranslation:()=>({t:key=>key})},
 '../../src/store/useAuthStore':{useAuthStore:()=>({initialized:true,session:signedIn?{user:{id:'viewer'}}:null})},
 '../../src/config/features':{FEATURES:{documents:false}},
 };
 const code=ts.transpileModule(fs.readFileSync('app/(tabs)/_layout.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
 let node=evaluate(code,dependencies,{React}).default();
 while(node.type!==Tabs&&node.type!=='redirect'){node=typeof node.type==='function'?node.type(node.props):node.props.children;}
 return node;
}
// Exercise the actual installed SDK's href/hidden processing and redirect hook,
// rather than reproducing its routing rules in the test.
function sdkScreens(screens){let processScreens;evaluate(fs.readFileSync(path.join(root,'layouts/TabsClient.js'),'utf8'),{
 '../link/Link':{},'../react-navigation/bottom-tabs/navigators/createBottomTabNavigator':{},'../react-navigation/native':{},
 '../standard-navigation':{integrateWithRouter:(_create,_router,options)=>{processScreens=options.processScreens;return {}; }},
 '../standard-navigation/appendMissingPlaceholderTabRoutes':{},'./createBaseTabProps':{},'../react-navigation/bottom-tabs':{},
 });return processScreens(screens);}
function navigation(target){const raw=layout().props.children.filter(Boolean).map(node=>node.props),screens=sdkScreens(raw);
 const routes=screens.map(({name})=>({name,key:name})),descriptors=Object.fromEntries(screens.map(s=>[s.name,{routeSource:'layout',options:s.options}])),redirects=[];
 const {useVisibleTabsWithRedirect}=evaluate(fs.readFileSync(path.join(root,'standard-navigation/useVisibleTabsWithRedirect.js'),'utf8'),{
 'react':{useMemo:fn=>fn(),useEffect:fn=>fn()},'../Route':{useRouteNode:()=>({initialRouteName:'home'})},'../constants':{NOT_FOUND_ROUTE_NAME:'+not-found'},
 '../global-state/useRouterActions':{useRouterActions:()=>({replace:href=>redirects.push(href)})},
 '../layouts/GuardContext':{useGuardRedirect:()=>undefined},'../link/preview/PreviewRouteContext':{useIsPreview:()=>false},'../react-navigation/native':{useIsFocused:()=>true},
 '../routeNode':{getValidInitialRouteName:node=>node.initialRouteName},
 '../utils/orderRoutesByRouteNames':require(path.join(root,'utils/orderRoutesByRouteNames.js')),
 './useBuildHref':{useBuildHref:()=>route=>'/'+route.name},
 });
 const result=useVisibleTabsWithRedirect({routes,routeNames:routes.map(r=>r.name),focusedRouteKey:target,descriptors});return {result,redirects,screen:screens.find(s=>s.name===target)};
}
for(const target of ['history','venues','account'])test(`${target} remains reachable without adding a bottom tab`,()=>{
 const {result,redirects,screen}=navigation(target);assert.equal(result.visibleRoutes[result.focusedIndex]?.name,target);assert.deepEqual(redirects,[]);assert.equal(screen.options.tabBarButton(),null);assert.equal(screen.options.tabBarItemStyle.display,'none');
});
test('disabled Documents still redirects instead of exposing a future feature',()=>{const {result,redirects}=navigation('vault');assert.equal(result.focusedIndex,-1);assert.deepEqual(redirects,['/home']);});
test('sign-in protection still guards the secondary routes',()=>{const node=layout(false);assert.equal(node.type,'redirect');assert.equal(node.props.href,'/(auth)/login');});
