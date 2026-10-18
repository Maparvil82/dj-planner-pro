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
    for(const [width,dark] of [[390,true],[320,false]]){
        const context=await setup('es',width,dark,true);
        const event={id,user_id:user.id,title:'Session With Tools',venue:'Sala X',date:'2030-10-10',start_time:'22:00',end_time:'04:00',status:'confirmed',djs:[],earning_type:'fixed',earning_amount:200,amount_paid:0,currency:'€',color:'#34D399'};
        const empty={...event,id:'00000000-0000-4000-8000-000000000872',title:'Empty Session'};
        let count=8;
        let invitations=[];
        await context.route('**/rest/v1/rpc/door_manage',route=>{
            const input=route.request().postDataJSON();
            if(input.p_action==='create'){assert.equal(input.p_session,id);invitations=[{id:input.p_id,label:input.p_label,claimed_at:null,revoked_at:null,qr_count:0,manual_count:0,guest_count:0}];}
            return route.fulfill({json:invitations});
        });
        await context.route('**/rest/v1/sessions*',route=>route.fulfill({json:route.request().headers().accept?.includes('vnd.pgrst.object')?event:[event,empty]}));
        await context.route('**/rest/v1/rpc/event_guest_list',route=>route.fulfill({json:route.request().postDataJSON().p_session===id?[{id:'guest',session_id:id,full_name:'Private guest name',companions:2,total:3,admitted:1}]:[]}));
        await context.route('**/rest/v1/rpc/event_entry_count',route=>route.fulfill({json:route.request().postDataJSON().p_session===id?count:0}));
        await context.route('**/rest/v1/rpc/count_manual_event_entry',route=>route.fulfill({json:{status:'accepted',count:++count,checked_in_at:new Date().toISOString()}}));
        await context.route('**/rest/v1/session_tasks*',route=>route.fulfill({json:[{session_id:id,completed:true},{session_id:id,completed:false}]}));
        await page.goto(base+'/home',{waitUntil:'domcontentloaded'});
        const card=page.getByRole('button',{name:/^Session With Tools,/});
        await card.getByTestId('session-access-badge').waitFor();
        assert.equal(await card.getByTestId('session-access-badge').innerText(),'Accesos: 8');
        assert.equal(await card.getByTestId('session-guest-badge').innerText(),'Invitados: 3 · Han entrado: 1');
        await card.getByTestId('session-task-badge').waitFor();
        assert.equal(await card.getByTestId('session-task-badge').innerText(),'Completadas: 1 · Pendientes: 1');
        assert.equal(await card.getByText('Private guest name').count(),0);
        const emptyCard=page.getByRole('button',{name:/^Empty Session,/});
        assert.equal(await emptyCard.getByTestId('session-guest-badge').count(),0);
        assert.equal(await emptyCard.getByTestId('session-access-badge').count(),0);
        await card.scrollIntoViewIfNeeded();await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/session-tools-summary-'+width+'.png'});
        await card.click();await page.waitForURL('**/session/'+id);
        assert.equal(await page.getByTestId('session-detail-scroll').getByTestId('session-guest-badge').count(),0);
        assert.equal(await page.getByTestId('session-detail-scroll').getByTestId('session-access-badge').count(),0);
        await page.getByTestId('session-detail-tools').getByRole('button',{name:'Acceso',exact:true}).click();
        await page.waitForURL(url=>url.pathname==='/tickets');
        await page.getByRole('link',{name:'Dar control a puerta',exact:true}).click();
        await page.waitForURL(url=>url.pathname==='/door-access'&&url.searchParams.get('sessionId')===id);
        await page.getByRole('textbox',{name:'Nombre o puesto · Carlos, puerta principal',exact:true}).fill('Puerta principal');
        await page.getByRole('button',{name:'Crear invitación',exact:true}).click();
        await page.getByRole('button',{name:'Compartir invitación',exact:true}).waitFor();
        assert.equal(invitations.length,1);
        await page.getByRole('button',{name:'Volver',exact:true}).click();await page.waitForURL(url=>url.pathname==='/tickets');
        await page.getByRole('button',{name:'Añadir acceso · +1',exact:true}).click();
        await page.getByRole('button',{name:'Volver',exact:true}).click();await page.waitForURL('**/session/'+id);
        await page.getByRole('button',{name:'Volver atrás',exact:true}).click();await page.waitForURL('**/home');
        await card.getByText('Accesos: 9',{exact:true}).waitFor();
        await context.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: task/guest/access card summaries, companions included, no guest names, empty badges hidden, no new detail sections, manual admission refresh at 320/390 px');
    await browser.close();
})().catch(async e=>{console.error(e);if(page&&!page.isClosed())console.error((await page.locator('body').innerText()).slice(-2400));if(browser)await browser.close();process.exitCode=1;});
