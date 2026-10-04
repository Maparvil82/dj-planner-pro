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
        page.on('dialog', (d) => d.accept());
        page.on('pageerror', (e) => errors.push(e.message));
        return context;
    }

    let context = await setup('es', 390, false, true);
    const venue = {
        id: '00000000-0000-4000-8000-000000000912',
        user_id: user.id,
        name: 'Sala X',
        city: 'Sevilla',
    };
    const sessionId = '00000000-0000-4000-8000-000000000919';
    let saved,
        patches = 0;
    await context.route('**/*.supabase.co/**', async (route) => {
        const req = route.request(),
            url = new URL(req.url());
        let body;
        if (url.pathname.endsWith('/venues')) body = [venue];
        else if (url.pathname.endsWith('/rpc/get_session_usage'))
            body = { count: 1, limit: 30, remaining: null, isPro: true };
        else if (url.pathname.endsWith('/rpc/create_session_series')) {
            saved = {
                ...req.postDataJSON().input,
                id: sessionId,
                user_id: user.id,
                amount_paid: 0,
            };
            body = saved;
        } else if (url.pathname.endsWith('/sessions')) {
            if (req.method() === 'PATCH') {
                saved = { ...saved, ...req.postDataJSON() };
                patches++;
                body = [{ id: sessionId }];
            } else
                body = req.headers().accept?.includes('vnd.pgrst.object')
                    ? { ...saved, place: { city: venue.city } }
                    : saved
                      ? [{ ...saved, place: { city: venue.city } }]
                      : [];
        } else {
            await route.fallback();
            return;
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body),
        });
    });
    const labels = JSON.parse(
        fs.readFileSync(
            require('node:path').join(
                __dirname,
                '../../src/i18n/languages/es.json',
            ),
            'utf8',
        ),
    ).agreement;
    if (
        /feeAgreements:\s*false/.test(
            fs.readFileSync(
                require('node:path').join(
                    __dirname,
                    '../../src/config/features.ts',
                ),
                'utf8',
            ),
        )
    ) {
        await page.goto('http://localhost:8081/add-session');
        await page
            .getByRole('textbox', {
                name: 'Nombre del evento · Opcional',
                exact: true,
            })
            .waitFor();
        assert.equal(
            await page
                .getByRole('button', { name: 'Por acuerdo PRO', exact: true })
                .count(),
            0,
        );
        for (const name of ['Gratis', 'Por hora', 'Por sesión'])
            await page.getByText(name, { exact: true }).waitFor();
        await page.goto('http://localhost:8081/pro');
        await page
            .getByText(labels.proBenefit, { exact: true })
            .waitFor({ state: 'hidden' });
        await page.goto('http://localhost:8081/paywall?reason=agreement');
        await page
            .getByRole('button', { name: 'Restaurar Compras', exact: true })
            .waitFor();
        assert.equal(
            await page.getByText(labels.proBenefit, { exact: true }).count(),
            0,
        );
        assert.deepEqual(errors, []);
        await context.close();
        await browser.close();
        console.log(
            'PASS fee agreement hidden; original fee options and paywall preserved. Mock APIs.',
        );
        return;
    }
    await page.goto('http://localhost:8081/add-session?date=2020-01-01');
    await page.getByText('Ej: Club Amnesia', { exact: true }).click();
    await page.getByText('Sala X', { exact: true }).last().click();
    await page
        .getByRole('button', { name: 'Por acuerdo PRO', exact: true })
        .click();
    await page
        .getByRole('button', { name: labels.configure, exact: true })
        .click();
    await page
        .getByRole('textbox', { name: labels.fixed, exact: true })
        .fill('100');
    await page
        .getByRole('textbox', { name: labels.perTicket, exact: true })
        .fill('2');
    await page
        .getByRole('textbox', { name: labels.entryPercent, exact: true })
        .fill('10');
    await page
        .getByRole('textbox', { name: labels.barPercent, exact: true })
        .fill('5');
    await page
        .getByRole('textbox', { name: labels.expenses, exact: true })
        .fill('20');
    await page.getByRole('button', { name: labels.addDj, exact: true }).click();
    await page
        .getByRole('textbox', { name: labels.djName, exact: true })
        .fill('Pepe');
    await page.getByRole('button', { name: labels.save, exact: true }).click();
    await page
        .getByRole('button', { name: 'Guardar sesión', exact: true })
        .click();
    await page.waitForURL('**/session/' + sessionId);
    assert.equal(saved.earning_type, 'agreement');
    assert.equal(saved.fee_agreement.settled, false);
    assert.equal(saved.earning_amount, 0);
    await page.getByText('Por liquidar', { exact: true }).waitFor();
    await page
        .getByRole('button', { name: labels.calculate, exact: true })
        .click();
    await page
        .getByRole('button', { name: labels.useActual, exact: true })
        .click();
    await page
        .getByRole('textbox', { name: labels.tickets, exact: true })
        .fill('100');
    await page
        .getByRole('textbox', { name: labels.entries, exact: true })
        .fill('1000');
    await page
        .getByRole('textbox', { name: labels.bar, exact: true })
        .fill('2000');
    await page
        .getByRole('button', { name: labels.settle, exact: true })
        .click();
    await page
        .getByText(labels.editorHint, { exact: true })
        .waitFor({ state: 'hidden' });
    assert.equal(saved.fee_agreement.settled, true);
    assert.equal(saved.earning_amount, 240);
    assert.equal(saved.amount_paid, 0);
    assert.equal(patches, 1);
    await page.screenshot({ path: '/private/tmp/djplanner-fee-agreement.png' });
    await context.close();
    context = await setup('es', 390, true, false);
    await page.goto('http://localhost:8081/add-session?date=2027-01-01');
    await page
        .getByRole('button', { name: 'Por acuerdo PRO', exact: true })
        .click();
    await page.waitForURL('**/paywall?reason=agreement');
    await page.getByText(labels.proBenefit, { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    await browser.close();
    console.log(
        'PASS agreement creation, calculator settlement, payment kept separate, and free-user Pro paywall. Mock APIs.',
    );
})().catch(async (e) => {
    console.error(e);
    if (page && !page.isClosed()) {
        console.error('ERRORS', errors, 'URL', page.url());
        console.error(await page.locator('body').innerText());
        await page.screenshot({
            path: '/private/tmp/djplanner-agreement-failure.png',
        });
    }
    if (browser) await browser.close();
    process.exitCode = 1;
});
