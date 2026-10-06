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
        avatar_url: 'https://example.invalid/avatar.jpg',
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
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
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
            if (msg.type() === 'error') console.error(msg.text().slice(0, 300));
        });
        return context;
    }

    const labels = JSON.parse(
        fs.readFileSync('src/i18n/languages/es.json', 'utf8'),
    );
    let context = await setup('es', 390, false, false);
    await page.goto('http://localhost:8081/conditional-session');
    await page
        .getByRole('button', {
            name: labels.conditional.newSession,
            exact: true,
        })
        .click();
    await page
        .getByRole('button', { name: 'Restaurar Compras', exact: true })
        .waitFor();
    await page.goto('http://localhost:8081/add-session?conditional=1');
    await page
        .getByRole('button', { name: 'Restaurar Compras', exact: true })
        .waitFor();
    await context.close();
    context = await setup('es', 390, false, true);
    const id = '00000000-0000-4000-8000-000000000919';
    let saved = {
        id,
        user_id: user.id,
        title: 'DJ night',
        venue: 'Sala X',
        venue_id: null,
        date: '2020-01-01',
        start_time: '22:00',
        end_time: '04:00',
        booking_timezone: 'Europe/Madrid',
        earning_type: 'fixed',
        earning_amount: 250,
        amount_paid: 50,
        currency: '€',
        status: 'confirmed',
        recurrence_type: 'none',
        djs: [],
        color: '#262626',
    };
    let patches = [];
    await context.route('**/rest/v1/sessions*', async (route) => {
        const req = route.request();
        if (req.method() === 'PATCH') {
            const patch = req.postDataJSON();
            patches.push(patch);
            saved = { ...saved, ...patch };
            return route.fulfill({ json: [saved] });
        }
        return route.fulfill({
            json: req.headers().accept?.includes('vnd.pgrst.object')
                ? saved
                : [saved],
        });
    });
    await page.goto('http://localhost:8081/conditional-session');
    await page
        .getByRole('button', {
            name: labels.conditional.existingSession,
            exact: true,
        })
        .click();
    await page.getByText('DJ night', { exact: true }).click();
    await page
        .getByRole('button', {
            name: labels.conditional.template_venue,
            exact: true,
        })
        .click();
    await page
        .getByRole('tab', { name: labels.conditional.forecast, exact: true })
        .click();
    await page
        .getByLabel(labels.conditional.expected, { exact: true })
        .fill('100');
    await page
        .getByText(/700,00/)
        .first()
        .waitFor();
    await page.screenshot({
        path: '/private/tmp/djplanner-conditional-forecast.png',
        fullPage: true,
    });
    await page
        .getByRole('button', {
            name: labels.conditional.saveTerms,
            exact: true,
        })
        .click();
    await page
        .getByRole('button', { name: labels.agreement.calculate, exact: true })
        .waitFor();
    assert.equal(patches.length, 1);
    assert.equal(saved.earning_type, 'agreement');
    assert.equal(saved.earning_amount, 0);
    assert.equal(saved.amount_paid, 50);
    assert.equal(saved.fee_agreement.version, 2);
    await page
        .getByRole('button', { name: labels.agreement.calculate, exact: true })
        .click();
    await page
        .getByRole('tab', { name: labels.conditional.close, exact: true })
        .click();
    await page.getByLabel(labels.conditional.sold, { exact: true }).fill('100');
    await page
        .getByLabel(labels.conditional.refunded, { exact: true })
        .fill('10');
    await page
        .getByRole('button', { name: labels.conditional.settle, exact: true })
        .click();
    await page
        .getByRole('tab', { name: labels.conditional.close, exact: true })
        .waitFor({ state: 'hidden' });
    await page
        .getByRole('button', { name: labels.agreement.calculate, exact: true })
        .waitFor();
    assert.equal(patches.length, 2);
    assert.equal(saved.earning_amount, 630);
    assert.equal(saved.amount_paid, 50);
    assert.equal(saved.fee_agreement.settled, true);
    const venue = {
        id: '00000000-0000-4000-8000-000000000912',
        user_id: user.id,
        name: 'Sala X',
        city: 'Sevilla',
        timezone: 'Europe/Madrid',
    };
    let created;
    await context.route('**/rest/v1/venues*', (route) =>
        route.fulfill({ json: [venue] }),
    );
    await context.route('**/rest/v1/rpc/get_session_usage', (route) =>
        route.fulfill({
            json: { count: 1, limit: 30, remaining: null, isPro: true },
        }),
    );
    await context.route(
        '**/rest/v1/rpc/create_session_series',
        async (route) => {
            created = route.request().postDataJSON().input;
            saved = { ...created, id, user_id: user.id, amount_paid: 0 };
            await route.fulfill({ json: saved });
        },
    );
    await page.goto('http://localhost:8081/add-session?conditional=1');
    await page
        .getByRole('button', { name: labels.agreement.configure, exact: true })
        .click();
    await page
        .getByRole('tab', { name: labels.conditional.close, exact: true })
        .waitFor();
    assert.equal(
        await page
            .getByRole('tab', { name: labels.conditional.close, exact: true })
            .getAttribute('aria-disabled'),
        'true',
    );
    await page
        .getByRole('button', {
            name: labels.conditional.template_combined,
            exact: true,
        })
        .click();
    await page.screenshot({
        path: '/private/tmp/djplanner-conditional-terms.png',
        fullPage: true,
    });
    await page
        .getByRole('button', {
            name: labels.conditional.saveTerms,
            exact: true,
        })
        .click();
    await page
        .getByRole('tab', { name: labels.conditional.terms, exact: true })
        .waitFor({ state: 'hidden' });
    await page.getByText('Ej: Club Amnesia', { exact: true }).click();
    await page.getByText('Sala X', { exact: true }).last().click();
    await page
        .getByRole('button', { name: 'Guardar sesión', exact: true })
        .click();
    await page
        .getByRole('button', { name: labels.agreement.edit, exact: true })
        .waitFor();
    await page.waitForURL('**/session/' + id);
    assert.equal(created.earning_type, 'agreement');
    assert.equal(created.earning_amount, 0);
    assert.equal(created.fee_agreement.version, 2);
    assert.equal(created.fee_agreement.barPercent, 10);
    assert.deepEqual(errors, []);
    console.log(
        'PASS: free user paywall, Pro conversion, forecast excluded from income, actual refunds/settlement, payments preserved and future settlement unavailable.',
    );
})()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => browser?.close());
