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
    const labels = JSON.parse(fs.readFileSync('src/i18n/languages/es.json','utf8'));
    const id='00000000-0000-4000-8000-000000000919';
    const event={id,user_id:user.id,title:'Soul Night',venue:'Sala X',date:'2026-10-10',start_time:'22:00',end_time:'04:00',status:'confirmed',currency:'€',earning_type:'free',recurrence_type:'none',djs:[]};
    await context.route('**/rest/v1/sessions*',r=>r.fulfill({json:r.request().headers().accept?.includes('vnd.pgrst.object') ? event : [event, {...event,id:'00000000-0000-4000-8000-000000000920',title:'Future Session',date:'2026-10-12'}, {...event,id:'00000000-0000-4000-8000-000000000921',title:'Past Session',date:'2026-10-09'}, {...event,id:'00000000-0000-4000-8000-000000000922',title:'Cancelled Session',date:'2026-10-12',status:'cancelled'}]}));
    const seen=new Set(), manual=new Set();
    let failManual=true;
    await context.route('**/rest/v1/rpc/event_entry_count',r=>r.fulfill({json:seen.size+manual.size}));
    await context.route('**/rest/v1/rpc/count_event_entry',r=>{
        const p=r.request().postDataJSON();
        assert.equal(p.p_session,id); assert.match(p.p_hash,/^[0-9a-f]{64}$/);
        assert.equal(Object.hasOwn(p,'code'),false);
        const duplicate=seen.has(p.p_hash); seen.add(p.p_hash);
        return r.fulfill({json:{status:duplicate?'already_used':'accepted',count:seen.size+manual.size,checked_in_at:'2026-10-10T20:00:00Z'}});
    });
    await context.route('**/rest/v1/rpc/count_manual_event_entry',async r=>{
        const p=r.request().postDataJSON();
        assert.equal(p.p_session,id); manual.add(p.p_request);
        if(failManual){failManual=false;await r.abort('failed');return;}
        await r.fulfill({json:{status:'accepted',count:seen.size+manual.size,checked_in_at:'2026-10-10T20:00:00Z'}});
    });
    await page.goto('http://localhost:8081/tickets?sessionId='+id);
    await page.getByText(labels.entryCounter.countLabel,{exact:true}).waitFor();
    assert.equal(await page.getByText(labels.tickets.tab_issue,{exact:true}).count(),0);
    await page.getByText(labels.tickets.scan,{exact:true}).last().click();
    const qr=page.getByRole('textbox',{name:labels.tickets.manualQr});
    await qr.fill('https://external.invalid/entry/ABC');
    await page.getByText(labels.tickets.validate,{exact:true}).click();
    await page.getByText(labels.entryCounter.result_accepted,{exact:true}).waitFor();
    await page.getByText('Total: 1',{exact:true}).waitFor();
    await page.getByText(labels.tickets.scanNext,{exact:true}).click();
    await qr.fill('https://external.invalid/entry/ABC');
    await page.getByText(labels.tickets.validate,{exact:true}).click();
    await page.getByText(labels.entryCounter.result_already_used,{exact:true}).waitFor();
    assert.equal(seen.size,1);
    await page.getByText(labels.tickets.scanNext,{exact:true}).click();
    await qr.fill('another-platform:XYZ');
    await page.getByText(labels.tickets.validate,{exact:true}).click();
    await page.getByText('Total: 2',{exact:true}).waitFor();
    await page.goto('http://localhost:8081/tickets?sessionId='+id);
    await page.getByText(labels.entryCounter.countLabel,{exact:true}).waitFor();
    await page.getByText('2',{exact:true}).waitFor();
    await page.getByText(labels.entryCounter.addManual,{exact:true}).click();
    await page.getByText(labels.tickets.connectionError,{exact:true}).waitFor();
    await page.getByText(labels.entryCounter.retryManual,{exact:true}).click();
    await page.getByText('3',{exact:true}).waitFor();
    assert.equal(manual.size,1);
    await page.getByText(labels.entryCounter.addManual,{exact:true}).click();
    await page.getByText('4',{exact:true}).waitFor();
    assert.equal(manual.size,2);
    await page.screenshot({path:'/private/tmp/djplanner-entry-counter.png'});
    await page.goto('http://localhost:8081/tickets');
    await page.getByText('Soul Night',{exact:true}).waitFor();
    await page.getByText('Future Session',{exact:true}).waitFor();
    assert.equal(await page.getByText('Past Session',{exact:true}).count(),0);
    assert.equal(await page.getByText('Cancelled Session',{exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: counter UI, arbitrary provider QR, hashed request, duplicate stays at one, second code, persisted reload');
    await browser.close();
})().catch(async e=>{console.error(e); if(page){console.error(await page.locator('body').innerText());await page.screenshot({path:'/private/tmp/entry-counter-failure.png'});} if(browser) await browser.close();process.exitCode=1;});
