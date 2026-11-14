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






    const context=await setup('es',390,true,false);
    await context.route('**/*posthog.com/**',route=>route.abort());
    const id='00000000-0000-4000-8000-000000000919';
    const venueId='00000000-0000-4000-8000-000000000912';
    const saved={id,user_id:user.id,title:'Viernes en Zoco',venue:'Zoco',venue_id:venueId,date:'2030-11-01',start_time:'23:00',end_time:'04:00',booking_timezone:'Europe/Madrid',status:'confirmed',earning_type:'fixed',earning_amount:250,currency:'EUR',color:'#34D399',notes:'Nota privada que no se copia',amount_paid:100,djs:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    await context.route('**/*.supabase.co/**',async route=>{
        const req=route.request(),url=new URL(req.url());let body;
        if(!['GET','HEAD'].includes(req.method()) && url.pathname.endsWith('/sessions')) { await route.fulfill({status:403,json:{message:'Session writes disabled in this test'}});return; }
        if(url.pathname.endsWith('/rpc/get_session_usage'))body={count:1,limit:15,remaining:14,isPro:false};
        else if(url.pathname.endsWith('/sessions'))body=req.headers().accept?.includes('vnd.pgrst.object')?saved:[saved];
        else if(url.pathname.endsWith('/venues'))body=[{id:venueId,user_id:user.id,name:'Zoco',city:'Madrid',archived_at:null}];
        else if(url.pathname.includes('/rpc/session_screen_'))body=url.pathname.endsWith('/session_screen_page')?{sessions:[saved],nextCursor:null}:{};
        else {await route.fallback();return;}
        await route.fulfill({json:body});
    });
    const base=process.env.BASE_URL||'http://localhost:8081';
    await page.goto(base+'/session/'+id);
    await page.getByTestId('save-session-template').click();
    await page.getByRole('textbox',{name:'Nombre de la plantilla',exact:true}).fill('Zoco habitual');
    await page.getByRole('button',{name:'Guardar plantilla',exact:true}).click({trial:true});
    await page.screenshot({path:'/tmp/dj-template-save.png'});
    await page.getByRole('button',{name:'Guardar plantilla',exact:true}).click();
    await page.getByRole('heading',{name:'Plantilla guardada'}).waitFor();
    await page.getByRole('button',{name:'Listo',exact:true}).click();
    await page.goto(base+'/add-session?date=2030-12-15');
    await page.getByTestId('use-session-template').waitFor({timeout:90000});
    const originalDate=await page.getByTestId('session-date-field').innerText();
    await page.getByTestId('use-session-template').click();
    await page.getByRole('button',{name:'Aplicar Zoco habitual',exact:true}).waitFor();
    await page.getByRole('button',{name:'Aplicar Zoco habitual',exact:true}).click({trial:true});
    await page.screenshot({path:'/tmp/dj-template-picker.png'});
    await page.getByRole('button',{name:'Aplicar Zoco habitual',exact:true}).click();
    await page.getByTestId('session-venue-field').getByText('Zoco',{exact:true}).waitFor();
    assert.equal(await page.getByTestId('session-date-field').innerText(),originalDate);
    assert.equal(await page.getByText('Nota privada que no se copia',{exact:true}).count(),0);
    await page.getByTestId('use-session-template').click();
    await page.getByRole('button',{name:'Renombrar Zoco habitual',exact:true}).click();
    await page.getByRole('textbox',{name:'Nombre de la plantilla',exact:true}).fill('Zoco viernes');
    await page.getByRole('button',{name:'Guardar plantilla',exact:true}).click();
    await page.getByRole('button',{name:'Aplicar Zoco viernes',exact:true}).waitFor();
    await page.getByRole('button',{name:'Eliminar Zoco viernes',exact:true}).click();
    await page.getByText('Aún no tienes plantillas.',{exact:false}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('Template browser flow passed: save, reload, apply, date retained, rename, delete; no page errors.');
    await browser.close();
})().catch(async e=>{console.error(e); if(page){console.error((await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:'/tmp/dj-template-error.png'}).catch(()=>{});}await browser?.close();process.exit(1);});
