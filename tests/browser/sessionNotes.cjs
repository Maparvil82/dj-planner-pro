const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'),
    assert = require('node:assert/strict');
let browser, page;
const errors = [];
(async () => {
    browser = await chromium.launch({
        headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM,
    });
    const user = {
        id: '00000000-0000-4000-8000-000000000901',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'fixture@example.invalid',
        app_metadata: { provider: 'email' },
        user_metadata: { artist_name: 'DJ Demo' },
        created_at: '2026-10-01T12:00:00Z',
    };
    const enc = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
    const token = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.${enc('fixture')}`;
    const session = {
        access_token: token,
        refresh_token: 'fixture',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user,
    };
    const profile = {
        user_id: user.id,
        id: user.id,
        artist_name: 'DJ Demo',
        city: 'Madrid',
        genres: 'House',
        bio: 'Music first',
        avatar_url: null,
        cover_url: null,
        is_visible: true,
    };
    async function setup(lang = 'es', width = 390, dark = false, pro = false) {
        const context = await browser.newContext({
            viewport: { width, height: 844 },
            locale: lang,
        });
        await context.addInitScript(
            ({ lang, dark, session, profile }) => {
                Object.defineProperty(navigator, 'language', {
                    get: () => lang,
                });
                Object.defineProperty(navigator, 'languages', {
                    get: () => [lang],
                });
                localStorage.setItem('@theme', typeof dark === 'string' ? dark : dark ? 'dark' : 'light');
                localStorage.setItem(
                    'sb-voyurnwckmateohuzbab-auth-token',
                    JSON.stringify(session),
                );
                localStorage.setItem(
                    'dj-auth-storage-v2',
                    JSON.stringify({
                        state: {
                            session,
                            user: session.user,
                            profile,
                            hasSeenOnboarding: true,
                        },
                        version: 0,
                    }),
                );
            },
            { lang, dark, session, profile },
        );
        await context.route('**/*.supabase.co/**', async (route) => {
            const req = route.request(),
                url = new URL(req.url());
            let body = [];
            if (url.pathname.includes('/auth/v1/user')) body = user;
            else if (url.pathname.includes('/auth/v1/token')) body = session;
            else if (
                url.pathname.includes('/community_profiles') ||
                url.pathname.includes('/users_profile')
            )
                body = profile;
            else if (url.pathname.includes('/subscription-access'))
                body = { count: 12, limit: 30, remaining: 18, isPro: pro };
            else if (
                url.pathname.includes('/social_notifications') &&
                req.method() === 'HEAD'
            ) {
                await route.fulfill({
                    status: 200,
                    headers: {
                        'content-range': '0-0/2',
                        'access-control-expose-headers': 'content-range',
                    },
                    body: '',
                });
                return;
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(body),
            });
        });
        page = await context.newPage();
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('dialog', dialog => dialog.accept());
        return context;
    }




    const base=process.env.BASE_URL||'http://localhost:8081';
    const id='00000000-0000-4000-8000-000000000919';
    const venue={id:'00000000-0000-4000-8000-000000000912',user_id:user.id,name:'Sala X',city:'Sevilla'};
    for(const [width,dark] of [[390,false],[320,true]]){
        const context=await setup('es',width,dark);
        let saved, patches=[], failNextPatch=false, guestView=false;
        await context.route('**/*.supabase.co/**',async route=>{
            const req=route.request(),url=new URL(req.url());let body;
            if(url.pathname.endsWith('/venues'))body=[venue];
            else if(url.pathname.endsWith('/rpc/get_session_usage'))body={count:saved?1:0,limit:15,remaining:14,isPro:false};
            else if(url.pathname.endsWith('/rpc/create_session_series'))body=saved={...req.postDataJSON().input,id,user_id:user.id,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
            else if(url.pathname.endsWith('/sessions')){
                if(req.method()==='PATCH'){
                    if(failNextPatch){failNextPatch=false;await route.fulfill({status:503,json:{message:'fixture unavailable'}});return;}
                    patches.push(req.postDataJSON());saved={...saved,...req.postDataJSON()};body=[{id}];
                }else{
                    const row=saved&&guestView?{...saved,is_guest:true,user_id:'00000000-0000-4000-8000-000000000999',owner_name:'Other DJ'}:saved;
                    body=req.headers().accept?.includes('vnd.pgrst.object')?row:row?[row]:[];
                }
            }else{await route.fallback();return;}
            await route.fulfill({json:body});
        });
        const notes=page.getByRole('textbox',{name:'Notas privadas',exact:true});
        const save=()=>page.getByRole('button',{name:'Guardar notas',exact:true});
        async function openDetail(){
            await page.goto(base+'/home');await page.getByText('Notes Test',{exact:true}).filter({visible:true}).first().click();
            await page.waitForURL('**/session/'+id);
            if(!guestView){await page.getByRole('button',{name:'Notas privadas',exact:true}).click();await page.waitForURL('**/session-notes?*');}
        }
        await page.goto(base+'/home');
        await page.getByRole('button',{name:'Crear',exact:true}).click();
        await page.getByRole('button',{name:'Simple',exact:true}).click();await page.waitForURL('**/add-session');
        await page.getByRole('textbox',{name:'Nombre del evento · Opcional',exact:true}).fill('Notes Test');
        const original='Llegar a las 19:00\nPrimer baile: canción acordada 🎵';
        await notes.fill('  '+original+'  ');
        assert.equal(await notes.getAttribute('maxlength'),'5000');
        if(dark){const colors=await notes.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));assert.equal(colors.background,'rgb(36, 36, 34)');assert.equal(colors.color,'rgb(247, 247, 247)');}
        await page.getByText('Ej: Club Amnesia',{exact:true}).click();await page.getByText('Sala X',{exact:true}).last().click();
        await page.getByRole('button',{name:'Guardar sesión',exact:true}).click();await page.waitForURL('**/home');assert.equal(saved.notes,original);
        await openDetail();
        const content=page.getByTestId('session-notes-content');await content.getByText(original,{exact:true}).waitFor();
        await page.getByRole('button',{name:'Editar notas',exact:true}).click();assert.equal(await notes.inputValue(),original);
        await notes.fill('Borrador descartado');await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(saved.notes,original);
        await page.getByRole('button',{name:'Editar notas',exact:true}).click();
        const revised='Entrada de proveedores\nLlamar al organizador al llegar';await notes.fill(revised);failNextPatch=true;
        const failure=page.waitForResponse(r=>r.url().includes('/rest/v1/sessions')&&r.request().method()==='PATCH'&&r.status()===503);
        await save().click();await failure;
        await save().waitFor();assert.equal(await notes.inputValue(),revised,'Network failure preserves the note draft');assert.equal(saved.notes,original);
        await save().click();await content.getByText(revised,{exact:true}).waitFor();assert.equal(saved.notes,revised);
        assert.deepEqual(Object.keys(patches[0]).filter(key=>key!=='updated_at'),['notes']);
        await page.getByTestId('session-notes-card').scrollIntoViewIfNeeded();
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/session-notes-'+width+(dark?'-dark':'-light')+'.png'});
        await openDetail();await content.getByText(revised,{exact:true}).waitFor();
        await page.getByRole('button',{name:'Volver',exact:true}).click();await page.waitForURL('**/session/'+id);
        await page.getByRole('button',{name:'Editar sesión',exact:true}).click();await page.waitForURL('**/edit-session/'+id);
        await notes.waitFor();assert.equal(await notes.inputValue(),revised);await notes.fill('');
        await page.getByRole('button',{name:'Guardar sesión',exact:true}).click();await page.waitForURL('**/session/'+id);
        await page.getByRole('button',{name:'Notas privadas',exact:true}).click();await page.waitForURL('**/session-notes?*');
        await page.getByRole('button',{name:'Añadir notas',exact:true}).waitFor();assert.equal(saved.notes,null);
        await page.getByRole('button',{name:'Añadir notas',exact:true}).click();await notes.fill('Nueva nota privada');await save().click();
        await content.getByText('Nueva nota privada',{exact:true}).waitFor();
        guestView=true;await openDetail();await page.getByText('Club',{exact:true}).waitFor();
        assert.equal(await page.getByTestId('session-notes-card').count(),0,'Guest detail never renders private notes');
        assert.equal(await page.getByText('Nueva nota privada',{exact:true}).count(),0);
        await context.close();console.log('PASS: create/read/edit/clear notes, cancel, failed-save draft retention and private guest UI at '+width+(dark?' dark':' light'));
    }
    assert.deepEqual(errors,[]);await browser.close();
})().catch(async error=>{console.error(error);if(page&&!page.isClosed()){console.error((await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:'/private/tmp/session-notes-failure.png'});}if(browser)await browser.close();process.exitCode=1;});
