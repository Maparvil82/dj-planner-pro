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

    const base = process.env.BASE_URL || 'http://localhost:8082';
    const id='00000000-0000-4000-8000-000000000871';
    let paymentSaved=false;
    for (const [width,dark,poster] of [[390,true,true],[320,false,false]]) {
        const context=await setup('es',width,dark,true);
        let row={id,user_id:user.id,title:'Midnight Sessions',venue:'Sala X',venue_city:'Madrid',venue_address:'Calle del Ritmo, 12',venue_id:'00000000-0000-4000-8000-000000000873',date:'2030-10-10',start_time:'22:00',end_time:'04:00',status:'confirmed',djs:['DJ Demo','DJ Vega'],is_collective:true,earning_type:'fixed',earning_amount:200,amount_paid:50,currency:'€',color:'#DCEB7D',booking_timezone:'Europe/Madrid',poster_url:poster?base+'/fixture-poster.jpg':null};
        await context.route('**/fixture-poster.jpg',route=>route.fulfill({contentType:'image/jpeg',body:fs.readFileSync('assets/community/dj-welcome.jpg')}));
        await context.route('**/rest/v1/sessions*',route=>{
            const req=route.request();
            if(req.method()==='PATCH'){const input=req.postDataJSON();row={...row,...input};paymentSaved=input.amount_paid===75;return route.fulfill({json:row});}
            return route.fulfill({json:req.headers().accept?.includes('vnd.pgrst.object')?row:[row]});
        });
        await context.route('**/rest/v1/venues*',route=>route.fulfill({json:[]}));
        await page.goto(base+'/home',{waitUntil:'domcontentloaded'});
        await page.getByText('Midnight Sessions',{exact:true}).first().click({timeout:30000});
        await page.waitForURL('**/session/'+id);
        await page.getByTestId('session-detail-header').waitFor();
        assert.equal(await page.getByTestId('session-detail-header').getByText('Midnight Sessions',{exact:true}).count(),1);
        const cards=await page.evaluate(()=>[...document.querySelectorAll('[data-testid^="session-detail-"]')].map(n=>n.dataset.testid).filter(id=>['session-detail-place','session-detail-information','session-detail-payment','session-detail-community'].includes(id)));
        assert.deepEqual(cards,['session-detail-place','session-detail-information','session-detail-payment','session-detail-community']);
        assert.equal(await page.getByTestId('session-detail-information').getByTestId('session-detail-poster').count(),poster?1:0);
        if(poster) { await page.getByLabel('Cartel de la sesión').waitFor(); await page.waitForTimeout(400); }
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/session-detail-'+width+'.png',fullPage:true});
        assert.equal(await page.getByRole('button',{name:'Abrir opciones de sesión',exact:true}).count(),0,'three-dot menu removed');
        const tools=page.getByTestId('session-detail-tools');
        for(const text of ['Acceso','Invitados','Gastos','Preparación'])assert.equal(await tools.getByRole('button',{name:text,exact:true}).count(),1);
        assert.equal(await page.getByRole('button',{name:'Exportar al calendario',exact:true}).count(),0);
        assert.ok(await tools.evaluate(node => {
            const detail=document.querySelector('[data-testid="session-detail-community"]');
            return !detail.contains(node) && !!(detail.compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING);
        }),'tools follow Community at the bottom');
        assert.equal(await tools.getByRole('button').count(),4);
        for(const name of ['Elige un color','Cancelar sesión','Eliminar Sesión','Invitación'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0,'management removed from detail');
        await tools.scrollIntoViewIfNeeded();await page.waitForTimeout(350);
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/session-detail-tools-'+width+'.png'});
        await tools.getByRole('button',{name:'Invitados',exact:true}).click();
        await page.waitForURL(url=>url.pathname==='/guests'&&url.searchParams.get('sessionId')===id);
        await page.goBack();await page.getByTestId('session-detail-header').waitFor();
        await page.getByRole('button',{name:'Editar sesión',exact:true}).click();
        await page.waitForURL('**/edit-session/'+id);
        await page.goBack();await page.getByTestId('session-detail-header').waitFor();
        // Existing payment form remains functional within the Cobro card.
        await page.getByTestId('session-detail-payment').scrollIntoViewIfNeeded();
        const input=page.getByTestId('session-detail-payment').locator('input').first();
        await input.fill('75');
        await page.getByRole('button',{name:'Guardar importe',exact:true}).click();
        await page.waitForTimeout(500);
        assert.ok(paymentSaved,'payment update is preserved');
        await context.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: section order, title/actions, optional poster inside Details, inline tools link to guest list, edit navigation and payment saving; 320/390 px, light/dark');
    await browser.close();
})().catch(async e=>{console.error(e);if(page&&!page.isClosed())console.error((await page.locator('body').innerText()).slice(-2200));if(browser)await browser.close();process.exitCode=1;});
