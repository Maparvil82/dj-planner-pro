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






    const out=require('node:path').resolve(__dirname,'../../../outputs/invitacion-autonomos');
    for (const [dark,width] of [[true,390],[false,320]]) {
        const context=await setup('es',width,dark,false);
        await context.addInitScript(id=>{
            localStorage.setItem(`whats-new:${id}:1.0.6:calendar-r1`,'seen');
            if(!localStorage.getItem(`research-invitation:v1:${id}`))localStorage.setItem(`research-invitation:v1:${id}`,JSON.stringify({updatesVisit:'previous-visit'}));
        },user.id);
        await context.route('**/*.supabase.co/**',async route=>{
            const url=new URL(route.request().url());let body;
            if(url.pathname.endsWith('/rpc/session_screen_page'))body={sessions:[],nextCursor:null};
            else if(url.pathname.endsWith('/rpc/session_screen_context'))body={reviewCount:1,currencies:['EUR'],firstCompleted:{zoco:1790000000000},aging:[]};
            else if(url.pathname.endsWith('/rpc/dashboard_expenses')||url.pathname.endsWith('/product_updates')||url.pathname.endsWith('/research_survey_responses'))body=[];
            else {await route.fallback();return;}
            await route.fulfill({json:body});
        });
        await page.goto((process.env.BASE_URL||'http://localhost:8084')+'/dashboard',{waitUntil:'domcontentloaded',timeout:90000});
        const card=page.getByTestId('research-invitation-card');
        await card.waitFor({timeout:60000});
        assert.equal(await page.getByTestId('research-invitation-modal').count(),0,'No invitation on dashboard entry');
        await card.scrollIntoViewIfNeeded();
        await page.screenshot({path:out+`/card-${dark?'dark':'light'}.png`});
        await card.click();
        const modal=page.getByTestId('research-invitation-modal');
        await modal.waitFor();
        await page.getByRole('heading',{name:'Hagamos DJ Planner más útil para ti'}).waitFor();
        await page.waitForTimeout(350); // Let the modal fade finish before capturing its appearance.
        const bounds=await modal.boundingBox();
        assert.equal(bounds.x,0); assert.equal(bounds.y,0);
        assert.equal(bounds.width,width); assert.equal(bounds.height,844);
        await page.screenshot({path:out+`/modal-${dark?'dark':'light'}.png`});
        await modal.getByRole('button',{name:'Ahora no',exact:true}).click();
        await modal.waitFor({state:'hidden'});
        let record=await page.evaluate(id=>JSON.parse(localStorage.getItem(`research-invitation:v1:${id}`)),user.id);
        assert.equal(record.shown,true);
        assert.equal(record.interested,undefined);
        await card.click();
        await page.getByTestId('research-participate').click();
        await page.waitForURL('**/research-survey');
        await page.getByTestId('survey-option-self_employed').waitFor();
        record=await page.evaluate(id=>JSON.parse(localStorage.getItem(`research-invitation:v1:${id}`)),user.id);
        assert.equal(record.interested,true);
        await page.getByRole('button',{name:'Guardar y salir',exact:true}).click();
        await page.waitForURL('**/dashboard');
        await page.reload({waitUntil:'domcontentloaded'});
        await page.getByText('Ayúdanos a elegir las próximas mejoras. Puedes continuar el cuestionario donde lo dejaste.',{exact:true}).waitFor();
        assert.equal(await page.getByTestId('research-invitation-modal').count(),0);
        await context.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: invitation card, manual modal, dismiss without opt-in, reopen, save interest, persisted choice; light 320 and dark 390, no automatic interruption or page errors.');
    await browser.close();
})().catch(async e=>{console.error(e);if(page){console.error((await page.locator('body').innerText()).slice(-3000));await page.screenshot({path:'/tmp/dj-research-error.png'}).catch(()=>{});}await browser?.close();process.exit(1);});
