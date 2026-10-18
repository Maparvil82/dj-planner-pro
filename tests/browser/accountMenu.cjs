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
        const logoutFixture = { requests: 0, fail: false };
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
                if (!localStorage.getItem('@theme')) localStorage.setItem('@theme', dark ? 'dark' : 'light');
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
            if (url.pathname.includes('/auth/v1/logout')) {
                logoutFixture.requests++;
                if (logoutFixture.fail) await route.fulfill({status:500,json:{message:'Fixture logout failed'}});
                else await route.fulfill({status:204,body:''});
                return;
            }
            if (url.pathname.includes('/auth/v1/user')) body = user;
            else if (url.pathname.includes('/auth/v1/token')) body = session;
            else if (
                url.pathname.includes('/community_profiles') ||
                url.pathname.includes('/users_profile')
            )
                body = profile;
            else if ((url.pathname.includes('/subscription-access') || url.pathname.includes('/get_session_usage')))
                body = { count: 12, limit: 15, remaining: 3, isPro: pro, paidPro: pro };
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
        context.logoutFixture = logoutFixture;
        return context;
    }
    let context = await setup();
    await page.goto((process.env.BASE_URL || 'http://localhost:8082')+'/community');
    const open = () => page.getByLabel(/^Abrir menú de cuenta/).click();
    await open();
    assert.equal(await page.getByText('PRO', { exact: true }).count(), 0);
    for (const name of ['Historial de sesiones','Mi plan','Seguridad de Comunidad']) assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
    await page
        .getByRole('button', { name: 'Descubrir Pro', exact: true })
        .waitFor();
    await page.waitForFunction(() => {
        const x = document
            .querySelector('[aria-label="Ver mi perfil de DJ"]')
            ?.getBoundingClientRect().x;
        return x !== undefined && x >= 23 && x <= 25;
    });
    await page.screenshot({
        path: '/private/tmp/djplanner-account-drawer.png',
    });
    await page
        .getByRole('button', { name: 'Descubrir Pro', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Ver planes y suscribirme', exact: true })
        .waitFor();
    assert.ok(
        (await page.locator('body').innerText()).includes('hasta 15 sesiones propias guardadas'),
    );
    await page.waitForTimeout(350);
    await page.screenshot({
        path: '/private/tmp/djplanner-pro-overview.png',
        fullPage: true,
    });
    await page
        .getByRole('button', { name: 'Ver planes y suscribirme', exact: true })
        .click();
    await page.waitForURL('**/paywall');
    await page.goBack();
    await page.goBack();
    await open();
    await page
        .getByRole('button', { name: 'Ver mi perfil de DJ', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Editar Perfil', exact: true })
        .waitFor();
    await page.waitForTimeout(350);
    let text = await page.locator('body').innerText();
    assert.ok(!text.includes('Cuenta y ajustes'));
    assert.ok(!text.includes('Contrataciones'));
    await page.getByRole('button', { name: 'Volver', exact: true }).click();
    await page.waitForTimeout(500);
    await open();
    await page
        .getByRole('button', { name: 'Cuenta y ajustes', exact: true })
        .click();
    await page.getByText('fixture@example.invalid', { exact: true }).waitFor();
    await page.getByText('Mi plan', { exact: true }).waitFor();
    await page.getByRole('button',{name:'Eliminar Cuenta',exact:true}).waitFor();
    await page.getByTestId('account-menu-logout').waitFor({state:'hidden'});
    assert.equal(await page.getByRole('button',{name:'Cerrar sesión',exact:true}).count(),0,'logout has moved out of settings');
    await page.getByText('12 / 15 sesiones', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Apariencia', exact: true }).click();
    await page.getByRole('radio', { name: 'Oscuro · Miel', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Apariencia', exact: true }).count(), 1);
    assert.equal(await page.getByText('Sistema', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('@theme')), 'light');
    await page.getByRole('button', { name: 'Apariencia', exact: true }).click();
    await page.getByRole('radio', { name: 'Oscuro · Miel', exact: true }).click();
    await page.waitForFunction(() => localStorage.getItem('@theme') === 'dark-honey');
    await page.waitForFunction(() => [...document.querySelectorAll('*')].some(el => el.textContent === '12 / 15 sesiones' && getComputedStyle(el).color === 'rgb(237, 180, 88)'));
    await page.reload();
    await page.getByRole('button', { name: 'Apariencia', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[role=radio][aria-label="Oscuro · Miel"]')?.getAttribute('aria-checked') === 'true');
    await page.screenshot({ path: '/private/tmp/djplanner-appearance-honey.png' });
    await page.getByRole('radio', { name: 'Oscuro · Ocean', exact: true }).click();
    await page.waitForFunction(() => localStorage.getItem('@theme') === 'dark-ocean');
    await page.waitForFunction(() => [...document.querySelectorAll('*')].some(el => el.textContent === '12 / 15 sesiones' && getComputedStyle(el).color === 'rgb(0, 119, 182)'));
    await page.reload();
    await page.getByRole('button', { name: 'Apariencia', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[role=radio][aria-label="Oscuro · Ocean"]')?.getAttribute('aria-checked') === 'true');
    await page.screenshot({ path: '/private/tmp/djplanner-appearance-ocean.png' });

    await page.getByRole('radio', { name: 'Oscuro · Lima', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('*')].some(el => el.textContent === '12 / 15 sesiones' && getComputedStyle(el).color === 'rgb(220, 235, 125)'));
    await page.getByRole('button', { name: 'Apariencia', exact: true }).click();
    await page.getByRole('radio', { name: 'Claro', exact: true }).click();
    await page.waitForFunction(() => localStorage.getItem('@theme') === 'light');
    await page.getByRole('button', { name: 'Apariencia', exact: true }).hover();
    await page.mouse.wheel(0, -2200);
    await page.waitForTimeout(400);

    assert.equal(
        await page
            .getByRole('button', { name: 'Editar Perfil', exact: true })
            .count(),
        0,
    );
    await page.screenshot({
        path: '/private/tmp/djplanner-account-settings.png',
    });
    await page.getByRole('button', { name: 'Volver', exact: true }).click();
    await page.waitForTimeout(500);
    await open();
    await page.waitForFunction(() => {
        const x = document
            .querySelector('[aria-label="Ver mi perfil de DJ"]')
            ?.getBoundingClientRect().x;
        return x !== undefined && x >= 23 && x <= 25;
    });
    await page.keyboard.press('Escape');
    await page
        .getByRole('button', { name: 'Ver mi perfil de DJ', exact: true })
        .waitFor({ state: 'hidden' });
    await context.close();
    context = await setup('es', 390, true, true);
    await page.goto((process.env.BASE_URL || 'http://localhost:8082')+'/community');
    await open();
    await page.getByRole('button', { name: 'Cuenta y ajustes', exact: true }).waitFor();
    assert.equal(
        await page
            .getByRole('button', { name: 'Descubrir Pro', exact: true })
            .count(),
        0,
    );
    await page.waitForFunction(() => {
        const x = document
            .querySelector('[aria-label="Ver mi perfil de DJ"]')
            ?.getBoundingClientRect().x;
        return x !== undefined && x >= 23 && x <= 25;
    });
    assert.equal(await page.getByText('PRO', { exact: true }).isVisible(), true);
    await page.screenshot({
        path: '/private/tmp/djplanner-account-drawer-pro-dark.png',
    });
    await context.close();
    for (const [width, dark] of [[390, false], [320, true]]) {
        context = await setup('es', width, dark);
        await page.goto((process.env.BASE_URL || 'http://localhost:8082') + '/home');
        await open();
        const logout = page.getByTestId('account-menu-logout');
        await logout.waitFor();
        await page.waitForFunction(() => (document.querySelector('[data-testid="account-menu-logout"]')?.getBoundingClientRect().x ?? -1) >= 23);
        const footer = await logout.boundingBox();
        assert.ok(footer.y > 600 && footer.y + footer.height <= 844, 'logout stays visible at the bottom of the sidebar');
        assert.equal(await page.getByRole('button',{name:'Eliminar Cuenta',exact:true}).count(),0,'no account deletion in the sidebar');
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/sidebar-logout-'+width+'.png'});
        page.once('dialog', dialog => { assert.equal(dialog.type(),'confirm'); void dialog.dismiss(); });
        await logout.click();
        await page.waitForFunction(() => document.querySelector('[data-testid="account-menu-logout"]')?.getAttribute('aria-busy') !== 'true');
        assert.equal(context.logoutFixture.requests,0,'cancel does not send a logout request');
        assert.ok(await page.evaluate(() => localStorage.getItem('sb-voyurnwckmateohuzbab-auth-token')));
        context.logoutFixture.fail = true;
        const errorsShown=[];
        const failingDialog = dialog => {
            if(dialog.type()==='confirm')void dialog.accept();
            else { errorsShown.push(dialog.message()); void dialog.dismiss(); }
        };
        page.on('dialog',failingDialog);
        await logout.click();
        await page.waitForFunction(() => document.querySelector('[aria-label^="Abrir menú de cuenta"]'));
        await page.waitForFunction(() => !!localStorage.getItem('sb-voyurnwckmateohuzbab-auth-token'));
        // Wait for the error alert to prove that the failed request has completed.
        for(let attempt=0;attempt<100&&!errorsShown.length;attempt++)await page.waitForTimeout(100);
        assert.equal(errorsShown.length,1,'a failed logout shows an error');
        page.off('dialog',failingDialog);
        assert.ok(context.logoutFixture.requests>0);
        assert.ok(await page.evaluate(() => localStorage.getItem('sb-voyurnwckmateohuzbab-auth-token')),'failed logout keeps credentials');
        assert.ok(!page.url().includes('/login'));
        context.logoutFixture.fail = false;
        await open();
        page.once('dialog', dialog => { assert.equal(dialog.type(),'confirm'); void dialog.accept(); });
        await page.getByTestId('account-menu-logout').click();
        await page.waitForURL('**/login');
        assert.equal(await page.getByTestId('account-menu-logout').count(),0);
        assert.equal(await page.evaluate(() => localStorage.getItem('sb-voyurnwckmateohuzbab-auth-token')),null,'successful logout clears the saved session');
        await context.close();
    }
    // Persisted appearance must also work while utility classes lag behind it.
    for (const [theme, surface, primary] of [
        ['light', 'rgb(255, 255, 255)', 'rgb(53, 49, 110)'],
        ['dark', 'rgb(35, 35, 35)', 'rgb(220, 235, 125)'],
        ['dark-honey', 'rgb(35, 35, 35)', 'rgb(237, 180, 88)'],
        ['dark-ocean', 'rgb(35, 35, 35)', 'rgb(0, 119, 182)'],
        ['dark-bubble', 'rgb(35, 35, 35)', 'rgb(239, 71, 111)'],
    ]) {
        context = await setup('es', 390, theme !== 'light');
        await context.addInitScript(selected => {
            localStorage.setItem('@theme', selected);
            window.homeThemeFrames = [];
            const sample = () => {
                const card = document.querySelector('[data-testid="home-sessions-empty"]');
                if (card) window.homeThemeFrames.push({
                    background: getComputedStyle(card).backgroundColor,
                    text: getComputedStyle(card.firstElementChild).color,
                });
                if (window.homeThemeFrames.length < 120) requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
        }, theme);
        await page.goto((process.env.BASE_URL || 'http://localhost:8082') + '/home');
        const empty = page.getByTestId('home-sessions-empty');
        await empty.waitFor();
        await page.waitForFunction(() => window.homeThemeFrames.length >= 2);
        const frames = await page.evaluate(() => window.homeThemeFrames);
        assert.ok(frames.every(frame => frame.background === surface), theme + ' empty card keeps the correct background from its first visible frame');
        // Reproduce the transient CSS state observed on the device.
        await page.evaluate(() => document.documentElement.classList.remove('dark'));
        assert.equal(await empty.evaluate(el => getComputedStyle(el).backgroundColor), surface, theme);
        assert.equal(await page.getByTestId('home-session-filter').evaluate(el => getComputedStyle(el).backgroundColor), surface, theme);
        const agreed = page.getByTestId('home-agreed-fees');
        assert.deepEqual(await agreed.evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).backgroundImage]), [primary, 'none'], theme);
        assert.ok((await empty.innerText()).includes('No hay sesiones aún'));
        if (theme === 'dark' || theme === 'dark-bubble') {
            await page.screenshot({ path: process.cwd() + '/../outputs/DJPlannerPro/home-empty-' + theme + '.png' });
        }
        await context.close();
    }
    for (const lang of ['es', 'en', 'de', 'fr', 'it', 'pt', 'ja']) {
        const copy = JSON.parse(
            fs.readFileSync('src/i18n/languages/' + lang + '.json'),
        );
        context = await setup(lang, 320, true);
        await page.goto((process.env.BASE_URL || 'http://localhost:8082')+'/community');
        await page.getByLabel(new RegExp('^' + copy.accountMenu.open)).click();
        await page
            .getByRole('button', {
                name: copy.accountMenu.discoverPro,
                exact: true,
            })
            .waitFor();
        assert.equal(
            await page.evaluate(
                () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
        );
        assert.ok(
            !(await page.locator('body').innerText()).includes('accountMenu.'),
        );
        await page
            .getByRole('button', {
                name: copy.accountMenu.discoverPro,
                exact: true,
            })
            .click();
        await page
            .getByRole('button', { name: copy.proPage.plans, exact: true })
            .waitFor();
        assert.equal(
            await page.evaluate(
                () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
        );
        await context.close();
    }
    assert.deepEqual(errors, []);
    console.log(
        'PASS logout moved to sidebar, deletion remains in settings, cancel/error retain session, confirmed logout clears credentials, drawer, notifications badge, free/Pro, profile/settings/plan navigation, paywall, Escape, five persisted appearances, no mixed empty-card colors while dark classes lag, solid agreed fees, seven languages at 320px. No real API changes or purchases.',
    );
    await browser.close();
})().catch(async (e) => {
    console.error(e);
    if (page && !page.isClosed()) {
        console.error('ERRORS', errors, 'URL', page.url());
        console.error(await page.locator('body').innerText());
        await page.screenshot({
            path: '/private/tmp/djplanner-drawer-failure.png',
        });
    }
    if (browser) await browser.close();
    process.exit(1);
});
