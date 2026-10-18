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



    const base = process.env.BASE_URL || 'http://localhost:8081';
    const id = '00000000-0000-4000-8000-000000000919';
    const venue = {id:'00000000-0000-4000-8000-000000000912',user_id:user.id,name:'Sala X',city:'Sevilla'};
    for (const [width,dark] of [[390,false],[320,true],[390,'dark-honey'],[390,'dark-ocean'],[390,'dark-bubble']]) {
        const context = await setup('es',width,dark);
        let saved, creates=0, edits=[];
        await context.route('**/*.supabase.co/**', async route => {
            const req=route.request(), url=new URL(req.url());
            let body;
            if(url.pathname.endsWith('/venues')) body=[venue];
            else if(url.pathname.endsWith('/rpc/get_session_usage')) body={count:saved?1:0,limit:15,remaining:14,isPro:false};
            else if(url.pathname.endsWith('/rpc/create_session_series')) {
                saved={...req.postDataJSON().input,id,user_id:user.id,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
                creates++; body=saved;
            } else if(url.pathname.endsWith('/sessions')) {
                if(req.method()==='PATCH') {edits.push(req.postDataJSON()); saved={...saved,...req.postDataJSON()};body=[{id}];}
                else body=req.headers().accept?.includes('vnd.pgrst.object')?saved:saved?[saved]:[];
            } else {await route.fallback();return;}
            await route.fulfill({json:body});
        });
        const dropdown=page.getByRole('button',{name:'Tipo de sesión',exact:true});
        const group=page.getByRole('radiogroup',{name:'Tipo de sesión',exact:true});
        const name=page.getByRole('textbox',{name:'Nombre del evento · Opcional',exact:true});
        const checkInputs=async()=>{
            const styles=await page.locator('input:not([type=checkbox]):visible').evaluateAll(inputs=>inputs.map(input=>{
                const style=getComputedStyle(input);
                return {label:input.getAttribute('aria-label'),background:style.backgroundColor,color:style.color};
            }));
            assert(styles.length>=3);
            for(const style of styles){
                assert.equal(style.background,dark?'rgb(36, 36, 34)':'rgb(248, 249, 253)',JSON.stringify(style));
                assert.equal(style.color,dark?'rgb(247, 247, 247)':'rgb(32, 37, 56)',JSON.stringify(style));
            }
        };
        const choose=async label=>{
            await dropdown.click();await group.waitFor();
            assert.equal(await group.getByRole('radio').count(),6);
            await group.getByRole('radio',{name:label,exact:true}).click();
            await group.waitFor({state:'hidden'});
            assert.equal(await dropdown.getAttribute('aria-expanded'),'false');
            assert.equal(await dropdown.innerText(),label);
        };
        await page.goto(base+'/home');
        await page.getByRole('button',{name:'Crear',exact:true}).click();
        await page.getByRole('button',{name:'Simple',exact:true}).click();
        await page.waitForURL('**/add-session');await dropdown.waitFor();
        assert.equal(await dropdown.innerText(),'Club');
        assert.equal(await group.count(),0,'Dropdown starts closed');
        await name.fill('Club Test');await checkInputs();
        for(const label of ['Festival','Boda','Evento corporativo','Residencia','Club']) await choose(label);
        assert.equal(await name.inputValue(),'Club Test','Choosing a type preserves the draft');
        const theme=typeof dark==='string'?dark:dark?'dark':'light';
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/session-dropdown-'+width+'-'+theme+'.png'});
        await dropdown.click();await group.waitFor();
        assert.equal(await group.getByRole('radio',{name:'Club',exact:true}).getAttribute('aria-checked'),'true');
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/session-dropdown-open-'+width+'-'+theme+'.png'});
        await page.getByRole('button',{name:'Cancelar',exact:true}).click({position:{x:5,y:5}});
        await group.waitFor({state:'hidden'});
        assert.equal(await dropdown.innerText(),'Club','Dismissing keeps the current value');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        await page.getByText('Por sesión',{exact:true}).click();
        await page.getByRole('textbox',{name:'Importe por sesión',exact:true}).fill('150');await checkInputs();
        await page.getByText('Ej: Club Amnesia',{exact:true}).click();
        await page.getByText('Sala X',{exact:true}).last().click();
        if(dark) assert.equal(await page.getByTestId('session-venue-field').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(36, 36, 34)','Selected venue keeps a dark background');
        await page.getByRole('button',{name:'Guardar sesión',exact:true}).click();
        await page.waitForURL('**/home');assert.equal(creates,1);assert.equal(saved.event_type,'club');
        await page.getByText('Club Test',{exact:true}).filter({visible:true}).first().click();
        await page.waitForURL('**/session/'+id);await page.getByText('Club',{exact:true}).waitFor();
        await page.getByRole('button',{name:'Editar sesión',exact:true}).click();
        await page.waitForURL('**/edit-session/'+id);await dropdown.waitFor();
        assert.equal(await dropdown.innerText(),'Club');
        assert.equal(await name.inputValue(),'Club Test');await checkInputs();
        await choose('Evento corporativo');
        await page.getByRole('button',{name:'Guardar sesión',exact:true}).click();
        await page.waitForURL('**/session/'+id);await page.getByText('Evento corporativo',{exact:true}).waitFor();
        assert.equal(saved.event_type,'corporate');assert.equal(edits[0].event_type,'corporate');
        assert.equal('title' in edits[0],false,'Only changed fields are written');
        await page.getByRole('button',{name:'Editar sesión',exact:true}).click();
        await page.waitForURL('**/edit-session/'+id);await dropdown.waitFor();
        await choose('Sin especificar');
        await page.getByRole('button',{name:'Guardar sesión',exact:true}).click();
        await page.waitForURL('**/session/'+id);assert.equal(saved.event_type,null);
        await page.getByText('Tipo de sesión',{exact:true}).waitFor({state:'hidden'});
        delete saved.event_type;
        await page.getByRole('button',{name:'Editar sesión',exact:true}).click();
        await page.waitForURL('**/edit-session/'+id);await dropdown.waitFor();
        assert.equal(await dropdown.innerText(),'Sin especificar','Legacy values remain unchanged');
        await context.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: compact dropdown, Club default, all options, dismiss, preserved drafts, create/edit/clear, legacy values, and explicit input colours in light + all four dark themes at mobile sizes. API mocked.');
    await browser.close();
})().catch(async error=>{console.error(error);if(page&&!page.isClosed()){console.error((await page.locator('body').innerText()).slice(0,2000));await page.screenshot({path:'/private/tmp/session-dropdown-failure.png'});}if(browser)await browser.close();process.exitCode=1;});
