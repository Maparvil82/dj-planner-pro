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
    async function setup(lang = 'es', width = 390, dark = false, pro = false, trial = {status:'available'}) {
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
        const access=()=>({count:12,limit:15,remaining:3,isPro:pro||trial.status==='active',paidPro:pro,serverNow:'2026-10-12T12:00:00Z',trial:{status:trial.status,eligible:trial.status==='available',startedAt:trial.status==='available'?null:'2026-10-01T12:00:00Z',expiresAt:trial.status==='available'?null:trial.expiresAt||'2026-10-27T12:00:00Z'}});
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
            else if (url.pathname.includes('/start_pro_trial')) { trial.status='active'; body=access(); }
            else if (url.pathname.includes('/subscription-access') || url.pathname.includes('/get_session_usage')) body=access();
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

    const base=process.env.BASE_URL || 'http://localhost:8081';
    const gig=(id,title,venue,fee,date='2026-10-02',extra={})=>({id,user_id:user.id,title,venue,venue_id:venue==='Club A'?'club-a':'club-b',date,start_time:'20:00',end_time:'22:00',booking_timezone:'UTC',earning_type:'fixed',earning_amount:fee,currency:'EUR',status:'confirmed',djs:[],color:'#DCEB7D',...extra});
    const events=[gig('a','Noche A','Club A',300,'2026-10-02',{amount_paid:100}),gig('b','Noche B','Club B',200,'2026-10-05',{amount_paid:200}),gig('old','Noche antigua','Club A',100,'2026-06-01',{amount_paid:25}),gig('usd','USD gig','Club B',900,'2026-10-03',{currency:'USD'}),gig('future','Futura','Club A',999,'2026-10-20')];
    const costs=[{id:'expense-a',user_id:user.id,session_id:'a',amount:90,date:'2026-10-02',currency:'EUR'},{id:'expense-b',user_id:user.id,session_id:'b',amount:20,date:'2026-10-05',currency:'EUR'},{id:'general',user_id:user.id,session_id:null,amount:30,date:'2026-10-05',currency:'EUR'},{id:'included',user_id:user.id,session_id:'a',amount:100,date:'2026-10-05',currency:'EUR',included_in_agreement:true}];
    async function fixture({pro=true,width=390,dark=true,expenseError=false,accessError=false,empty=false,lang='es',trial={status:'available'}}={}){
        const context=await setup(lang,width,dark,pro,trial);
        await context.route('**/rest/v1/sessions*',route=>{const url=new URL(route.request().url());const id=url.searchParams.get('id')?.replace('eq.','');return route.fulfill({json:empty?[]:id?events.find(s=>s.id===id):events});});
        await context.route('**/rest/v1/expenses*',route=>expenseError?route.fulfill({status:500,json:{message:'fixture expense error'}}):route.fulfill({json:empty?[]:costs}));
        if(accessError){
            await context.route('**/functions/v1/subscription-access',route=>route.fulfill({status:500,json:{error:'fixture access error'}}));
            await context.route('**/rest/v1/rpc/get_session_usage',route=>route.fulfill({status:500,json:{message:'fixture access error'}}));
        }
        await page.clock.setFixedTime(new Date('2026-10-12T12:00:00Z'));
        await page.goto(base+'/dashboard',{waitUntil:'domcontentloaded',timeout:60000});
        return context;
    }
    await fixture();
    const margin=page.getByTestId('dashboard-analytics-margin');
    await page.getByTestId('dashboard-activity').getByText('Evolución',{exact:true}).waitFor({timeout:30000});
    await page.getByTestId('dashboard-payment-status').getByText('Cobro de tus sesiones',{exact:true}).waitFor();
    await margin.getByText(/390/).waitFor({timeout:30000});
    await margin.getByText(/30.*No se reparten/).waitFor();
    await margin.getByRole('button',{name:'Ver sesiones',exact:true}).click();
    await margin.getByRole('button',{name:/Noche A,.*Club A/}).waitFor();
    await margin.getByRole('button',{name:/Noche B,.*Club B/}).waitFor();
    await margin.getByText(/Caché:.*300.*Gastos:.*90/).waitFor();
    assert.equal(await margin.getByText('Futura',{exact:true}).count(),0);
    await margin.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/dashboard-analytics-margin.png'});
    const venues=page.getByTestId('dashboard-analytics-venues');
    await venues.getByRole('button',{name:'Margen por hora',exact:true}).click();
    await venues.getByRole('button',{name:/Club A/}).first().click();
    await venues.getByRole('button',{name:/Noche A,.*Club A/}).waitFor();
    const trend=page.getByTestId('dashboard-analytics-trend');
    await trend.getByRole('button',{name:'3 meses',exact:true}).click();
    await trend.getByText(/250/).waitFor();
    await trend.getByRole('button',{name:'12 meses',exact:true}).click();
    await trend.getByText(/Noche antigua/).count();
    const aging=page.getByTestId('dashboard-analytics-aging');
    await aging.getByRole('button',{name:/Más de 90 días/}).click();
    await aging.getByRole('button',{name:/Noche antigua,.*Club A/}).waitFor();
    await aging.getByText(/75/).first().waitFor();
    const concentration=page.getByTestId('dashboard-analytics-concentration');
    await concentration.getByText(/60.*%/).first().waitFor();
    await concentration.getByRole('button',{name:/Club A.*60/}).click();
    await concentration.getByRole('button',{name:/Noche A,.*Club A/}).waitFor();
    await concentration.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/dashboard-analytics-concentration.png'});
    await concentration.getByRole('button',{name:/Noche A,.*Club A/}).click();
    await page.waitForURL('**/session/a');
    assert.deepEqual(errors,[]);
    assert.equal(await page.getByTestId('dashboard-analytics-locked').count(),0,'paid subscribers see all statistics');
    await fixture({pro:false});
    await page.getByTestId('dashboard-basic-statistics').waitFor();
    assert.equal(await page.getByTestId('dashboard-activity').count(),0,'Evolución requires Pro');
    assert.equal(await page.getByTestId('dashboard-payment-status').count(),0,'payment status now also requires Pro');
    const locked=page.getByTestId('dashboard-analytics-locked');
    await locked.waitFor();
    assert.equal(await page.getByTestId('dashboard-pro-statistics').count(),0);
    for(const key of ['margin','venues','trend','aging','concentration']) assert.equal(await page.getByTestId(`dashboard-analytics-${key}`).count(),0,'locked data and controls must not mount');
    assert.ok(await page.getByTestId('dashboard-analytics-blur').first().evaluate(el=>getComputedStyle(el).backdropFilter.includes('blur(')),'preview is blurred');
    const summaryBox=await page.getByTestId('dashboard-basic-statistics').boundingBox(), lockedBox=await locked.boundingBox();
    assert.ok(lockedBox.y>=summaryBox.y+summaryBox.height,'free includes the basic summary before Evolución');
    const previews=locked.locator('[data-testid^="dashboard-pro-preview-card-"]');
    assert.equal(await previews.count(),12,'all locked sections have a preview');
    await previews.nth(0).getByText('Evolución',{exact:true}).waitFor();
    await previews.nth(1).getByText('Cobro de tus sesiones',{exact:true}).waitFor();
    assert.ok((await page.locator('body').ariaSnapshot()).includes('Margen por sesión'),'preview titles explain what Pro unlocks');
    const agreedFees=page.getByTestId('dashboard-agreed-fees');
    assert.deepEqual(await agreedFees.evaluate(el=>[getComputedStyle(el).backgroundImage,getComputedStyle(el).backgroundColor]),['none','rgb(220, 235, 125)']);
    await agreedFees.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/dashboard-agreed-fees-solid-dark.png'});
    const scroll=page.getByTestId('dashboard-scroll-view');
    await locked.getByRole('button',{name:'Ver planes Pro',exact:true}).first().scrollIntoViewIfNeeded();
    await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/dashboard-pro-scroll-top-dark.png'});
    const initialScroll=await scroll.evaluate(el=>el.scrollTop);
    await previews.last().scrollIntoViewIfNeeded();
    assert.ok(await scroll.evaluate((el,initial)=>el.scrollTop>initial+1200,initialScroll),'the dashboard scrolls through many Pro statistics');
    await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/dashboard-pro-scroll-bottom-dark.png'});
    await locked.getByRole('button',{name:'Ver planes Pro',exact:true}).last().click();
    await page.waitForURL('**/paywall?reason=analytics');
    await page.getByRole('button',{name:'Probar Pro 15 días gratis',exact:true}).click();
    await page.getByRole('button',{name:'Continuar con Pro',exact:true}).click();
    await page.waitForURL('**/dashboard');
    await page.getByTestId('dashboard-analytics-margin').getByText(/390/).waitFor({timeout:30000});
    assert.equal(await page.getByTestId('dashboard-analytics-locked').count(),0,'activating trial unlocks statistics on return');
    const shortTrial={status:'active',expiresAt:'2026-10-12T12:00:03Z'};
    await fixture({pro:false,trial:shortTrial});
    await page.getByTestId('dashboard-analytics-margin').waitFor({timeout:30000});
    shortTrial.status='expired';
    await page.getByTestId('dashboard-analytics-locked').waitFor({timeout:15000});
    assert.equal(await page.getByTestId('dashboard-pro-statistics').count(),0,'trial expiration closes the full statistics');
    await page.getByTestId('dashboard-basic-statistics').waitFor();
    for(const lang of ['es','en','de','fr','it','pt','ja']) {
        await fixture({pro:false,width:320,dark:false,lang});
        const copy=JSON.parse(fs.readFileSync('src/i18n/languages/'+lang+'.json','utf8'));
        const preview=page.getByTestId('dashboard-analytics-locked');
        await preview.getByRole('button',{name:copy.insights.proAction,exact:true}).first().waitFor();
        await preview.getByText(copy.insights.proTitle,{exact:true}).first().waitFor();
        assert.ok(await preview.evaluate(el=>el.scrollWidth<=el.clientWidth+1),lang+' preview fits small screens');
        if(lang==='es') {
            await preview.getByRole('button',{name:copy.insights.proAction,exact:true}).first().scrollIntoViewIfNeeded();
            await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/dashboard-pro-scroll-320-light.png'});
            assert.deepEqual(await page.getByTestId('dashboard-agreed-fees').evaluate(el=>[getComputedStyle(el).backgroundImage,getComputedStyle(el).backgroundColor]),['none','rgb(53, 49, 110)']);
        }
    }
    await fixture({width:320,dark:false});
    await page.getByTestId('dashboard-analytics-margin').getByText(/390/).waitFor({timeout:30000});
    assert.ok(await page.getByTestId('dashboard-analytics-margin').getByText(/390/).evaluate(el=>el.scrollWidth <= el.clientWidth+1),'small-screen amount must fit');
    await page.getByTestId('dashboard-analytics-margin').screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/dashboard-analytics-320-light.png'});
    await fixture({expenseError:true});
    await page.getByTestId('dashboard-analytics-margin').getByRole('button',{name:'Cargar gastos para calcular el margen',exact:true}).waitFor({timeout:30000});
    assert.equal(await page.getByTestId('dashboard-analytics-margin').getByText(/390/).count(),0);
    await fixture({empty:true});
    await page.getByTestId('dashboard-analytics-margin').getByText(/No hay actuaciones/).waitFor({timeout:30000});
    await page.getByTestId('dashboard-analytics-aging').getByText('No hay cachés pendientes de actuaciones realizadas.').waitFor();
    await fixture({accessError:true,pro:false});
    await page.getByTestId('dashboard-analytics-locked').waitFor({timeout:30000});
    await page.getByTestId('dashboard-basic-statistics').waitFor();
    assert.equal(await page.getByTestId('dashboard-payment-status').count(),0);
    assert.equal(await page.getByTestId('dashboard-pro-statistics').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: paid statistics and drilldowns, free basic summary, Pro from Evolución inclusive, scrollable previews of all twelve Pro sections without data or controls, solid agreed-fee card, paywall and trial activation, automatic trial expiry, access errors keep basic statistics, seven languages and small mobile layouts');
    await browser.close();
})().catch(async e=>{console.error(e);if(page)console.error((await page.locator('body').innerText()).slice(-6000));if(browser)await browser.close();process.exitCode=1;});
