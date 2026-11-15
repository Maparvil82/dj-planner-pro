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
            if (msg.type() === 'error') {
                console.error(msg.text().slice(0, 300));
                if (/unique.*key/.test(msg.text())) errors.push(msg.text());
            }
        });
        return context;
    }

    const labels = JSON.parse(
        fs.readFileSync('src/i18n/languages/es.json', 'utf8'),
    );
    let context = await setup('es', 390, false, false);
    await page.goto('http://localhost:8081/conditional-session');
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
        djs: ['DJ Demo', 'Pepe', 'pepe'],
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
    const flow = labels.conditionalFlow;
    const costs = labels.conditionalCosts;
    // Exercise the real + menu entry, including closing and reopening it.
    await page.goto('http://localhost:8081/home');
    await page
        .getByRole('button', { name: labels.createMenu.title, exact: true })
        .click();
    await page
        .getByRole('button', {
            name: labels.createMenu.conditional,
            exact: true,
        })
        .click();
    await page
        .getByRole('radio', {
            name: flow.model_ticket + ' ' + flow.example_ticket,
            exact: true,
        })
        .waitFor();
    assert.equal(
        await page
            .getByRole('button', {
                name: labels.conditional.newSession,
                exact: true,
            })
            .count(),
        0,
        'No target selection before the agreement',
    );
    await page.getByRole('button', { name: labels.back, exact: true }).click();
    await page.waitForURL('**/home');
    await page
        .getByRole('button', { name: labels.createMenu.title, exact: true })
        .click();
    await page
        .getByRole('button', {
            name: labels.createMenu.conditional,
            exact: true,
        })
        .click();
    const option = page.getByRole('radio', {
        name: flow.model_ticket + ' ' + flow.example_ticket,
        exact: true,
    });
    await option.waitFor();
    const rect = await option.boundingBox();
    assert.ok(Math.abs(rect.width - rect.height) < 2, 'Options are square');
    await option.click();
    await page.getByLabel(flow.price, { exact: true }).fill('10');
    await page.getByLabel(flow.value_dj_fixed, { exact: true }).fill('7');
    const priceRect = await page
        .getByLabel(flow.price, { exact: true })
        .boundingBox();
    const shareRect = await page
        .getByLabel(flow.value_dj_fixed, { exact: true })
        .boundingBox();
    assert.ok(priceRect.y < shareRect.y, 'Ticket price comes before DJ fee');
    await page.getByLabel(flow.price, { exact: true }).fill('5');
    await page.getByLabel(flow.value_dj_fixed, { exact: true }).fill('6');
    await page
        .getByRole('button', { name: labels.continue, exact: true })
        .click();
    await page
        .getByText(flow.feeExceedsPrice, { exact: true })
        .first()
        .waitFor();
    assert.equal(
        await page
            .getByRole('button', {
                name: labels.conditional.newSession,
                exact: true,
            })
            .count(),
        0,
    );
    await page.getByLabel(flow.price, { exact: true }).fill('10');
    await page.getByLabel(flow.value_dj_fixed, { exact: true }).fill('7');
    await page
        .getByRole('button', {
            name: labels.continue,
            exact: true,
        })
        .click();
    await page
        .getByRole('button', {
            name: labels.conditional.existingSession,
            exact: true,
        })
        .click();
    await page.getByText('DJ night', { exact: true }).click();
    assert.equal(
        patches.length,
        0,
        'Choosing a session alone does not write the agreement',
    );
    await page
        .getByRole('button', { name: flow.applyAndSave, exact: true })
        .click();
    await page
        .getByRole('button', {
            name: labels.agreementPdf.download,
            exact: true,
        })
        .waitFor();
    assert.equal(
        patches.length,
        1,
        'Agreement applied once to the selected session',
    );
    assert.equal(saved.fee_agreement.ticketValue, 7);
    await page
        .getByRole('button', { name: flow.editAgreement, exact: true })
        .click();
    patches.length = 0;
    await page
        .getByRole('radio', {
            name: flow.model_ticket + ' ' + flow.example_ticket,
            exact: true,
        })
        .click();
    await page.getByLabel(flow.price, { exact: true }).fill('10');
    await page.getByLabel(flow.value_dj_fixed, { exact: true }).fill('7');
    assert.equal(
        await page
            .getByRole('button', { name: flow.addCondition, exact: true })
            .count(),
        0,
    );
    assert.equal(
        await page
            .getByRole('button', { name: flow.morePrices, exact: true })
            .count(),
        1,
    );
    await page
        .getByRole('button', { name: flow.morePrices, exact: true })
        .click();
    assert.equal(
        await page
            .getByLabel(labels.conditional.ticketName + ' 2', { exact: true })
            .inputValue(),
        flow.ticketType.replace('{{number}}', '2'),
    );
    await page
        .getByLabel(
            labels.conditional.ticketPrice +
                ' · ' +
                flow.ticketType.replace('{{number}}', '2'),
            { exact: true },
        )
        .fill('20');
    await page
        .getByRole('switch', { name: flow.shareDjs, exact: true })
        .click();
    assert.equal(
        await page
            .getByLabel(flow.otherDj + ' 1', { exact: true })
            .inputValue(),
        'Pepe',
    );
    assert.equal(
        await page.getByLabel(flow.otherDj + ' 2', { exact: true }).count(),
        0,
        'Owner and duplicate collaborator excluded',
    );
    await page.screenshot({
        path: '/private/tmp/djplanner-ticket-types.png',
        fullPage: true,
    });
    await page.getByLabel(flow.otherDj + ' 1', { exact: true }).fill('');
    await page
        .getByRole('button', { name: flow.trySales, exact: true })
        .click();
    await page.getByText(flow.djNamesRequired, { exact: true }).waitFor();
    assert.equal(
        await page.getByLabel(flow.expected, { exact: true }).count(),
        0,
        'Invalid agreement stays editable',
    );
    await page.getByLabel(flow.otherDj + ' 1', { exact: true }).fill('dj demo');
    await page
        .getByRole('button', { name: flow.trySales, exact: true })
        .click();
    await page.getByText(flow.duplicateDj, { exact: true }).waitFor();
    await page.getByLabel(flow.otherDj + ' 1', { exact: true }).fill('Pepe');
    await page
        .getByRole('button', { name: flow.trySales, exact: true })
        .click();
    assert.equal(
        await page
            .getByRole('button', { name: flow.backAgreement, exact: true })
            .count(),
        1,
    );
    await page.getByLabel(flow.expected, { exact: true }).nth(0).fill('100');
    await page.getByLabel(flow.expected, { exact: true }).nth(1).fill('20');
    await page
        .getByText(/420,00/)
        .first()
        .waitFor();
    await page
        .getByRole('button', { name: flow.backAgreement, exact: true })
        .click();
    await page
        .getByRole('button', { name: flow.trySales, exact: true })
        .click();
    assert.equal(
        await page
            .getByLabel(flow.expected, { exact: true })
            .nth(0)
            .inputValue(),
        '100',
    );
    assert.equal(
        await page
            .getByLabel(flow.expected, { exact: true })
            .nth(1)
            .inputValue(),
        '20',
    );
    await page
        .getByText(/420,00/)
        .first()
        .waitFor();
    await page
        .getByRole('button', { name: flow.backAgreement, exact: true })
        .click();
    await page
        .getByRole('button', {
            name: labels.conditional.removeTicket,
            exact: true,
        })
        .nth(1)
        .click();
    await page
        .getByRole('switch', { name: flow.shareDjs, exact: true })
        .click();
    // Additional conditions remain available in the combined model.
    await page
        .getByRole('radio', {
            name: flow.model_combined + ' ' + flow.example_combined,
            exact: true,
        })
        .click();
    await page.getByLabel(flow.price, { exact: true }).fill('10');
    await page
        .getByRole('radio', {
            name: labels.conditional.ticketMode_dj_fixed,
            exact: true,
        })
        .click();
    await page.getByLabel(flow.value_dj_fixed, { exact: true }).fill('7');
    await page.getByLabel(flow.barPercent, { exact: true }).fill('10');
    assert.equal(await page.getByRole('tab').count(), 0);
    assert.equal(
        await page.getByLabel(flow.minimum, { exact: true }).count(),
        0,
    );
    await page
        .getByRole('button', { name: flow.addCondition, exact: true })
        .click();
    await page
        .getByRole('button', { name: flow.extra_minimum, exact: true })
        .click();
    await page.getByLabel(flow.minimum, { exact: true }).fill('200');
    await page
        .getByRole('button', { name: flow.removeCondition, exact: true })
        .click();
    await page
        .getByRole('button', { name: flow.addCondition, exact: true })
        .click();
    await page
        .getByRole('button', { name: flow.extra_expenses, exact: true })
        .click();
    await page.getByRole('button', { name: costs.add, exact: true }).click();
    await page.getByLabel(costs.concept, { exact: true }).fill('Transporte');
    await page.getByLabel(costs.amount, { exact: true }).fill('20');
    await page.getByRole('button', { name: costs.add, exact: true }).click();
    await page
        .getByLabel(costs.concept, { exact: true })
        .nth(1)
        .fill('Agencia');
    await page
        .getByRole('radio', { name: costs.percent, exact: true })
        .nth(1)
        .click();
    await page.getByLabel(costs.percentage, { exact: true }).fill('10');
    await page
        .getByRole('button', { name: flow.trySales, exact: true })
        .click();
    await page.getByLabel(flow.expected, { exact: true }).fill('100');
    await page
        .getByText(/610,00/)
        .first()
        .waitFor();
    await page.screenshot({
        path: '/private/tmp/djplanner-conditional-forecast.png',
        fullPage: true,
    });
    await page
        .getByRole('button', { name: flow.backAgreement, exact: true })
        .last()
        .click();
    await page
        .getByRole('button', {
            name: labels.conditional.saveTerms,
            exact: true,
        })
        .click();
    await page
        .getByRole('button', { name: flow.calculate, exact: true })
        .waitFor();
    await page
        .getByRole('button', {
            name: labels.agreementPdf.download,
            exact: true,
        })
        .click();
    await page.locator('iframe[srcdoc]').waitFor({ state: 'attached' });
    const exported = await page
        .locator('iframe[srcdoc]')
        .getAttribute('srcdoc');
    assert.ok(
        exported.includes('DJ night') &&
            exported.includes('Pendiente de revisión'),
    );
    assert.ok(
        !exported.includes('610,00'),
        'Forecast excluded from agreement PDF',
    );
    await page.locator('iframe[srcdoc]').evaluate((frame) => frame.remove());
    assert.equal(patches.length, 1);
    assert.equal(saved.earning_type, 'agreement');
    assert.equal(saved.earning_amount, 0);
    assert.equal(saved.amount_paid, 50);
    assert.equal(saved.fee_agreement.version, 2);
    assert.equal(saved.fee_agreement.minimum, 0);
    assert.equal(saved.fee_agreement.tickets[0].estimate, 100);
    assert.equal(saved.fee_agreement.participants.length, 1);
    assert.equal(saved.fee_agreement.expenseItems.length, 2);
    await page
        .getByRole('button', { name: flow.calculate, exact: true })
        .click();
    await page.getByLabel(flow.sold, { exact: true }).fill('100');
    await page
        .getByRole('button', { name: flow.addRefunds, exact: true })
        .click();
    await page
        .getByLabel(labels.conditional.refunded, { exact: true })
        .fill('10');
    await page
        .getByRole('button', { name: flow.saveResult, exact: true })
        .click();
    await page
        .getByRole('button', { name: flow.adjustResult, exact: true })
        .waitFor();
    assert.equal(patches.length, 2);
    assert.equal(saved.earning_amount, 547);
    assert.equal(saved.amount_paid, 50);
    assert.equal(saved.fee_agreement.settled, true);
    await page
        .getByRole('button', { name: flow.editAgreement, exact: true })
        .click();
    assert.equal(
        await page
            .getByLabel(flow.value_dj_fixed, { exact: true })
            .inputValue(),
        '7',
    );
    await page
        .getByRole('button', {
            name: labels.conditional.saveTerms,
            exact: true,
        })
        .click();
    await page
        .getByRole('button', { name: flow.adjustResult, exact: true })
        .waitFor();
    assert.equal(saved.fee_agreement.tickets[0].sold, 100);
    assert.equal(saved.earning_amount, 547);
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
    await page.goto('http://localhost:8081/conditional-session');
    await page
        .getByRole('radio', {
            name: flow.model_combined + ' ' + flow.example_combined,
            exact: true,
        })
        .click();
    await page.getByLabel(flow.price, { exact: true }).fill('10');
    await page.getByLabel(flow.value_percent, { exact: true }).fill('70');
    await page.getByLabel(flow.barPercent, { exact: true }).fill('10');
    await page.screenshot({
        path: '/private/tmp/djplanner-conditional-terms.png',
        fullPage: true,
    });
    assert.equal(
        await page
            .getByRole('button', { name: flow.calculate, exact: true })
            .count(),
        0,
    );
    await page
        .getByRole('button', {
            name: labels.continue,
            exact: true,
        })
        .click();
    await page
        .getByRole('button', {
            name: labels.conditional.newSession,
            exact: true,
        })
        .click();
    await page
        .getByRole('button', { name: flow.editAgreement, exact: true })
        .waitFor();
    await page.getByText('Ej: Club Amnesia', { exact: true }).click();
    await page.getByText('Sala X', { exact: true }).last().click();
    await page
        .getByRole('button', { name: 'Guardar sesión', exact: true })
        .click();
    await page
        .getByRole('button', { name: flow.editAgreement, exact: true })
        .waitFor();
    await page.waitForURL('**/session/' + id);
    assert.equal(created.earning_type, 'agreement');
    assert.equal(created.earning_amount, 0);
    assert.equal(created.fee_agreement.version, 2);
    assert.equal(created.fee_agreement.barPercent, 10);
    await context.close();
    context = await setup('en', 320, true, true);
    const english = JSON.parse(
        fs.readFileSync('src/i18n/languages/en.json', 'utf8'),
    );
    const en = english.conditionalFlow;
    await page.goto(
        'http://localhost:8081/add-session?conditional=1&testTheme=dark',
    );
    await page
        .getByRole('button', { name: en.defineAgreement, exact: true })
        .click();
    await page
        .getByRole('radio', {
            name: en.model_bar + ' ' + en.example_bar,
            exact: true,
        })
        .click();
    await page.getByLabel(en.barPercent, { exact: true }).fill('10');
    await page.getByRole('button', { name: en.trySales, exact: true }).click();
    await page
        .getByLabel(english.conditional.barRevenue, { exact: true })
        .fill('1000');
    await page
        .getByText(/100.00/)
        .first()
        .waitFor();
    assert.equal(await page.getByLabel(en.sold, { exact: true }).count(), 0);
    await page.screenshot({
        path: '/private/tmp/djplanner-conditional-dark-320.png',
        fullPage: true,
    });
    assert.equal(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
    );
    assert.equal(await page.getByText(/conditionalFlow\./).count(), 0);
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
