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

    const context = await setup('es', 390, false, false),
        labels = JSON.parse(
            fs.readFileSync('src/i18n/languages/es.json', 'utf8'),
        );
    const id = '00000000-0000-4000-8000-000000000919';
    const event = {
        id,
        user_id: user.id,
        title: 'Soul Night',
        venue: 'Sala X',
        date: '2026-10-10',
        start_time: '22:00',
        end_time: '04:00',
        earning_type: 'fixed',
        earning_amount: 200,
        currency: '€',
        status: 'confirmed',
        recurrence_type: 'none',
        djs: [],
        color: '#6554df',
    };
    let types = [],
        tickets = [],
        scanCalls = 0,
        issueCalls = 0;
    const response = (route, data) => route.fulfill({ json: data });
    await context.route('**/rest/v1/sessions*', (r) =>
        response(
            r,
            r.request().headers().accept?.includes('vnd.pgrst.object')
                ? event
                : [event],
        ),
    );
    await context.route('**/rest/v1/event_ticket_types*', (r) =>
        response(r, types),
    );
    await context.route('**/rest/v1/event_tickets*', (r) =>
        response(r, [...tickets].reverse()),
    );
    await context.route('**/rest/v1/rpc/add_event_ticket_type', async (r) => {
        const p = r.request().postDataJSON();
        const kind = {
            id: crypto.randomUUID(),
            session_id: id,
            name: p.p_name,
            price: p.p_price,
            is_invitation: p.p_invitation,
            created_at: new Date().toISOString(),
        };
        types.push(kind);
        await response(
            r,
            r.request().headers().accept?.includes('vnd.pgrst.object')
                ? kind
                : [kind],
        );
    });
    await context.route('**/rest/v1/rpc/issue_event_tickets', async (r) => {
        issueCalls++;
        const p = r.request().postDataJSON();
        const made = Array.from({ length: p.p_quantity }, (_, i) => ({
            id: crypto.randomUUID(),
            token: crypto.randomUUID(),
            session_id: id,
            type_id: p.p_type,
            batch_id: p.p_batch,
            ordinal: i + 1,
            payment_status: p.p_payment,
            state: 'issued',
            checked_in_at: null,
            created_at: new Date().toISOString(),
        }));
        tickets.push(...made);
        await response(r, made);
    });
    await context.route('**/rest/v1/rpc/change_event_ticket', async (r) => {
        const p = r.request().postDataJSON(),
            ticket = tickets.find((t) => t.id === p.p_ticket);
        if (p.p_action === 'paid') ticket.payment_status = 'paid';
        else ticket.state = 'cancelled';
        await response(
            r,
            r.request().headers().accept?.includes('vnd.pgrst.object')
                ? ticket
                : [ticket],
        );
    });
    await context.route('**/rest/v1/rpc/check_in_event_ticket', async (r) => {
        scanCalls++;
        const p = r.request().postDataJSON(),
            ticket = tickets.find((t) => t.token === p.p_token);
        let out = { status: 'invalid' };
        if (ticket) {
            const kind = types.find((k) => k.id === ticket.type_id);
            out = {
                type_name: kind.name,
                status:
                    ticket.state === 'used'
                        ? 'already_used'
                        : ticket.state === 'cancelled'
                          ? 'cancelled'
                          : ticket.payment_status === 'pending'
                            ? 'pending'
                            : 'accepted',
                ticket_id: ticket.id,
                price: kind.price,
            };
            if (out.status === 'accepted') {
                ticket.state = 'used';
                ticket.checked_in_at = new Date().toISOString();
            }
            out.checked_in_at = ticket.checked_in_at;
        }
        await response(r, out);
    });
    await context.route('**/rest/v1/rpc/event_ticket_summary', (r) =>
        response(r, {
            issued: tickets.length,
            accepted: tickets.filter((t) => t.state === 'used').length,
            paid: tickets.filter(
                (t) => t.state !== 'cancelled' && t.payment_status === 'paid',
            ).length,
            pending: tickets.filter(
                (t) =>
                    t.state !== 'cancelled' && t.payment_status === 'pending',
            ).length,
            invited: tickets.filter(
                (t) =>
                    t.state !== 'cancelled' &&
                    t.payment_status === 'invitation',
            ).length,
            cancelled: tickets.filter((t) => t.state === 'cancelled').length,
            revenue: tickets
                .filter(
                    (t) =>
                        t.state !== 'cancelled' && t.payment_status === 'paid',
                )
                .reduce(
                    (n, t) => n + types.find((k) => k.id === t.type_id).price,
                    0,
                ),
            by_type: types.map((k) => ({
                ...k,
                issued: tickets.filter(
                    (t) => t.type_id === k.id && t.state !== 'cancelled',
                ).length,
                accepted: tickets.filter(
                    (t) => t.type_id === k.id && t.state === 'used',
                ).length,
            })),
        }),
    );
    const button = (n) => page.getByRole('button', { name: n, exact: true });
    await page.goto('http://localhost:8081/home');
    await button(labels.createMenu.title).click();
    const choices = ['session', 'conditional', 'mix', 'venue', 'tickets'];
    for (const key of choices) await button(labels.createMenu[key]).waitFor();
    const boxes = await Promise.all(
        choices.map((key) => button(labels.createMenu[key]).boundingBox()),
    );
    assert.ok(boxes[4].y > boxes[0].y);
    assert.ok(Math.abs(boxes[0].x - boxes[4].x) < 2);
    await page.screenshot({ path: '/private/tmp/djplanner-ticket-menu.png' });
    await button(labels.createMenu.tickets).click();
    await button('Soul Night 2026-10-10 · Sala X').waitFor();
    await button('Soul Night 2026-10-10 · Sala X').click();
    await page.getByRole('tab', { name: 'Emitir', exact: true }).click();
    await button(labels.tickets.addType).click();
    await page
        .getByRole('textbox', { name: labels.tickets.typeName, exact: true })
        .fill('General');
    await page
        .getByRole('textbox', { name: labels.tickets.price, exact: true })
        .fill('10');
    await button(labels.tickets.saveType).click();
    await page
        .getByRole('radio', { name: 'General · 10,00 €', exact: true })
        .waitFor();
    await page
        .getByRole('textbox', { name: labels.tickets.quantity, exact: true })
        .fill('101');
    await button(labels.tickets.issue).click();
    await page
        .getByText(labels.tickets.invalidIssue, { exact: true })
        .waitFor();
    assert.equal(issueCalls, 0);
    await page
        .getByRole('textbox', { name: labels.tickets.quantity, exact: true })
        .fill('1');
    await button(labels.tickets.issue).click();
    await button(labels.tickets.share).waitFor();
    assert.equal(issueCalls, 1);
    assert.equal(tickets[0].payment_status, 'pending');
    await page.screenshot({
        path: '/private/tmp/djplanner-ticket-pass.png',
        animations: 'disabled',
    });

    const downloadPromise = page.waitForEvent('download');
    await button(labels.tickets.share).click();
    const download = await downloadPromise;
    await download.saveAs('/private/tmp/djplanner-ticket-export.png');
    await button(labels.back).last().click(); // sheet close
    await page.getByRole('tab', { name: 'Resumen', exact: true }).click();
    await button(labels.tickets.scan).click();
    await page
        .getByRole('textbox', { name: labels.tickets.manualQr, exact: true })
        .waitFor();
    const qr = 'djplanner:ticket:v1:' + tickets[0].token;
    fs.writeFileSync('/private/tmp/djplanner-ticket-expected-qr.txt', qr);
    async function inputQr(text) {
        await page
            .getByRole('textbox', {
                name: labels.tickets.manualQr,
                exact: true,
            })
            .fill(text);
        await button(labels.tickets.validate).click();
    }
    await inputQr(qr);
    await page
        .getByText(labels.tickets.result_pending, { exact: true })
        .waitFor();
    assert.equal(tickets[0].state, 'issued');
    await button(labels.tickets.payAndAdmit).click();
    await page
        .getByText(labels.tickets.result_accepted, { exact: true })
        .waitFor();
    assert.equal(tickets[0].state, 'used');
    await button(labels.tickets.scanNext).click();
    await inputQr(qr);
    await page
        .getByText(labels.tickets.result_already_used, { exact: true })
        .waitFor();
    await button(labels.tickets.scanNext).click();
    await inputQr('https://external.invalid/anything');
    await page
        .getByText(labels.tickets.result_invalid, { exact: true })
        .waitFor();
    assert.equal(scanCalls, 3, 'Malformed QR never reaches backend');
    await page.screenshot({
        path: '/private/tmp/djplanner-ticket-scanner.png',
    });
    await page.goto('http://localhost:8081/tickets?sessionId=' + id);
    await page
        .getByText('Importe marcado como pagado · 10,00 €', { exact: true })
        .waitFor();
    await page.screenshot({
        path: '/private/tmp/djplanner-ticket-overview.png',
    });
    assert.deepEqual(errors, []);
    console.log(
        'Menu layout, ticket types, issuance, PNG export, pending payment, admission, duplicate QR and summary passed.',
    );
    await browser.close();
})().catch(async (e) => {
    console.error(e);
    if (page) {
        console.error((await page.locator('body').innerText()).slice(-5000));
        await page.screenshot({
            path: '/private/tmp/djplanner-ticket-browser-error.png',
        });
    }
    if (browser) await browser.close();
    process.exitCode = 1;
});
