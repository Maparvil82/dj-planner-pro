const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'),
    assert = require('node:assert/strict');
let browser, page;
const errors = [];
(async () => {
    browser = await chromium.launch({
        headless: true,
        args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
        ],
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
                localStorage.setItem(
                    '@theme',
                    location.search.includes('testTheme=dark')
                        ? 'dark'
                        : dark
                          ? 'dark'
                          : 'light',
                );
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
        await context.grantPermissions([
            'clipboard-read',
            'clipboard-write',
            'camera',
        ]);
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
        page.on('pageerror', (e) => {
            errors.push(e.message);
            console.error('PAGE', e.message);
        });
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                console.error(msg.text().slice(0, 300));
                if (/unique.*key/.test(msg.text())) errors.push(msg.text());
            }
        });
        return context;
    }

    const base=process.env.BASE_URL || 'http://localhost:8082';
    const id='00000000-0000-4000-8000-000000000871';
    const row={id,user_id:user.id,title:'Context Session',venue:'Sala X',date:'2030-10-10',start_time:'22:00',end_time:'04:00',status:'confirmed',djs:[],earning_type:'fixed',earning_amount:200,amount_paid:0,currency:'€',color:'#DCEB7D'};
    const context=await setup('es',390,true,true);
    await context.route('**/rest/v1/sessions*',route=>route.fulfill({json:route.request().headers().accept?.includes('vnd.pgrst.object')?row:[row]}));
    await context.route('**/rest/v1/rpc/event_entry_count',route=>route.fulfill({json:0}));
    await context.route('**/rest/v1/session_tasks*',route=>route.fulfill({json:[]}));
    await context.route('**/rest/v1/expenses*',route=>route.fulfill({json:[]}));
    await page.goto(base+'/home',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Crear',exact:true}).waitFor();
    // Mount/prefetch the tools through the global menu before opening one
    // with a session parameter: this catches state initialised too early.
    await page.getByRole('button',{name:'Crear',exact:true}).click();
    await page.getByRole('button',{name:'Preparación',exact:true}).click();
    await page.getByText('Elige una sesión',{exact:true}).filter({visible:true}).first().waitFor();
    await page.getByRole('button').filter({hasText:'Context Session'}).waitFor();
    await page.getByRole('button',{name:'Volver',exact:true}).click();
    await page.getByText('Context Session',{exact:true}).filter({visible:true}).first().click();
    await page.waitForURL('**/session/'+id);
    await page.getByTestId('session-detail-header').waitFor();
    for(const [label,path] of [['Preparación','/preparation'],['Acceso','/tickets'],['Gastos','/expenses'],['Invitados','/guests']]){
        await page.getByRole('button',{name:label,exact:true}).scrollIntoViewIfNeeded();
        await page.getByRole('button',{name:label,exact:true}).click();
        await page.waitForURL(url=>url.pathname===path&&url.searchParams.get('sessionId')===id);
        await page.getByText('Context Session',{exact:false}).filter({visible:true}).first().waitFor();
        await page.waitForTimeout(500);
        assert.equal(await page.getByText('Elige una sesión',{exact:true}).filter({visible:true}).count(),0,'no chooser from detail: '+path);
        assert.equal(await page.getByRole('button',{name:/Cambiar.*sesión/i}).count(),0,'no session switching from detail: '+path);
        assert.equal(await page.getByLabel('Buscar sesión').filter({visible:true}).count(),0);
        await page.getByRole('button',{name:'Volver',exact:true}).click();await page.getByTestId('session-detail-header').waitFor();
        console.log('DIRECT',path);
    }
    await page.goBack();await page.getByRole('button',{name:'Crear',exact:true}).waitFor();
    for(const [label,path] of [['Preparación','/preparation'],['Acceso','/tickets'],['Gastos','/expenses'],['Invitados','/guests']]){
        await page.getByRole('button',{name:'Crear',exact:true}).click();
        await page.getByRole('button',{name:label,exact:true}).click();
        await page.waitForURL(url=>url.pathname===path&&!url.searchParams.has('sessionId'));
        await page.getByRole('button').filter({hasText:'Context Session'}).waitFor();
        await page.getByRole('button').filter({hasText:'Context Session'}).click();
        await page.getByRole('button',{name:/Cambiar.*sesión/i}).waitFor();
        await page.getByRole('button',{name:'Volver',exact:true}).click();
        console.log('GLOBAL',path);
    }
    page=await context.newPage();
    await page.goto(base+'/preparation?sessionId='+id,{waitUntil:'domcontentloaded'});
    await page.getByText('Context Session',{exact:true}).filter({visible:true}).first().waitFor();
    await page.getByRole('button',{name:'Volver',exact:true}).click();
    await page.waitForURL('**/session/'+id);
    await page.getByTestId('session-detail-header').waitFor();
    console.log('DIRECT LINK: back reaches the correct detail without prior session history');
    assert.deepEqual(errors,[]);
    console.log('PASS: preparation/entries/expenses/guests open the current session directly from detail; global + retains chooser and switching, including prefetched routes, real app back buttons and direct links');
    await browser.close();
})().catch(async e=>{console.error(e);if(page&&!page.isClosed())console.error((await page.locator('body').innerText()).slice(-2200));if(browser)await browser.close();process.exitCode=1;});
