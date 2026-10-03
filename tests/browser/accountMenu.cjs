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
                localStorage.setItem('@theme', dark ? 'dark' : 'light');
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
        return context;
    }
    let context = await setup();
    await page.goto('http://localhost:8081/community');
    const open = () =>
        page.getByRole('button', { name: /^Abrir menú de cuenta/ }).click();
    await open();
    await page
        .getByRole('button', { name: 'Descubrir Pro', exact: true })
        .waitFor();
    await page.waitForFunction(
        () =>
            document
                .querySelector('[aria-label="Ver mi perfil de DJ"]')
                ?.getBoundingClientRect().x < 80,
    );
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
        (await page.locator('body').innerText()).includes('PRÓXIMAMENTE'),
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
    await page.getByRole('button', { name: 'Mi plan', exact: true }).click();
    await page.getByText('12 / 30 sesiones', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Volver', exact: true }).click();
    await page.waitForTimeout(500);
    await open();
    await page.waitForFunction(
        () =>
            document
                .querySelector('[aria-label="Ver mi perfil de DJ"]')
                ?.getBoundingClientRect().x < 80,
    );
    await page.keyboard.press('Escape');
    await page
        .getByRole('button', { name: 'Ver mi perfil de DJ', exact: true })
        .waitFor({ state: 'hidden' });
    await context.close();
    context = await setup('es', 390, true, true);
    await page.goto('http://localhost:8081/community');
    await open();
    await page.getByRole('button', { name: 'Mi plan', exact: true }).waitFor();
    assert.equal(
        await page
            .getByRole('button', { name: 'Descubrir Pro', exact: true })
            .count(),
        0,
    );
    await page.waitForTimeout(350);
    await page.screenshot({
        path: '/private/tmp/djplanner-account-drawer-pro-dark.png',
    });
    await context.close();
    for (const lang of ['es', 'en', 'de', 'fr', 'it', 'pt', 'ja']) {
        const copy = JSON.parse(
            fs.readFileSync('src/i18n/languages/' + lang + '.json'),
        );
        context = await setup(lang, 320, true);
        await page.goto('http://localhost:8081/community');
        await page
            .getByRole('button', {
                name: new RegExp('^' + copy.accountMenu.open),
            })
            .click();
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
        'PASS drawer, notifications badge, free/Pro, profile/settings/plan navigation, paywall, Escape, seven languages at 320px. No real API changes or purchases.',
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
