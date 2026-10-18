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
    const context=await setup('es',390,true,true);
    let row={id,user_id:user.id,title:'Editable Session',venue:'Sala X',date:'2030-10-10',start_time:'22:00',end_time:'04:00',status:'confirmed',djs:[],earning_type:'fixed',earning_amount:200,amount_paid:75,currency:'€',color:'#34D399',booking_timezone:'Europe/Madrid',is_collective:false};
    let writes=0,deleted=false;
    await context.route('**/rest/v1/sessions*',route=>{
        const req=route.request();
        if(req.method()==='PATCH'){row={...row,...req.postDataJSON()};writes++;return route.fulfill({json:[{id}]});}
        return route.fulfill({json:req.headers().accept?.includes('vnd.pgrst.object')?row:deleted?[]:[row]});
    });
    await context.route('**/rest/v1/rpc/delete_session_safely',route=>{assert.deepEqual(route.request().postDataJSON(),{session_id:id,delete_scope:'single'});deleted=true;return route.fulfill({json:1});});
    await context.route('**/rest/v1/rpc/get_session_usage',route=>route.fulfill({json:{count:1,limit:30,remaining:29,isPro:true}}));
    await page.goto(base+'/home',{waitUntil:'domcontentloaded'});
    await page.getByText('Editable Session',{exact:true}).filter({visible:true}).first().click();await page.waitForURL('**/session/'+id);
    await page.getByRole('button',{name:'Editar sesión',exact:true}).click();await page.waitForURL('**/edit-session/'+id);
    const color=page.getByRole('button',{name:'Elige un color',exact:true});await color.scrollIntoViewIfNeeded();await color.click();
    await page.getByRole('radio',{name:'Tomate',exact:true}).click();
    const cancel=page.getByRole('button',{name:'Cancelar sesión',exact:true});await cancel.scrollIntoViewIfNeeded();
    await page.getByText('Cancelar mantiene la sesión y sus importes, marcada como cancelada. Puedes reactivarla más adelante.',{exact:true}).waitFor();
    await cancel.click();assert.equal(writes,0,'cancellation and colour stay as drafts until Save');
    await page.getByRole('button',{name:'Guardar sesión',exact:true}).click();await page.waitForURL('**/session/'+id);
    assert.equal(row.status,'cancelled');assert.equal(row.color,'#EF4444');assert.equal(row.amount_paid,75);assert.equal(row.earning_amount,200);
    await page.getByRole('button',{name:'Editar sesión',exact:true}).click();await page.waitForURL('**/edit-session/'+id);
    const reactivate=page.getByRole('button',{name:'Reactivar sesión',exact:true});await reactivate.scrollIntoViewIfNeeded();await reactivate.click();
    await page.getByRole('button',{name:'Guardar sesión',exact:true}).click();await page.waitForURL('**/session/'+id);
    assert.equal(row.status,'confirmed');assert.equal(row.amount_paid,75);
    await page.getByRole('button',{name:'Editar sesión',exact:true}).click();await page.waitForURL('**/edit-session/'+id);
    const remove=page.getByRole('button',{name:'Eliminar Sesión',exact:true});await remove.scrollIntoViewIfNeeded();
    await page.getByText('Eliminar borra la sesión de tu agenda y de su historial. No se puede deshacer.',{exact:true}).waitFor();
    await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/session-edit-management.png'});
    await remove.click();const dialog=page.getByRole('dialog',{name:'Eliminar Sesión',exact:true});await dialog.waitFor();
    await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(deleted,false,'dismissed confirmation never deletes');
    await remove.click();await dialog.getByRole('button',{name:'Eliminar',exact:true}).click();await page.waitForURL('**/home');assert.equal(deleted,true);
    assert.deepEqual(errors,[]);
    console.log('PASS: colour/cancellation in edit, saving preserves amounts, cancellation can be reversed, explanations visible, deletion requires confirmation and returns home');
    await browser.close();
})().catch(async e=>{console.error(e);if(page&&!page.isClosed())console.error((await page.locator('body').innerText()).slice(-2200));if(browser)await browser.close();process.exitCode=1;});
