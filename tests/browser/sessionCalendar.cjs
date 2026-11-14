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






    const context=await setup('es',Number(process.env.CALENDAR_WIDTH || 390),!process.env.CALENDAR_LIGHT,false);
    await page.clock.setFixedTime(new Date('2026-11-03T12:00:00Z'));
    const base=process.env.BASE_URL||'http://localhost:8081';
    const outputRoot=require('node:path').resolve(__dirname,'../../../outputs/calendario-1.0.6');
    const out=process.env.CALENDAR_LIGHT?outputRoot+'/light-320':outputRoot;
    fs.mkdirSync(out,{recursive:true});
    const updates=JSON.parse(fs.readFileSync(outputRoot+'/product-updates-before.json','utf8'));
    const make=(id,date)=>({id,user_id:user.id,title:'Sesión '+id,venue:'Zoco',date,start_time:'22:00',end_time:'04:00',booking_timezone:'Europe/Madrid',status:'confirmed',earning_type:'fixed',earning_amount:250,currency:'EUR',color:'#7666df',amount_paid:0,djs:[],created_at:'2026-10-01T12:00:00Z',updated_at:'2026-10-01T12:00:00Z'});
    const sessions=[make('october-one','2026-10-03'),make('october-two','2026-10-20'),make('november-one','2026-11-07'),make('november-two','2026-11-21')];
    const requests=[];
    await context.route('**/*.supabase.co/**',async route=>{
        const req=route.request(),url=new URL(req.url());let body;
        if(url.pathname.endsWith('/product_updates'))body=updates;
        else if(url.pathname.endsWith('/rpc/session_screen_page')) {
            const args=req.postDataJSON();requests.push(args);const f=args.filters||{};
            const selected=sessions.filter(s=>(!f.from||s.date>=f.from)&&(!f.to||s.date<f.to)&&(!f.search||s.title.toLowerCase().includes(f.search.toLowerCase())));
            body={sessions:f.blockedDay?selected.filter(s=>s.date===f.blockedDay):selected,nextCursor:null};
        }
        else if(url.pathname.endsWith('/rpc/session_calendar_marks')) {const f=req.postDataJSON().filters||{};body=sessions.filter(s=>(!f.from||s.date>=f.from)&&(!f.to||s.date<f.to)).map(s=>({date:s.date,color:s.color}));}
        else if(url.pathname.endsWith('/sessions'))body=sessions.find(s=>'eq.'+s.id===url.searchParams.get('id')) || null;
        else if(url.pathname.endsWith('/rpc/session_card_summaries'))body={};
        else if(url.pathname.endsWith('/rpc/session_screen_options'))body={venues:['Zoco'],titles:sessions.map(s=>s.title)};
        else {await route.fallback();return;}
        await route.fulfill({json:body});
    });
    page.setDefaultTimeout(20000);
    await page.goto(base+'/calendar', {waitUntil:'domcontentloaded',timeout:90000});
    console.log('Navigation ready');
    async function settleSlide(title) {
        await page.waitForFunction(title => Array.from(document.querySelectorAll('div')).some(el => {
            if (el.textContent !== title) return false;
            const box = el.getBoundingClientRect();
            return box.width > 0 && Math.abs(box.left - 24) < 2 && box.right <= innerWidth;
        }), title);
    }
    if (!process.env.SKIP_SHEET) {
    await page.getByRole('button',{name:'Cerrar novedades'}).waitFor({timeout:20000});
    await page.getByRole('button',{name:'Siguiente',exact:true}).click();
    await page.getByRole('button',{name:'Siguiente',exact:true}).click();
    await settleSlide('Mejor visualización de sesiones pasadas');
    await page.screenshot({path:out+'/novedades.png'});
    await page.getByRole('button',{name:'Próximamente',exact:true}).last().click();
    for(let i=0;i<3;i++)await page.getByRole('button',{name:'Siguiente',exact:true}).click();
    await settleSlide('Más herramientas para DJs autónomos');
    await page.screenshot({path:out+'/proximamente.png'});
    await page.getByRole('button',{name:'Cerrar novedades'}).click();
    await page.getByText('Más herramientas para DJs autónomos',{exact:true}).waitFor({state:'hidden'});
    }
    await page.getByTestId('session-card-november-one').waitFor();
    assert.equal(await page.getByTestId('session-card-november-two').count(),1);
    await page.screenshot({path:out+'/calendario-actual.png'});
    await page.getByTestId('monthly-calendar.header.leftArrow').click();
    await page.getByTestId('session-card-october-one').waitFor();
    assert.equal(await page.getByTestId('session-card-october-two').count(),1);
    assert.equal(await page.getByTestId('session-card-november-one').count(),0);
    await page.getByTestId('monthly-calendar.day_2026-10-03').click();
    assert.equal(await page.getByTestId('session-card-october-two').count(),1,'Selecting a day must keep the whole month visible');
    const monthlyScroll=page.getByTestId('monthly-calendar-scroll');
    await monthlyScroll.evaluate(el=>{el.scrollTop=400;});
    await page.screenshot({path:out+'/sesiones-pasadas.png'});
    await monthlyScroll.evaluate(el=>{el.scrollTop=0;});
    await page.getByRole('button',{name:'Volver a hoy',exact:true}).click();
    await page.getByTestId('session-card-november-one').waitFor();
    await page.getByText(/3 de noviembre de 2026/i,{exact:true}).waitFor();
    await page.getByTestId('monthly-calendar.header.rightArrow').click();
    await page.getByText('No hay sesiones en este mes.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Volver a hoy',exact:true}).click();
    await page.getByTestId('session-card-november-one').waitFor();
    assert.equal(await page.getByRole('button',{name:'Historial',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Lista',exact:true}).count(),0);
    await page.getByTestId('monthly-calendar.header.leftArrow').click();
    await page.getByTestId('session-card-october-one').waitFor();
    await page.getByRole('button',{name:'Sesión october-one, Zoco, 3/10/2026',exact:true}).click();
    await page.waitForURL('**/session/october-one');
    await page.getByText('Guardar como plantilla',{exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    assert(requests.some(r=>r.filters?.from==='2026-10-01'&&r.filters?.to==='2026-11-01'));
    console.log('PASS: sheet release and roadmap, full month cards, previous month, day selection, back to today, empty month, integrated history without a separate list and session detail; no page errors.');
    await browser.close();
})().catch(async e=>{console.error(e);if(page){console.error((await page.locator('body').innerText()).slice(-3000));await page.screenshot({path:'/tmp/dj-calendar-error.png'}).catch(()=>{});}await browser?.close();process.exit(1);});
