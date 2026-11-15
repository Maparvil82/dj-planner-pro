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
        email_confirmed_at: '2026-10-01T12:00:00Z',
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

    const base=process.env.BASE_URL || 'http://localhost:8081';
    const context=await setup('es',Number(process.env.TEST_WIDTH||390),true,false);
    const blank='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',existing='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
    const template={user_id:user.id,venue:'Club Demo',date:'2099-12-24',start_time:'23:30',end_time:'04:00',status:'confirmed',djs:['DJ Demo'],earning_type:'fixed',earning_amount:100,currency:'EUR',color:'#DCEB7D',is_collective:false};
    const rows=[{...template,id:blank,title:'Sesión sin cartel',poster_url:null},{...template,id:existing,title:'Sesión con cartel',poster_url:base+'/poster-fixture.png'}];
    const jobs=[];const generated=[];
    const budget={creditMode:'simulation',credits:10,testCredits:10,enabled:true,configured:true,canGenerate:true,remainingOperations:5};
    await context.route('**/poster-fixture.png',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64')}));
    await context.route('**/rest/v1/rpc/poster_feature_access',route=>route.fulfill({json:true}));
    await context.route('**/rest/v1/sessions*',route=>{
      const req=route.request(),url=new URL(req.url());
      const row=rows.find(row=>'eq.'+row.id===url.searchParams.get('id'));
      return route.fulfill({json:req.headers().accept?.includes('vnd.pgrst.object')?row:rows});
    });
    await context.route('**/functions/v1/poster-ai',route=>{
      const body=route.request().postDataJSON();
      if(body.action==='generate'){
        generated.push(body);
        const row=rows.find(row=>row.id===body.sessionId);
        assert.equal(body.expectedPosterUrl,row.poster_url);
        row.poster_url=base+'/poster-fixture.png?job='+body.id;
        const job={id:body.id,sessionId:row.id,status:'complete',sessionPosterApplied:true,parentId:null,form:body.form,imageUrl:base+'/poster-fixture.png',createdAt:new Date().toISOString()};jobs.push(job);
        return route.fulfill({json:{job,budget}});
      }
      return route.fulfill({json:{jobs:body.action==='explore'?[]:jobs,budget}});
    });
    await context.route('**/rest/v1/venues*',route=>route.fulfill({json:[]}));
    await page.goto(base+'/session/'+blank,{waitUntil:'domcontentloaded',timeout:60000});
    await page.getByTestId('session-create-poster').click({timeout:30000});
    await page.waitForURL(/carteles/);
    await page.getByText('Crear cartel para tu sesión',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Crear con Offset Radical',exact:true}).click();
    await page.getByText('Paso 2 de 3 · Fotos',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Continuar',exact:true}).click();
    await page.getByRole('button',{name:'Generar cartel · 1 crédito',exact:true}).click();
    await page.waitForFunction(()=>!document.body.innerText.includes('Paso 3 de 3'));
    assert.equal(generated.length,1);assert.equal(generated[0].sessionId,blank);assert.equal(generated[0].expectedPosterUrl,null);
    await page.goto(base+'/session/'+blank,{waitUntil:'domcontentloaded'});
    await page.getByTestId('session-detail-poster').waitFor();
    assert.equal(await page.getByTestId('session-create-poster').count(),0);
    // Restore the first fixture for the equal-size empty/existing comparison.
    rows[0].poster_url=null;
    await page.goto(base+'/carteles',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Crear con Offset Radical',exact:true}).click();
    const emptyCard=page.getByTestId('poster-session-'+blank),posterCard=page.getByTestId('poster-session-'+existing);
    await posterCard.waitFor();
    assert.equal((await emptyCard.boundingBox()).height,(await posterCard.boundingBox()).height);
    await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/poster-session-picker-'+(process.env.TEST_WIDTH||390)+'.png'});
    await posterCard.getByRole('img',{name:'Cartel de Sesión con cartel'}).waitFor();
    page.once('dialog',dialog=>dialog.dismiss());await posterCard.click();
    await page.getByText('Paso 1 de 3 · Sesión',{exact:true}).waitFor();
    assert.equal(generated.length,1);
    page.once('dialog',dialog=>{assert.match(dialog.message(),/ya tiene cartel/);dialog.accept();});await posterCard.click();
    await page.getByText('Paso 2 de 3 · Fotos',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Continuar',exact:true}).click();
    await page.getByRole('button',{name:'Generar cartel · 1 crédito',exact:true}).click();
    await page.waitForTimeout(600);
    assert.equal(generated.length,2);assert.equal(generated[1].sessionId,existing);assert.equal(generated[1].expectedPosterUrl,base+'/poster-fixture.png');
    assert.deepEqual(errors,[]);
    console.log('PASS: detail → preselected generation → attached poster; picker thumbnails and equal heights; existing-poster cancel/confirm; generation binds the selected session');
    await browser.close();
})().catch(async e=>{console.error(e);if(page)console.error((await page.locator('body').innerText()).slice(-1800));if(browser)await browser.close();process.exitCode=1;});
