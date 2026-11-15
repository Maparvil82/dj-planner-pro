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

    await setup('es',390,true,false);
    await page.goto(process.env.BASE_URL || 'http://localhost:8082/dashboard',{waitUntil:'domcontentloaded',timeout:60000});
    const bar=page.getByTestId('scroll-tab-bar');
    await bar.waitFor({timeout:30000});
    await page.getByTestId('dashboard-basic-statistics').waitFor();
    await page.waitForTimeout(300);
    await page.evaluate(()=>{
        window.testScroller=[...document.querySelectorAll('div')].find(n=>['auto','scroll'].includes(getComputedStyle(n).overflowY)&&n.scrollHeight>n.clientHeight+300);
        if(!window.testScroller)throw new Error('No vertical dashboard scroll container');
    });
    async function move(y){
        return page.evaluate(async y=>{
            window.testScroller.scrollTop=y;
            await new Promise(r=>setTimeout(r,60));
            return document.querySelector('[data-testid="scroll-tab-bar"]').getAttribute('aria-hidden');
        },y);
    }
    assert.equal(await move(100),'true','first downward movement hides the menu');
    assert.equal(await move(101),'true','downward movement stays hidden');
    assert.notEqual(await move(100),'true','one-pixel upward movement reveals the menu');
    assert.equal(await move(200),'true');
    await page.waitForTimeout(250);
    assert.equal(await bar.getAttribute('aria-hidden'),'true','stopping midway keeps the menu hidden');

    const bottom=await page.evaluate(()=>window.testScroller.scrollHeight-window.testScroller.clientHeight);
    assert.equal(await move(bottom),'true','reaching the bottom keeps navigation hidden');
    assert.notEqual(await move(bottom-1),'true','upward movement at the bottom reveals navigation');
    await page.waitForTimeout(200);
    const box=await bar.boundingBox();assert.ok(box.y+box.height<=844+1,'menu animation has completed');
    assert.notEqual(await move(0),'true','top of the page always shows navigation');
    await bar.getByText('Sesiones',{exact:true}).click();
    await page.waitForURL('**/home');
    assert.notEqual(await bar.getAttribute('aria-hidden'),'true','changing tabs keeps navigation visible');
    assert.deepEqual(errors,[]);
    console.log('PASS: immediate down/up response, stationary/bottom persistence, upward restoration, finished animation and tab switching');
    await browser.close();
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});
