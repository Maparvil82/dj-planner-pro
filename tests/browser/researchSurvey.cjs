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






    const out=require('node:path').resolve(__dirname,'../../../outputs/cuestionario-autonomos/pruebas');
    const resources=Object.fromEntries(['es','en','de','fr','it','pt','ja'].map(lang=>[lang,JSON.parse(fs.readFileSync(require('node:path').resolve(__dirname,'../../src/i18n/languages/'+lang+'.json'),'utf8'))]));
    let saved=null,attempts=0,posts=[];
    async function fixture(context) {
        await context.addInitScript(id=>localStorage.setItem(`whats-new:${id}:1.0.6:calendar-r1`,'seen'),user.id);
        await context.route('**/*.supabase.co/**',async route=>{
            const req=route.request(),path=new URL(req.url()).pathname;let body;
            if(path.endsWith('/research_survey_responses')) {
                if(req.method()==='POST') {
                    attempts++;
                    if(attempts===1){await route.fulfill({status:503,json:{message:'Offline fixture'}});return;}
                    saved={...req.postDataJSON(),submitted_at:'2026-11-03T18:00:00Z'};posts.push(saved);
                    await route.fulfill({status:201,json:null});return;
                }
                body=saved?[saved]:[];
            }
            else if(path.endsWith('/rpc/session_screen_page'))body={sessions:[],nextCursor:null};
            else if(path.endsWith('/rpc/session_screen_context'))body={reviewCount:1,currencies:['EUR'],firstCompleted:{zoco:1790000000000},aging:[]};
            else if(path.endsWith('/rpc/dashboard_expenses')||path.endsWith('/product_updates'))body=[];
            else {await route.fallback();return;}
            await route.fulfill({json:body});
        });
    }
    const base=process.env.BASE_URL||'http://localhost:8084';
    const context=await setup('es',390,true,false);await fixture(context);
    await page.goto(base+'/dashboard',{waitUntil:'domcontentloaded',timeout:90000});
    const card=page.getByTestId('research-invitation-card');await card.waitFor({timeout:60000});await card.scrollIntoViewIfNeeded();await card.click();
    await page.getByTestId('research-participate').click();await page.waitForURL('**/research-survey');
    const next=page.getByTestId('survey-next');
    await page.getByTestId('survey-option-self_employed').waitFor();assert(await next.isDisabled());
    await page.screenshot({path:out+'/01-perfil-es.png'});
    await page.getByTestId('survey-option-self_employed').click();await next.click();
    await page.getByTestId('survey-option-one_two').click();await next.click();
    await page.getByTestId('survey-text-answer').fill('Me costó coordinar el cobro; lo resolví hablando con el responsable.');
    await page.getByRole('button',{name:'Guardar y salir',exact:true}).click();await page.waitForURL('**/dashboard');
    await page.getByTestId('research-invitation-card').scrollIntoViewIfNeeded();await page.getByTestId('research-invitation-card').click();await page.waitForURL('**/research-survey');
    await page.getByTestId('survey-text-answer').waitFor();assert((await page.getByTestId('survey-text-answer').inputValue()).includes('coordinar'));
    await next.click();await page.getByTestId('survey-option-calendar').click();await page.getByTestId('survey-option-none').click();assert.notEqual(await page.getByTestId('survey-option-calendar').getAttribute('aria-checked'),'true');
    await page.getByTestId('survey-option-calendar').click();assert.notEqual(await page.getByTestId('survey-option-none').getAttribute('aria-checked'),'true');
    await next.click();await page.getByTestId('survey-option-one_three').click();await next.click();
    await page.getByTestId('survey-option-payments_due').click();await page.getByTestId('survey-option-expense_receipts').click();await page.getByTestId('survey-option-invoices').click();
    assert(await page.getByTestId('survey-option-cash_forecast').isDisabled());
    await page.screenshot({path:out+'/02-prioridades-es.png'});
    await page.getByTestId('survey-option-invoices').click();await next.click();assert(await next.isDisabled());
    await page.getByTestId('survey-option-payments_due').click();await next.click();await next.click();
    await page.getByRole('heading',{name:'Revisa tus respuestas',exact:true}).waitFor();
    await page.screenshot({path:out+'/03-revision-es.png'});
    await next.click();await page.getByRole('alert').filter({hasText:'No hemos podido confirmar el envío.'}).waitFor();
    await next.click();await page.getByRole('heading',{name:'Gracias por compartir tu experiencia'}).waitFor();
    assert.equal(posts.length,1);assert.equal(saved.language,'es');assert.equal(saved.answers.first,'payments_due');assert.equal(saved.answers.priorities.length,2);
    await page.screenshot({path:out+'/04-enviado-es.png'});
    await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Gracias por compartir tu experiencia'}).waitFor();assert.equal(posts.length,1);
    await context.close();
    for (const lang of (process.env.SURVEY_LANGUAGES ? process.env.SURVEY_LANGUAGES.split(',') : ['en','de','fr','it','pt','ja'])) {
        saved=null;const ctx=await setup(lang,320,false,false);await fixture(ctx);
        await page.goto(base+'/research-survey',{waitUntil:'domcontentloaded',timeout:90000});
        await page.getByRole('heading',{name:resources[lang].researchSurvey.profile,exact:true}).waitFor({timeout:60000});
        await page.screenshot({path:out+'/perfil-'+lang+'.png'});
        if(lang==='ja'){
            await page.getByTestId('survey-option-self_employed').click();await page.getByTestId('survey-next').click();
            await page.getByTestId('survey-option-none').click();await page.getByTestId('survey-next').click();
            await page.getByRole('heading',{name:resources.ja.researchSurvey.tools,exact:true}).waitFor();
            await page.getByTestId('survey-option-none').click();await page.getByTestId('survey-next').click();
            await page.getByTestId('survey-option-unknown').click();await page.getByTestId('survey-next').click();
            await page.getByTestId('survey-option-none').click();await page.getByTestId('survey-next').click();
            await page.getByRole('heading',{name:resources.ja.researchSurvey.additional,exact:true}).waitFor();
            await page.getByTestId('survey-next').click();await page.getByRole('heading',{name:resources.ja.researchSurvey.reviewTitle,exact:true}).waitFor();
            await page.getByTestId('survey-next').click();await page.getByRole('heading',{name:resources.ja.researchSurvey.sentTitle,exact:true}).waitFor();
            assert.equal(saved.language,'ja');assert(!('first' in saved.answers));assert(!('recent' in saved.answers));
        }
        await ctx.close();
    }
    assert.deepEqual(errors,[]);console.log('PASS: invitation → survey, drafts, constraints, review, failed send retry, confirmed save, duplicate prevention, all seven languages and Japanese conditional flow.');
    await browser.close();
})().catch(async e=>{console.error(e);if(page){console.error((await page.locator('body').innerText()).slice(-3000));await page.screenshot({path:'/tmp/dj-survey-error.png'}).catch(()=>{});}await browser?.close();process.exit(1);});
