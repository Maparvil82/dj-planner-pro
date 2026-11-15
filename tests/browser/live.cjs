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
    const token = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 604800, role: 'authenticated' })}.${enc('fixture')}`;
    const session = {
        access_token: token,
        refresh_token: 'fixture',
        expires_in: 604800,
        expires_at: Math.floor(Date.now() / 1000) + 604800,
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

    const context = await setup('es',390,false,false);
    await page.clock.setFixedTime(new Date('2026-10-11T01:00:00+02:00'));
    const labels=JSON.parse(fs.readFileSync('src/i18n/languages/es.json','utf8'));
    const id='00000000-0000-4000-8000-000000000919';
    const event={id,user_id:user.id,title:'Soul Night',venue:'Sala X',date:'2026-10-10',booking_timezone:'Europe/Madrid',start_time:'22:00',end_time:'04:00',status:'confirmed',currency:'€',earning_type:'free',recurrence_type:'none',djs:[]};
    let running=true, admissions=12, guestCalls=0, entryCalls=0;
    let guests=[{id:'guest-1',session_id:id,full_name:'Manuel Parra',companions:3,total:4,admitted:2,revision:1},{id:'guest-2',session_id:id,full_name:'Ana Lopez',companions:0,total:1,admitted:0,revision:1}];
    await context.route('**/rest/v1/sessions*',r=>r.fulfill({json:[{...event,...(!running ? {date:'2026-10-09'} : {})}]}));
    await context.route('**/rest/v1/rpc/event_entry_count',r=>{entryCalls++;return r.fulfill({json:admissions});});
    await context.route('**/rest/v1/rpc/event_guest_list',r=>{guestCalls++;return r.fulfill({json:guests});});
    await page.goto('http://localhost:8081/home');
    const liveButton=page.getByRole('button',{name:labels.live.title,exact:true});
    await liveButton.waitFor();
    const liveBox=await liveButton.boundingBox();
    const placesBox=await page.getByRole('button',{name:labels.venues_title,exact:true}).boundingBox();
    assert.ok(liveBox.x < placesBox.x && Math.abs(liveBox.y-placesBox.y)<2);
    await liveButton.click();
    await page.getByTestId('live-entries').filter({hasText:/^12$/}).waitFor();
    await page.getByText('Han accedido 2 de 5 invitados · Pendientes: 3',{exact:true}).waitFor();
    await page.getByText('Manuel Parra +3',{exact:true}).waitFor();
    await page.getByText('2 de 4 han accedido',{exact:true}).waitFor();
    admissions=15; guests=[{...guests[0],admitted:4},guests[1]];
    await page.getByTestId('live-entries').filter({hasText:/^15$/}).waitFor({timeout:20000});
    await page.getByText('Han accedido 4 de 5 invitados · Pendientes: 1',{exact:true}).waitFor();
    assert.ok(entryCalls>=2 && guestCalls>=2);
    await page.screenshot({path:'/private/tmp/djplanner-live.png'});
    await page.getByRole('textbox',{name:labels.guests.search,exact:true}).fill('Ana');
    await page.getByText('Ana Lopez',{exact:true}).waitFor();
    assert.equal(await page.getByText('Manuel Parra +3',{exact:true}).count(),0);
    running=false;
    await page.goto('http://localhost:8081/home');
    await page.getByRole('tab',{name:labels.community.sessions,exact:true}).waitFor();
    assert.equal(await liveButton.count(),0);
    await page.goto('http://localhost:8081/live');
    await page.getByText(labels.live.noSession,{exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS: Live header adjacency, overnight availability, separate entries and guest counts, 10-second refresh, guest search, ended session hides Live');
    await browser.close();
})().catch(async e=>{console.error(e);if(page) console.error(await page.locator('body').innerText());if(browser) await browser.close();process.exitCode=1;});
