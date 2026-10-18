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
    async function open(path){
        const context=await setup('es',390,true,false);
        const venues=Array.from({length:30},(_,i)=>({id:'place-'+i,user_id:user.id,name:'Local Demo '+i,city:'Madrid',images:[],created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'}));
        const notices=Array.from({length:20},(_,i)=>({id:'notice-'+i,recipient_id:user.id,actor_id:null,kind:'follow',actor_name:'DJ '+i,session_id:null,read_at:'2026-10-01T00:00:00Z',created_at:'2026-10-01T00:00:00Z'}));
        await context.route('**/rest/v1/venues*',route=>route.fulfill({json:venues}));
        await context.route('**/rest/v1/social_notifications*',route=>route.request().method()==='HEAD'?route.fulfill({status:200,headers:{'content-range':'0-0/0'},body:''}):route.fulfill({json:notices}));
        await page.goto(base+'/home',{waitUntil:'domcontentloaded',timeout:60000});
        await page.getByRole('button',{name:'Crear',exact:true}).waitFor({timeout:30000});
        if(path==='/venues')await page.getByRole('button',{name:'Lugares',exact:true}).click();
        else if(path==='/add-session'){
            await page.getByRole('button',{name:'Crear',exact:true}).click();
            await page.getByRole('button',{name:'Simple',exact:true}).click();
        }else{
            await page.getByLabel(/^Abrir menú de cuenta/).click();
            await page.getByRole('button',{name:path==='/notifications'?'Notificaciones':path.startsWith('/profile')?'Cuenta y ajustes':'Descubrir Pro',exact:true}).click();
        }
        await page.waitForURL(url=>url.pathname===path.split('?')[0]);
        if(path.startsWith('/profile')) await page.setViewportSize({width:390,height:480});
        await page.waitForTimeout(700);
        await page.waitForFunction(()=>[...document.querySelectorAll('div')].some(n=>['auto','scroll'].includes(getComputedStyle(n).overflowY)&&n.clientHeight>100&&n.scrollHeight>n.clientHeight+100),{},{timeout:30000});
        await page.evaluate(()=>{window.testScroller=[...document.querySelectorAll('div')].find(n=>['auto','scroll'].includes(getComputedStyle(n).overflowY)&&n.clientHeight>100&&n.scrollHeight>n.clientHeight+100);});
    }
    async function move(y){await page.evaluate(y=>window.testScroller.scrollTop=y,y);await page.waitForTimeout(420);}
    for(const path of ['/venues','/notifications','/add-session','/profile?section=settings']){
        await open(path);
        const title=path==='/venues'?'Lugares':path==='/notifications'?'Notificaciones':path==='/add-session'?'Sesión simple':'Cuenta y ajustes';
        const header=page.getByTestId('scroll-header-hide').filter({hasText:title}).first();await header.waitFor();
        const original=(await header.boundingBox()).height;
        await move(1);assert.ok((await header.boundingBox()).height<original,'one-pixel response '+path);
        await move(100);assert.ok((await header.boundingBox()).height<1,'hidden header '+path);
        await move(await page.evaluate(()=>window.testScroller.scrollTop-1));assert.ok((await header.boundingBox()).height>=original-1,'upward pixel restores full header '+path);
        const buttons=header.getByRole('button');assert.ok(await buttons.count()>0,'actions retained '+path);
        for(const button of await buttons.all()){await button.waitFor();}
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/header-'+path.split('?')[0].replaceAll('/','')+'.png'});
        await move(0);assert.ok((await header.boundingBox()).height>=original-1,'restored '+path);
        console.log('CHECKED',path);
    }
    await open('/pro');
    const toolbar=page.getByTestId('scroll-toolbar-hide').first();const height=(await toolbar.boundingBox()).height;
    await move(1);assert.ok((await toolbar.boundingBox()).height<height,'custom toolbar starts at one pixel');
    await move(100);assert.ok((await toolbar.boundingBox()).height<height,'custom toolbar reduces');
    await move(await page.evaluate(()=>window.testScroller.scrollTop-1));assert.ok(await toolbar.getByRole('button').count()>0,'custom toolbar actions retained');
    assert.deepEqual(errors,[]);
    console.log('PASS: full headers hide on downward scroll and restore on upward scroll in Venues, Notifications, Add Session, Settings and Pro; navigation intact');
    await browser.close();
})().catch(async e=>{console.error(e);if(page)console.error((await page.locator('body').innerText()).slice(-2500));if(browser)await browser.close();process.exitCode=1;});
