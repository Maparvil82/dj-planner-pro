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
        const event={id,user_id:user.id,title:'Session With Expenses',venue:'Sala X',date:'2030-10-10',start_time:'22:00',end_time:'04:00',status:'confirmed',djs:[],earning_type:'fixed',earning_amount:200,amount_paid:75,currency:'€',color:'#34D399'};
        const empty={...event,id:'00000000-0000-4000-8000-000000000872',title:'Session Without Expenses'};
        const expense=(key,description,amount,currency='EUR',session_id=id,user_id=user.id)=>({id:key,description,amount,currency,session_id,user_id,date:'2030-10-10',receipt_path:null});
        let rows=[expense('taxi','Taxi',12.5),expense('hotel','Hotel',47.5),expense('water','Water',10,'USD'),expense('other','Other session',900,'EUR','unrelated'),expense('general','Unassigned',1000,'EUR',null),expense('foreign','Someone else',999,'EUR',id,'different-user')];
        let allReads=0;
        await context.route('**/rest/v1/sessions*',route=>route.fulfill({json:route.request().headers().accept?.includes('vnd.pgrst.object')?event:[event,empty]}));
        await context.route('**/rest/v1/expenses*',route=>{
            const req=route.request(),url=new URL(req.url());
            if(req.method()==='POST'){
                const input=req.postDataJSON();rows.push(input);return route.fulfill({json:input});
            }
            if(!url.searchParams.has('gte')&&!url.searchParams.has('date'))allReads++;
            return route.fulfill({json:rows});
        });
        await page.goto(base+'/home',{waitUntil:'domcontentloaded'});
        const card=page.getByRole('button',{name:/^Session With Expenses,/});await card.getByTestId('session-expense-badge').waitFor();
        const money=(value,currency)=>new Intl.NumberFormat('es',{style:'currency',currency,maximumFractionDigits:2}).format(value);
        const summary='Gastos · '+money(60,'EUR')+' · '+money(10,'USD');
        assert.equal(await card.getByTestId('session-expense-badge').innerText(),summary);
        assert.equal(await page.getByRole('button',{name:/^Session Without Expenses,/}).getByTestId('session-expense-badge').count(),0);
        assert.equal(allReads,1,'cards share one global expense read');
        await card.scrollIntoViewIfNeeded();await page.waitForTimeout(350);
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/session-expenses-summary-'+width+'.png'});
        await card.click();await page.waitForURL('**/session/'+id);
        const detail=page.getByTestId('session-detail-expenses');await detail.waitFor();
        assert.equal(await detail.getByTestId('session-expense-row').count(),3);
        for(const name of ['Taxi','Hotel','Water'])assert.equal(await detail.getByText(name,{exact:true}).count(),1);
        for(const name of ['Other session','Unassigned','Someone else'])assert.equal(await detail.getByText(name,{exact:true}).count(),0);
        assert.equal(await detail.getByTestId('session-expense-total').innerText(),money(60,'EUR')+' · '+money(10,'USD'));
        await detail.scrollIntoViewIfNeeded();await page.waitForTimeout(350);
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/session-expenses-detail-'+width+'.png'});
        await detail.getByRole('button',{name:'Gestionar gastos',exact:true}).click();
        await page.waitForURL(url=>url.pathname==='/expenses'&&url.searchParams.get('sessionId')===id);
        await page.getByRole('button',{name:'Añadir gasto',exact:true}).click();
        await page.getByLabel('Concepto',{exact:true}).fill('Parking');
        await page.getByLabel(/^Importe ·/).fill('5');
        await page.getByRole('button',{name:'Guardar gasto',exact:true}).click();
        await page.getByRole('button',{name:'Añadir gasto',exact:true}).waitFor();
        await page.evaluate(()=>{const scroller=[...document.querySelectorAll('div')].find(n=>['auto','scroll'].includes(getComputedStyle(n).overflowY)&&n.clientHeight>100&&n.scrollHeight>n.clientHeight);if(scroller)scroller.scrollTop=0;});
        await page.waitForTimeout(350);
        await page.getByRole('button',{name:'Volver',exact:true}).click();await page.waitForURL('**/session/'+id);
        await page.getByTestId('session-detail-expenses').getByText('Parking',{exact:true}).waitFor();
        assert.equal(await page.getByTestId('session-expense-total').innerText(),money(65,'EUR')+' · '+money(10,'USD'));
        await page.getByRole('button',{name:'Volver atrás',exact:true}).click();await page.waitForURL('**/home');
        await page.getByRole('button',{name:/^Session With Expenses,/}).getByText('Gastos · '+money(65,'EUR')+' · '+money(10,'USD'),{exact:true}).waitFor();
        await context.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: expense badges/detail with dates, descriptions and currency totals; no unrelated/private/empty expenses; one shared read; adding an expense refreshes detail and cards at 320/390 px light/dark');
    await browser.close();
})().catch(async e=>{console.error(e);if(page&&!page.isClosed())console.error((await page.locator('body').innerText()).slice(-2400));if(browser)await browser.close();process.exitCode=1;});
