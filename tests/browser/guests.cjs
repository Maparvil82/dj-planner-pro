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
    const id = '00000000-0000-4000-8000-000000000819';
    let events = [
            {
                id,
                user_id: user.id,
                title: 'Soul Night',
                venue: 'Sala X',
                date: '2026-10-10',
                start_time: '22:00',
                end_time: '04:00',
                status: 'confirmed',
                djs: [],
                earning_type: 'free',
                currency: '€',
            },
        ],
        guests = [],
        writes = 0;
    await context.route('**/rest/v1/sessions*', (r) =>
        r.fulfill({ json: events }),
    );
    await context.route('**/rest/v1/rpc/event_guest_list', (r) =>
        r.fulfill({ json: guests }),
    );
    await context.route('**/rest/v1/rpc/save_event_guest', async (r) => {
        writes++;
        const p = r.request().postDataJSON();
        let g = guests.find((x) => x.id === p.p_guest);
        if (g) {
            g.full_name = p.p_name;
            g.companions = p.p_companions;
            g.total = p.p_companions + 1;
            g.revision++;
        } else
            guests.push({
                id: p.p_guest,
                session_id: id,
                full_name: p.p_name,
                companions: p.p_companions,
                total: p.p_companions + 1,
                admitted: 0,
                revision: 1,
                created_at: new Date().toISOString(),
            });
        await r.fulfill({ json: guests.find((x) => x.id === p.p_guest) });
    });
    await context.route('**/rest/v1/rpc/register_guest_access', async (r) => {
        const p = r.request().postDataJSON(),
            g = guests.find((x) => x.id === p.p_guest);
        g.admitted += p.p_action === 'admit' ? p.p_quantity : -p.p_quantity;
        await r.fulfill({ json: null });
    });
    await context.route('**/rest/v1/rpc/remove_event_guest', async (r) => {
        const p = r.request().postDataJSON();
        guests = guests.filter((x) => x.id !== p.p_guest);
        await r.fulfill({ json: null });
    });
    const button = (n) => page.getByRole('button', { name: n, exact: true });
    const label = (key, n, total) =>
        labels.guests[key].replace('{{count}}', n).replace('{{total}}', total);
    await page.goto('http://localhost:8081/home');
    await button(labels.createMenu.title).click();
    await button(labels.createMenu.guests).click();
    await page.waitForURL('**/guests');
    await page
        .getByRole('button', { name: /Soul Night Sala X/ })
        .last()
        .click();
    await button(labels.guests.add).click();
    await page
        .getByRole('textbox', { name: labels.guests.fullName })
        .fill('Manuel Parra');
    for (let i = 0; i < 3; i++) await button(labels.guests.increase).click();
    await page.getByText(label('totalPeople', 4), { exact: true }).waitFor();
    await page.screenshot({
        path: '/private/tmp/djplanner-guests-add.png',
        animations: 'disabled',
    });
    await button(labels.guests.add).last().click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByText('Manuel Parra', { exact: true }).waitFor();
    assert.equal(writes, 1);
    assert.equal(guests[0].total, 4);
    await page.getByText('Manuel Parra', { exact: true }).click();
    await button(labels.guests.increase).click();
    await button(label('admitCount', 2)).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByText(label('progress', 2, 4), { exact: true }).waitFor();
    await page.getByText('Manuel Parra', { exact: true }).click();
    await button(labels.guests.undo).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByText(label('progress', 1, 4), { exact: true }).waitFor();
    await page.getByText('Manuel Parra', { exact: true }).click();
    await button(labels.guests.edit).click();
    await page
        .getByRole('textbox', { name: labels.guests.fullName })
        .fill('Manuel Parrá');
    await button(labels.guests.save).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page
        .getByRole('textbox', { name: labels.guests.search })
        .fill('parra');
    await page.getByText('Manuel Parrá', { exact: true }).waitFor();
    await page
        .getByRole('textbox', { name: labels.guests.search })
        .fill('nobody');
    await page.getByText(labels.guests.noResults, { exact: true }).waitFor();
    await page.getByRole('textbox', { name: labels.guests.search }).fill('');
    await button(labels.guests.add).click();
    await page
        .getByRole('textbox', { name: labels.guests.fullName })
        .fill('MANUEL PARRA');
    await button(labels.guests.add).last().click();
    await page.getByText(labels.guests.duplicate, { exact: true }).waitFor();
    assert.equal(guests.length, 1);
    await button(labels.guests.addAnyway).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(guests.length, 2);
    await page.getByText('MANUEL PARRA', { exact: true }).click();
    await button(labels.guests.remove).click();
    await page
        .getByText(labels.guests.removeConfirm, { exact: true })
        .waitFor();
    assert.equal(guests.length, 2);
    await button(labels.guests.confirmRemove).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page
        .getByText('MANUEL PARRA', { exact: true })
        .waitFor({ state: 'hidden' });
    assert.equal(guests.length, 1);
    await page.screenshot({
        path: '/private/tmp/djplanner-guests-list.png',
        animations: 'disabled',
    });
    await page.getByText('Manuel Parrá', { exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    await button(labels.guests.admitCount_one).waitFor();
    await page.screenshot({
        path: '/private/tmp/djplanner-guests-access.png',
        animations: 'disabled',
    });
    await button(labels.back).last().click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await button(labels.guests.changeSession).click();
    events = [];
    await page.reload();
    await page.getByText(labels.guests.noSessions, { exact: true }).waitFor();
    await button(labels.guests.createSession).waitFor();
    assert.deepEqual(errors, []);
    console.log(
        'Guest list browser: menu, session selection, creation, +3, partial admission, undo, edit, normalized search, duplicate warning, deletion and no-session state passed.',
    );
    await browser.close();
})().catch(async (e) => {
    console.error(e);
    if (page)
        await page
            .screenshot({
                path: '/private/tmp/djplanner-guests-error.png',
                animations: 'disabled',
            })
            .catch(() => {});
    if (browser) await browser.close();
    process.exitCode = 1;
});
