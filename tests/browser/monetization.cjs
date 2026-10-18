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
    async function setup(lang = 'es-ES', width = 390, dark = false, pro = false) {
        const fixture = {status:'available',activations:0};
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
            else if (url.pathname.includes('/start_pro_trial')) { fixture.activations++; fixture.status='active'; body={count:12,limit:15,remaining:3,isPro:true,paidPro:false,serverNow:new Date().toISOString(),trial:{eligible:false,status:'active',startedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+15*86400000).toISOString()}}; }
            else if (url.pathname.includes('/subscription-access') || url.pathname.includes('/get_session_usage'))
                body = { count: 12, limit: 15, remaining: 3, isPro: pro || fixture.status==='active', paidPro:pro, serverNow:new Date().toISOString(), trial:{eligible:!pro&&fixture.status==='available',status:fixture.status,startedAt:fixture.status==='available'?null:new Date(Date.now()-86400000).toISOString(),expiresAt:fixture.status==='available'?null:new Date(Date.now()+(fixture.status==='active'?15:-1)*86400000).toISOString()} };
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
        context.trialFixture=fixture;
        return context;
    }

    const base=process.env.BASE_URL || 'http://localhost:8082';
    for(const [width,dark,pro] of [[390,true,false],[320,false,false]]){
        const context=await setup('es-ES',width,dark,pro);
        await page.goto(base+'/home',{waitUntil:'domcontentloaded'});
        await page.getByText('Sesiones',{exact:true}).first().waitFor();
        await page.getByLabel(/^Abrir menú de cuenta/).click();
        await page.getByRole('button',{name:'Descubrir Pro',exact:true}).click();
        await page.waitForURL('**/pro');await page.waitForTimeout(600);
        const benefits=page.getByTestId('pro-benefits').filter({visible:true});await benefits.waitFor();
        for(const feature of ['unlimited','analytics','conditional','guests','access']) await benefits.getByTestId('pro-benefit-'+feature).waitFor();
        assert.equal(await benefits.locator('[data-testid^="pro-benefit-"]').count(),5);
        assert.ok((await page.locator('body').innerText()).includes('resumen básico de estadísticas'));
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/pro-monetization-'+width+'.png',fullPage:true});
        await page.getByRole('button',{name:'Ver planes y suscribirme',exact:true}).click();
        await page.waitForURL('**/paywall');
        const trial=page.getByTestId('pro-trial-card').filter({visible:true});await trial.waitFor();
        assert.equal(await page.getByRole('button',{name:'Probar Pro 15 días gratis',exact:true}).isDisabled(),false);
        assert.equal(await page.getByTestId('paywall-plans').filter({visible:true}).count(),0);
        assert.equal(await page.getByText('dj planner',{exact:true}).filter({visible:true}).count(),0);
        assert.ok(!(await page.locator('body').innerText()).includes('14 días'));
        await page.waitForTimeout(250);
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/paywall-trial-stage-'+width+'.png'});
        await page.getByRole('button',{name:'Ver precios',exact:true}).click();
        const plans=page.getByTestId('paywall-plans').filter({visible:true});await plans.waitFor();
        assert.equal(await page.getByTestId('pro-trial-card').filter({visible:true}).count(),0);
        assert.equal(await page.getByTestId('paywall-plan-monthly').filter({visible:true}).evaluate(n=>getComputedStyle(n).backgroundColor),dark?'rgb(35, 35, 35)':'rgb(255, 255, 255)');
        assert.ok(await plans.evaluate(node=>{const cards=[...node.children].map(n=>n.getBoundingClientRect());return Math.abs(cards[0].y-cards[1].y)<2&&cards[1].x>cards[0].x;}));
        assert.equal(await page.getByRole('button',{name:'Suscribirme a Pro',exact:true}).isDisabled(),true);
        assert.equal(await page.getByText('Precio no disponible',{exact:true}).filter({visible:true}).count(),0);
        assert.ok((await plans.innerText()).includes('4,99'));assert.ok((await plans.innerText()).includes('14,99'));
        assert.equal(await page.getByTestId('annual-launch-label').innerText(),'Precio de lanzamiento');
        assert.ok((await page.getByTestId('annual-standard-price').innerText()).includes('39,99'));
        assert.ok(!(await page.getByTestId('paywall-plan-monthly').innerText()).includes('lanzamiento'));
        assert.ok(!(await page.locator('body').innerText()).includes('14,99 € para siempre'));
        assert.ok((await page.locator('body').innerText()).includes('Precios de referencia para España'));
        assert.ok((await page.getByTestId('subscription-disclosure').innerText()).includes('se renueva automáticamente'));
        assert.equal(await page.getByRole('link',{name:'Gestionar o cancelar suscripción',exact:true}).count(),1);
        await page.getByRole('radio',{name:'MENSUAL',exact:true}).click();
        assert.equal(await page.getByRole('radio',{name:'MENSUAL',exact:true}).getAttribute('aria-checked'),'true');
        await page.waitForTimeout(250);
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/paywall-prices-stage-'+width+'.png'});
        await page.getByRole('button',{name:'Volver',exact:true}).click();
        await page.getByTestId('paywall-stage-intro').filter({visible:true}).waitFor();
        assert.equal(context.trialFixture.activations,0);
        await page.getByRole('button',{name:'Probar Pro 15 días gratis',exact:true}).click();
        const activeStatus=page.getByTestId('trial-status').filter({visible:true});await activeStatus.waitFor();
        assert.ok((await activeStatus.innerText()).includes('Tu prueba termina el'));
        assert.equal(context.trialFixture.activations,1);
        await page.waitForTimeout(250);
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/paywall-trial-active-'+width+'.png'});
        await page.getByRole('button',{name:'Continuar con Pro',exact:true}).click();
        await page.goto(base+'/paywall',{waitUntil:'domcontentloaded'});
        await page.getByTestId('trial-status').filter({visible:true}).waitFor();
        assert.equal(context.trialFixture.activations,1,'reload does not restart trial');
        context.trialFixture.status='expired';
        await page.reload({waitUntil:'domcontentloaded'});
        const expiredStatus=page.getByTestId('trial-status').filter({visible:true});await expiredStatus.waitFor();
        assert.ok((await expiredStatus.innerText()).includes('Tu prueba ha terminado'));
        assert.equal(await page.getByRole('button',{name:'Probar Pro 15 días gratis',exact:true}).filter({visible:true}).count(),0);
        await page.waitForTimeout(250);
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/paywall-trial-expired-'+width+'.png'});
        await page.getByRole('button',{name:'Seguir con Gratis',exact:true}).click();
        await context.close();
    }
    for (const locale of ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'it-IT', 'pt-PT', 'pt-BR', 'ja-JP']) {
        const copy = JSON.parse(fs.readFileSync('src/i18n/languages/' + locale.split('-')[0] + '.json', 'utf8'));
        const context = await setup(locale, ['ja-JP', 'de-DE', 'fr-FR', 'pt-BR'].includes(locale) ? 320 : 390);
        const regionalPage = page;
        regionalPage.on('pageerror', error => errors.push(error.message));
        await regionalPage.goto(base + '/paywall', { waitUntil: 'domcontentloaded' });
        await regionalPage.getByTestId('pro-trial-card').filter({ visible: true }).waitFor();
        await regionalPage.getByRole('button', { name: copy.billingFlow.seePrices, exact: true }).click();
        const plans = regionalPage.getByTestId('paywall-plans').filter({ visible: true });
        await plans.waitFor();
        assert.equal(await plans.getByText(copy.billing.priceUnavailable, { exact: true }).count(), 2, locale);
        assert.equal(await regionalPage.getByTestId('annual-launch-label').count(), 0, locale);
        assert.equal(await regionalPage.getByTestId('annual-standard-price').count(), 0, locale);
        const text = await regionalPage.locator('body').innerText();
        assert.ok(!/proEducation\.|proDesign\.|billingFlow\.|\{\{/.test(text), locale);
        assert.ok(!text.includes(copy.trial.referencePrices), locale);
        await regionalPage.waitForTimeout(250);
        if (locale === 'ja-JP') await regionalPage.screenshot({ path: process.cwd() + '/../outputs/DJPlannerPro/i18n-paywall-ja-JP.png' });
        const currency = { 'en-US': 'USD', 'en-GB': 'GBP', 'de-DE': 'EUR', 'fr-FR': 'EUR', 'it-IT': 'EUR', 'pt-PT': 'EUR', 'pt-BR': 'BRL', 'ja-JP': 'JPY' }[locale];
        const event = { id: '00000000-0000-4000-8000-000000000909', user_id: user.id,
            title: 'Regional amount fixture', venue: 'Test room', date: '2030-10-10', start_time: '22:00', end_time: '04:00',
            status: 'confirmed', earning_type: 'fixed', earning_amount: 12345.67, amount_paid: 0, currency,
            djs: [], color: '#DCEB7D', booking_timezone: 'UTC', is_collective: false };
        await context.route('**/rest/v1/sessions*', route => route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify(route.request().headers().accept?.includes('object+json') ? event : [event]) }));
        await regionalPage.getByRole('button', { name: copy.billing.stayFree, exact: true }).click();
        await regionalPage.getByText(event.title, { exact: true }).first().click();
        await regionalPage.waitForURL('**/session/' + event.id);
        const expectedPrice = new Intl.NumberFormat(locale, { style: 'currency', currency }).format(event.earning_amount);
        await regionalPage.getByText(expectedPrice, { exact: true }).filter({ visible: true }).first().waitFor();
        if (['ja-JP', 'en-US'].includes(locale)) await regionalPage.screenshot({ path: process.cwd() + '/../outputs/DJPlannerPro/i18n-session-' + locale + '.png' });
        await context.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: Pro plans in seven languages and nine regions, Spain-only reference prices, session currencies and regional formatting, clear/dark at 320/390 px');
    await browser.close();
})().catch(async e=>{console.error(e);if(page&&!page.isClosed())console.error((await page.locator('body').innerText()).slice(-3000));if(browser)await browser.close();process.exitCode=1;});
