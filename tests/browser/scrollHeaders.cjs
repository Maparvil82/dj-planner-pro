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

    const base=process.env.BASE_URL || 'http://localhost:8082';
    async function open(path,width=390,dark=true,live=false){
        const context=await setup('es',width,dark,false);
        const events=Array.from({length:20},(_,i)=>({id:'session-'+i,user_id:user.id,title:'Sesión '+i,venue:'Club Demo',date:'2026-10-15',start_time:'20:00',end_time:'23:00',earning_type:'fixed',earning_amount:100,currency:'EUR',status:'confirmed',color:'#DCEB7D',djs:[]}));
        if(live)events.push({...events[0],id:'live',date:'2026-10-12',start_time:'10:00',end_time:'23:00'});
        await context.route('**/rest/v1/sessions*',route=>route.fulfill({json:events}));

        await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:60000});
        if(path==='/home')await page.getByText('Sesión 0',{exact:true}).first().waitFor({timeout:30000});
        else await page.getByTestId('dashboard-basic-statistics').waitFor({timeout:30000});
        await page.waitForTimeout(300);
        await page.evaluate(path=>{window.testScroller=document.querySelector(`[data-testid="${path==='/home'?'sessions-scroll-view':'dashboard-scroll-view'}"]`);if(!window.testScroller)throw Error('No scroll container');},path);
    }
    async function move(y){await page.evaluate(y=>{window.testScroller.scrollTop=y;},y);await page.waitForTimeout(550);}

    for(const [width,dark,live] of [[390,true,false],[320,false,true]]){
        await open('/home',width,dark,live);
        const header=page.getByTestId('scroll-header-hide');
        const bar=page.getByTestId('scroll-tab-bar');
        const initial=(await header.boundingBox()).height;
        assert.ok(initial>=99);
        await move(1);
        assert.ok((await header.boundingBox()).height<1,'first downward pixel hides the entire header');
        assert.equal(await bar.getAttribute('aria-hidden'),'true');
        await page.waitForTimeout(1000);
        assert.ok((await header.boundingBox()).height<1,'stationary header stays hidden');
        assert.equal(await bar.getAttribute('aria-hidden'),'true');
        await move(0);
        assert.ok((await header.boundingBox()).height>=initial-1,'first upward pixel restores header');
        assert.notEqual(await bar.getAttribute('aria-hidden'),'true');
        const heights=await page.evaluate(async()=>{
            window.testScroller.scrollTop=window.testScroller.scrollHeight;
            const samples=[];
            for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,15));samples.push(document.querySelector('[data-testid="scroll-header-hide"]').getBoundingClientRect().height);}
            return samples;
        });
        assert.ok(heights.some(h=>h>0&&h<initial),'header transitions through intermediate heights');
        await page.waitForTimeout(1000);
        assert.equal(await bar.getAttribute('aria-hidden'),'true','bottom stays hidden despite changing viewport');
        assert.ok((await header.boundingBox()).height<1);
        await move(await page.evaluate(()=>window.testScroller.scrollTop-1));
        assert.notEqual(await bar.getAttribute('aria-hidden'),'true','upward pixel at bottom shows menu');
        assert.ok((await header.boundingBox()).height>=initial-1,'upward scroll at bottom restores full header');
        await header.getByRole('button',{name:'Lugares',exact:true}).click();await page.waitForURL('**/venues');
        await page.getByTestId('scroll-header-hide').filter({hasText:'Lugares'}).waitFor();
    }
    await open('/dashboard');
    const header=page.getByTestId('scroll-header-hide');
    const initial=(await header.boundingBox()).height;
    await move(1);assert.ok((await header.boundingBox()).height<1);
    await page.waitForTimeout(1000);assert.ok((await header.boundingBox()).height<1);
    await move(0);assert.ok((await header.boundingBox()).height>=initial-1);
    assert.deepEqual(errors,[]);
    console.log('PASS: full headers and bottom menu hide on the first downward pixel, stay hidden when stopped/at bottom and restore on the first upward pixel in Sessions (320/390 px) and Dashboard; smooth intermediate frames and navigation preserved');
    await browser.close();
})().catch(async e=>{console.error(e);if(page)console.error((await page.locator('body').innerText()).slice(-2000));if(browser)await browser.close();process.exitCode=1;});
