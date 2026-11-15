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

    const context = await setup('es', 390),
        labels = JSON.parse(
            fs.readFileSync('src/i18n/languages/es.json', 'utf8'),
        );
    const futureId = '00000000-0000-4000-8000-000000000871',
        pastId = '00000000-0000-4000-8000-000000000872';
    const events = [
        {
            id: futureId,
            user_id: user.id,
            title: 'Future Night',
            venue: 'Sala X',
            date: '2030-10-10',
            start_time: '22:00',
            end_time: '04:00',
            status: 'confirmed',
            djs: [],
            earning_type: 'fixed',
            earning_amount: 200,
            currency: '€',
            color: '#6554df',
            booking_timezone: 'Europe/Madrid',
        },
        {
            id: pastId,
            user_id: user.id,
            title: 'Past Night',
            venue: 'Sala X',
            date: '2020-10-10',
            start_time: '22:00',
            end_time: '04:00',
            status: 'confirmed',
            djs: [],
            earning_type: 'fixed',
            earning_amount: 100,
            currency: '€',
            color: '#6554df',
        },
    ];
    let expenses = [],
        tasks = [],
        blocks = [],
        uploads = [],
        lostPost = false,
        receiptDeletes = 0;
    await context.route('**/rest/v1/sessions*', (r) =>
        r.fulfill({ json: events }),
    );
    await context.route('**/rest/v1/expenses*', (r) => {
        const req = r.request(),
            p = req.postDataJSON?.();
        if (req.method() === 'POST') {
            const row = { ...p, created_at: new Date().toISOString() };
            const old = expenses.findIndex((e) => e.id === row.id);
            if (old >= 0) expenses[old] = row;
            else expenses.push(row);
            if (lostPost) {
                lostPost = false;
                return r.fulfill({
                    status: 503,
                    json: { message: 'Lost response' },
                });
            }
            return r.fulfill({ json: row });
        }
        if (req.method() === 'DELETE') {
            const id = new URL(req.url()).searchParams.get('id').slice(3);
            expenses = expenses.filter((e) => e.id !== id);
        }
        const filter = new URL(req.url()).searchParams.get('id');
        return r.fulfill({
            json: filter
                ? expenses.filter((e) => e.id === filter.slice(3))
                : expenses,
        });
    });
    await context.route('**/rest/v1/session_tasks*', (r) => {
        const req = r.request(),
            url = new URL(req.url());
        if (req.method() === 'POST') {
            const p = req.postDataJSON();
            tasks.push({
                ...p,
                completed: false,
                created_at: new Date().toISOString(),
            });
        }
        if (req.method() === 'PATCH') {
            const p = req.postDataJSON(),
                id = url.searchParams.get('id').slice(3);
            Object.assign(
                tasks.find((e) => e.id === id),
                p,
            );
        }
        if (req.method() === 'DELETE') {
            const id = url.searchParams.get('id').slice(3);
            tasks = tasks.filter((e) => e.id !== id);
        }
        return r.fulfill({ json: tasks });
    });
    await context.route('**/rest/v1/blocked_days*', (r) => {
        if (r.request().method() === 'DELETE') receiptDeletes++;
        if (r.request().method() === 'POST') {
            const p = r.request().postDataJSON();
            blocks = [{ date: p.date }];
        }
        if (r.request().method() === 'DELETE') blocks = [];
        return r.fulfill({ json: blocks });
    });
    await context.route(
        '**/storage/v1/object/expense-receipts**',
        async (r) => {
            if (r.request().method() === 'POST')
                uploads.push(r.request().postDataBuffer());
            return r.fulfill({ json: { Key: 'expense-receipts/demo.jpg' } });
        },
    );
    await context.route('**/storage/v1/object/sign/expense-receipts/**', (r) =>
        r.fulfill({
            json: {
                signedURL:
                    '/storage/v1/object/sign/expense-receipts/demo.jpg?token=test',
            },
        }),
    );
    await page.goto('http://localhost:8081/home');
    await page
        .getByRole('button', { name: labels.createMenu.title, exact: true })
        .click();
    for (const key of [
        'session',
        'conditional',
        'mix',
        'venue',
        'tickets',
        'guests',
        'expenses',
        'preparation',
    ])
        await page
            .getByRole('button', { name: labels.createMenu[key], exact: true })
            .waitFor();
    await page.screenshot({ path: '/private/tmp/djplanner-tools-menu.png' });
    await page
        .getByRole('button', { name: labels.createMenu.expenses, exact: true })
        .click();
    await page.getByRole('button', { name: /^Past Night 2020/ }).click();
    await page
        .getByRole('button', { name: labels.tools.addExpense, exact: true })
        .click();
    await page
        .getByRole('textbox', { name: labels.tools.concept, exact: true })
        .fill('Transporte');
    await page
        .getByRole('textbox', {
            name: labels.tools.amount + ' · EUR',
            exact: true,
        })
        .fill('40');
    await page
        .getByRole('button', { name: labels.tools.saveExpense, exact: true })
        .click();
    await page.getByText('Transporte', { exact: true }).waitFor();
    assert.equal(expenses[0].session_id, pastId);
    assert.equal(expenses[0].amount, 40);
    assert.equal(expenses[0].currency, 'EUR');
    await page.screenshot({
        path: '/private/tmp/djplanner-tools-expenses.png',
    });
    await page
        .getByRole('button', { name: labels.tools.editExpense, exact: true })
        .click();
    await page
        .getByRole('textbox', {
            name: labels.tools.amount + ' · EUR',
            exact: true,
        })
        .fill('35,50');
    await page
        .getByRole('button', { name: labels.tools.saveExpense, exact: true })
        .click();
    await page.getByText('35,50 €', { exact: true }).first().waitFor();
    assert.equal(expenses.length, 1);
    assert.equal(expenses[0].amount, 35.5);

    await page
        .getByRole('button', { name: labels.tools.editExpense, exact: true })
        .click();
    const imageData = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 3000;
        canvas.height = 2000;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 3000, 2000);
        ctx.font = '110px Arial';
        ctx.fillStyle = 'black';
        ctx.fillText('FACTURA 001 - Transporte', 180, 300);
        return canvas.toDataURL('image/png').split(',')[1];
    });
    const chooser = page.waitForEvent('filechooser');
    await page
        .getByRole('button', { name: labels.tools.gallery, exact: true })
        .click();
    await (
        await chooser
    ).setFiles({
        name: 'factura.png',
        mimeType: 'image/png',
        buffer: Buffer.from(imageData, 'base64'),
    });
    await page
        .getByRole('button', { name: labels.tools.removePhoto, exact: true })
        .waitFor();
    await page.screenshot({
        path: '/private/tmp/djplanner-tools-receipt-form.png',
    });
    await page
        .getByRole('button', { name: labels.tools.saveExpense, exact: true })
        .click();
    await page
        .getByRole('button', { name: labels.tools.viewReceipt, exact: true })
        .waitFor();
    assert.equal(uploads.length, 1);
    assert.ok(uploads[0].length <= 600 * 1024);
    assert.equal(uploads[0][0], 0xff);
    assert.equal(uploads[0][1], 0xd8);
    assert.ok(expenses[0].receipt_path.startsWith(user.id + '/'));
    const dims = await page.evaluate(async (b64) => {
        const blob = await (
                await fetch('data:image/jpeg;base64,' + b64)
            ).blob(),
            image = await createImageBitmap(blob);
        return [image.width, image.height];
    }, uploads[0].toString('base64'));
    assert.ok(Math.max(...dims) <= 1600);
    console.log(
        'Receipt compression verified:',
        uploads[0].length,
        'bytes, dimensions',
        dims,
    );
    await page
        .getByRole('button', { name: labels.tools.addExpense, exact: true })
        .click();
    await page
        .getByRole('textbox', { name: labels.tools.concept, exact: true })
        .fill('Alojamiento');
    await page
        .getByRole('textbox', {
            name: labels.tools.amount + ' · EUR',
            exact: true,
        })
        .fill('60');
    const lostChooser = page.waitForEvent('filechooser');
    await page
        .getByRole('button', { name: labels.tools.gallery, exact: true })
        .click();
    await (
        await lostChooser
    ).setFiles({
        name: 'factura.png',
        mimeType: 'image/png',
        buffer: Buffer.from(imageData, 'base64'),
    });
    await page
        .getByRole('button', { name: labels.tools.removePhoto, exact: true })
        .waitFor();
    lostPost = true;
    await page
        .getByRole('button', { name: labels.tools.saveExpense, exact: true })
        .click();
    await page.getByText(labels.tools.saveError, { exact: true }).waitFor();
    await page
        .getByRole('button', { name: labels.cancel, exact: true })
        .click();
    await page.getByText('Alojamiento', { exact: true }).waitFor();
    assert.equal(
        receiptDeletes,
        0,
        'Cancel must not delete an invoice whose save already committed',
    );
    assert.equal(expenses.length, 2);
    await page.goto('http://localhost:8081/preparation');
    await page.getByText('Future Night', { exact: true }).waitFor();
    assert.equal(
        await page.getByText('Past Night', { exact: true }).count(),
        0,
    );
    await page.getByRole('button', { name: /^Future Night 2030/ }).click();
    await page
        .getByRole('textbox', { name: labels.tools.task, exact: true })
        .fill('Preparar USB');
    await page
        .getByRole('button', { name: labels.tools.addTask, exact: true })
        .click();
    await page
        .getByRole('checkbox', { name: 'Preparar USB', exact: true })
        .waitFor();
    await page
        .getByRole('checkbox', { name: 'Preparar USB', exact: true })
        .click();
    await page.getByText('1 / 1', { exact: true }).waitFor();
    assert.equal(tasks[0].completed, true);
    await page.screenshot({
        path: '/private/tmp/djplanner-tools-preparation.png',
    });
    await page.goto('http://localhost:8081/history');
    await page
        .getByRole('button', { name: labels.tools.blockDay, exact: true })
        .click();
    await page.getByText(labels.tools.dayBlocked, { exact: true }).waitFor();
    assert.equal(blocks.length, 1);
    await page.screenshot({
        path: '/private/tmp/djplanner-tools-calendar.png',
    });
    await page
        .getByRole('button', { name: labels.tools.unblockDay, exact: true })
        .click();
    await page
        .getByRole('button', { name: labels.tools.blockDay, exact: true })
        .waitFor();
    assert.equal(blocks.length, 0);
    blocks = [{ date: '2030-11-10' }];
    let creates = 0;
    await context.route('**/rest/v1/venues*', (r) =>
        r.fulfill({
            json: [
                {
                    id: '00000000-0000-4000-8000-000000000873',
                    user_id: user.id,
                    name: 'Sala X',
                    city: 'Madrid',
                },
            ],
        }),
    );
    await context.route('**/rest/v1/rpc/get_session_usage', (r) =>
        r.fulfill({
            json: { count: 2, limit: 30, remaining: 28, isPro: false },
        }),
    );
    await context.route('**/rest/v1/rpc/create_session_series', (r) => {
        creates++;
        const input = r.request().postDataJSON().input;
        return r.fulfill({
            json: {
                ...input,
                id: '00000000-0000-4000-8000-000000000874',
                user_id: user.id,
            },
        });
    });
    await page.goto('http://localhost:8081/add-session?date=2030-11-10');
    await page.getByText(labels.venue_placeholder, { exact: true }).click();
    await page.getByText('Sala X', { exact: true }).last().click();
    let warning = '';
    page.once('dialog', async (d) => {
        warning = d.message();
        await d.dismiss();
    });
    await page
        .getByRole('button', { name: 'Guardar sesión', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Guardar sesión', exact: true })
        .waitFor();
    assert.ok(warning.includes('2030-11-10'));
    assert.equal(creates, 0);
    page.once('dialog', (d) => d.accept());
    await page
        .getByRole('button', { name: 'Guardar sesión', exact: true })
        .click();
    await page.waitForURL('**/session/00000000-0000-4000-8000-000000000874');
    assert.equal(creates, 1);
    assert.deepEqual(errors, []);
    console.log(
        'Session tools UI: eight menu entries, past session expenses, edits, upcoming task check-in, calendar block/unblock passed',
    );
    await browser.close();
})().catch(async (e) => {
    console.error(e);
    if (page)
        await page
            .screenshot({ path: '/private/tmp/djplanner-tools-failure.png' })
            .catch(() => {});
    await browser?.close();
    process.exitCode = 1;
});
