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
        const fixture = {status:'available',activations:0};
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
            else if (url.pathname.includes('/start_pro_trial')) { fixture.activations++; fixture.status='active'; body={count:12,limit:15,remaining:3,isPro:true,paidPro:false,serverNow:new Date().toISOString(),trial:{eligible:false,status:'active',startedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+15*86400000).toISOString()}}; }
            else if (url.pathname.includes('/subscription-access') || url.pathname.includes('/get_session_usage'))
                body = { count: 12, limit: 15, remaining: 3, isPro: pro || fixture.status==='active', paidPro:pro, serverNow:new Date().toISOString(), trial:{eligible:!pro&&fixture.status==='available',status:fixture.status,startedAt:fixture.status==='available'?null:new Date(Date.now()-86400000).toISOString(),expiresAt:fixture.status==='available'?null:new Date(Date.now()+(fixture.status==='active'?15:-1)*86400000).toISOString()} };
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
        context.trialFixture=fixture;
        return context;
    }

    const base=process.env.BASE_URL || 'http://localhost:8082';
    const id='00000000-0000-4000-8000-000000000871';
    for(const [width,dark] of [[390,true],[320,false]]){
        const context=await setup('es',width,dark,false);
        const event={id,user_id:user.id,title:'Pro Session',venue:'Sala X',date:'2030-10-10',start_time:'22:00',end_time:'04:00',status:'confirmed',djs:[],earning_type:'fixed',earning_amount:200,amount_paid:0,currency:'€',color:'#34D399'};
        let writes=0;
        await context.route('**/rest/v1/sessions*',route=>route.fulfill({json:route.request().headers().accept?.includes('vnd.pgrst.object')?event:[event]}));
        await context.route('**/rest/v1/rpc/event_entry_count',route=>route.fulfill({json:0}));
        await context.route('**/rest/v1/rpc/event_guest_list',route=>route.fulfill({json:[]}));
        await context.route('**/rest/v1/rpc/count*',route=>{writes++;return route.fulfill({json:null});});
        await context.route('**/rest/v1/rpc/save_event_guest',route=>{writes++;return route.fulfill({json:null});});
        await page.goto(base+'/home',{waitUntil:'domcontentloaded'});
        await page.getByRole('button',{name:'Crear',exact:true}).waitFor();
        for(const [label,feature] of [['Condicional','conditional'],['Invitados','guests'],['Acceso','access']]){
            await page.getByRole('button',{name:'Crear',exact:true}).click();
            await page.getByRole('button',{name:label,exact:true}).click();
            await page.waitForURL(url=>url.pathname==='/paywall'&&url.searchParams.get('reason')===feature);
            assert.equal(await page.getByTestId('conditional-pro-intro').filter({visible:true}).count(),0);
            assert.equal(await page.getByTestId('pro-feature-example').filter({visible:true}).count(),0);
            const trial=page.getByTestId('pro-trial-card').filter({visible:true});await trial.waitFor();
            assert.equal(await page.getByRole('button',{name:'Probar Pro 15 días gratis',exact:true}).isDisabled(),false);
            assert.ok((await page.locator('body').innerText()).includes('Sin tarjeta'));
            assert.equal(await page.getByTestId('paywall-plans').filter({visible:true}).count(),0);
            assert.ok(!(await page.locator('body').innerText()).includes('14 días'));
            if(feature==='conditional') await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/paywall-15-day-'+width+'.png'});
            await page.getByRole('button',{name:'Seguir con Gratis',exact:true}).click();await page.waitForURL('**/home');
        }
        await page.getByRole('button',{name:/^Pro Session,/}).click();await page.waitForURL('**/session/'+id);
        for(const [label,feature] of [['Acceso','access'],['Invitados','guests']]){
            await page.getByTestId('session-detail-tools').getByRole('button',{name:label,exact:true}).click();
            await page.waitForURL(url=>url.pathname==='/paywall'&&url.searchParams.get('reason')===feature&&url.searchParams.get('sessionId')===id);
            await page.getByRole('button',{name:'Seguir con Gratis',exact:true}).click();await page.waitForURL('**/session/'+id);
        }
        assert.equal(writes,0,'opening the paywall never starts a trial or a purchase');
        await context.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: free Pro functions open paywall directly; 15-day trial precedes paid plans; session context and return preserved; no writes at 320/390 px light/dark');
    await browser.close();
})().catch(async e=>{console.error(e);if(page&&!page.isClosed()){console.error('URL',page.url());console.error((await page.locator('body').innerText()).slice(-3000));}if(browser)await browser.close();process.exitCode=1;});
