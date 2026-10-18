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
    for(const [width,dark] of [[390,true],[320,false]]){
        const context=await setup('es',width,dark,true);
        const rows=[['Paid session',200],['Pending session',0],['Partial session',75]].map(([title,paid],i)=>({id:'00000000-0000-4000-8000-00000000087'+i,user_id:user.id,title,venue:'Sala X',date:'2030-10-10',start_time:'22:00',end_time:'04:00',status:'confirmed',djs:[],earning_type:'fixed',earning_amount:200,amount_paid:paid,currency:'€',color:'#DCEB7D'}));
        await context.route('**/rest/v1/sessions*',route=>route.fulfill({json:rows}));
        await page.goto(base+'/home',{waitUntil:'domcontentloaded'});
        const partial=page.getByRole('button',{name:/^Partial session,/});await partial.waitFor({timeout:30000});
        const paid=page.getByRole('button',{name:/^Paid session,/});
        const pending=page.getByRole('button',{name:/^Pending session,/});
        assert.equal(await partial.getByText('Cobro parcial',{exact:true}).evaluate(n=>getComputedStyle(n).color),dark?'rgb(251, 146, 60)':'rgb(189, 85, 12)');
        assert.equal(await paid.getByText('Cobrado',{exact:true}).evaluate(n=>getComputedStyle(n).color),dark?'rgb(102, 212, 192)':'rgb(8, 139, 121)');
        assert.equal(await pending.getByText('Pendiente de cobro',{exact:true}).evaluate(n=>getComputedStyle(n).color),dark?'rgb(230, 184, 92)':'rgb(149, 100, 20)');
        assert.equal(await paid.getByTestId('session-partial-payment').count(),0);
        assert.equal(await pending.getByTestId('session-partial-payment').count(),0);
        assert.equal(await partial.getByText('200 €',{exact:true}).count(),1,'partial total is shown only once');
        assert.equal(await paid.getByText('200 €',{exact:true}).count(),1,'paid amount remains in its usual position');
        const summary=partial.getByTestId('session-partial-payment');
        for(const text of ['Total','200 €','Cobrado','75 €','Queda','125 €'])assert.equal(await summary.getByText(text,{exact:true}).count(),1);
        const contained=await summary.evaluate(n=>{const b=n.getBoundingClientRect();const card=n.closest('[role="button"]').getBoundingClientRect();return b.x>=card.x&&b.right<=card.right&&b.bottom<=card.bottom;});
        assert.ok(contained,'partial breakdown fits inside the card');
        await partial.scrollIntoViewIfNeeded();await page.waitForTimeout(350);
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/partial-payment-'+width+'.png'});
        await context.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: paid green, pending unchanged, partial orange and total/received/remaining amounts; partial summary only appears on partial cards and fits at 320/390 px');
    await browser.close();
})().catch(async e=>{console.error(e);if(page&&!page.isClosed())console.error((await page.locator('body').innerText()).slice(-2000));if(browser)await browser.close();process.exitCode=1;});
