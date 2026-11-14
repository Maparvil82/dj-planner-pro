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
        const event={id,user_id:user.id,title:'Task Session',venue:'Sala X',date:'2030-10-10',start_time:'22:00',end_time:'04:00',status:'confirmed',djs:[],earning_type:'fixed',earning_amount:200,amount_paid:50,currency:'€',color:'#DCEB7D'};
        const other={...event,id:'00000000-0000-4000-8000-000000000872',title:'No Tasks'};
        let tasks=[{id:'task-1',user_id:user.id,session_id:id,title:'Private completed one',completed:true},{id:'task-2',user_id:user.id,session_id:id,title:'Private completed two',completed:true},{id:'task-3',user_id:user.id,session_id:id,title:'Private pending item',completed:false}];
        let summaryReads=0;
        await context.route('**/rest/v1/sessions*',route=>route.fulfill({json:route.request().headers().accept?.includes('vnd.pgrst.object')?event:[event,other]}));
        await context.route('**/rest/v1/session_tasks*',route=>{
            const req=route.request(),url=new URL(req.url());
            if(req.method()==='PATCH'){
                const task=tasks.find(t=>url.searchParams.get('id')==='eq.'+t.id);Object.assign(task,req.postDataJSON());return route.fulfill({json:null});
            }
            if(url.searchParams.get('select')==='session_id,completed'){
                assert.equal(url.searchParams.get('user_id'),'eq.'+user.id);
                summaryReads++;
                return route.fulfill({json:tasks.map(({session_id,completed})=>({session_id,completed}))});
            }
            return route.fulfill({json:tasks});
        });
        await page.goto(base+'/home',{waitUntil:'domcontentloaded'});
        const card=page.getByRole('button',{name:/^Task Session,/}).locator('..');await card.waitFor();
        await card.getByTestId('session-task-badge').getByText('Completadas: 2 · Pendientes: 1',{exact:true}).waitFor();
        assert.equal(summaryReads,1,'one shared summary read for multiple session cards');
        assert.equal(await page.getByRole('button',{name:/^No Tasks,/}).locator('..').getByTestId('session-task-badge').count(),0);
        assert.equal(await card.getByText(/Private/).count(),0,'task names are never rendered on cards');
        await card.scrollIntoViewIfNeeded();await page.waitForTimeout(350);
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/session-tasks-'+width+'.png'});
        await card.getByRole('button').first().click();await page.waitForURL('**/session/'+id);
        await page.getByRole('button',{name:'Preparación',exact:true}).scrollIntoViewIfNeeded();
        await page.getByRole('button',{name:'Preparación',exact:true}).click();
        await page.waitForURL('**/preparation?sessionId='+id);
        const header=page.getByTestId('scroll-header-expanded').filter({visible:true});
        const back=await header.getByRole('button',{name:'Volver',exact:true}).boundingBox();
        const title=await header.getByText('Preparación',{exact:true}).boundingBox();
        assert.ok(Math.abs(back.y+back.height/2-title.y-title.height/2)<1,'back and title centers align');
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/preparation-header-'+width+'.png'});
        const checkbox=page.getByRole('checkbox',{name:'Private pending item',exact:true});
        await checkbox.click();
        await page.waitForTimeout(500);
        await page.evaluate(()=>{
            const scroller=[...document.querySelectorAll('div')].find(n=>['auto','scroll'].includes(getComputedStyle(n).overflowY)&&n.clientHeight>100&&n.scrollHeight>n.clientHeight);if(scroller)scroller.scrollTop=0;
        });
        await page.waitForTimeout(350);
        await page.getByRole('button',{name:'Volver',exact:true}).click();await page.waitForURL('**/session/'+id);
        await page.getByRole('button',{name:'Volver atrás',exact:true}).click();await page.waitForURL('**/home');
        await page.getByRole('button',{name:/^Task Session,/}).locator('..').getByText('Completadas: 3 · Pendientes: 0',{exact:true}).waitFor();
        assert.equal(summaryReads,2,'marking a task refreshes shared summary');
        await context.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: back/title alignment, one shared task summary query, no badge for empty sessions, no task names, refreshed counts after completion; 320/390 px light/dark');
    await browser.close();
})().catch(async e=>{console.error(e);if(page&&!page.isClosed())console.error((await page.locator('body').innerText()).slice(-2200));if(browser)await browser.close();process.exitCode=1;});
