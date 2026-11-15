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
    const venue = {
        id: '00000000-0000-4000-8000-000000000912',
        user_id: user.id,
        name: 'Sala X',
        city: 'Sevilla',
        address: null,
    };
    let saved,
        creates = 0,
        edits = 0;
    const sessionId = '00000000-0000-4000-8000-000000000919';
    await context.route('**/*.supabase.co/**', async (route) => {
        const request = route.request(),
            url = new URL(request.url());
        let body;
        if (url.pathname.endsWith('/venues')) body = [venue];
        else if (url.pathname.endsWith('/rpc/get_session_usage'))
            body = {
                count: saved ? 1 : 0,
                limit: 30,
                remaining: 30,
                isPro: false,
            };
        else if (url.pathname.endsWith('/rpc/create_session_series')) {
            const input = request.postDataJSON().input;
            assert.equal(input.title, '');
            saved = {
                ...input,
                id: sessionId,
                user_id: user.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                amount_paid: 0,
            };
            creates++;
            body = saved;
        } else if (url.pathname.endsWith('/sessions')) {
            if (request.method() === 'PATCH') {
                saved = { ...saved, ...request.postDataJSON() };
                edits++;
                body = [{ id: sessionId }];
            } else if (request.headers().accept?.includes('vnd.pgrst.object'))
                body = { ...saved, place: { city: venue.city } };
            else
                body = saved ? [{ ...saved, place: { city: venue.city } }] : [];
        } else if (url.pathname.endsWith('/rpc/community_feed'))
            body = saved
                ? [
                      {
                          ...saved,
                          session_id: sessionId,
                          artist_name: 'DJ Demo',
                          author_id: user.id,
                          city: venue.city,
                          shared_at: new Date().toISOString(),
                      },
                  ]
                : [];
        else {
            await route.fallback();
            return;
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body),
        });
    });
    await page.goto('http://localhost:8081/add-session?date=2027-03-10');
    const name = page.getByRole('textbox', {
        name: 'Nombre del evento · Opcional',
        exact: true,
    });
    await name.waitFor();
    assert.equal(await name.inputValue(), '');
    await page.getByText('Ej: Club Amnesia', { exact: true }).click();
    await page.getByText('Sala X', { exact: true }).last().click();
    await page
        .getByRole('button', { name: 'Guardar sesión', exact: true })
        .click();
    await page.waitForURL('**/session/' + sessionId);
    await page.getByText('Sesión en Sala X', { exact: true }).first().waitFor();
    assert.equal(creates, 1);
    assert.equal(saved.title, '');
    await page.goto('http://localhost:8081/edit-session/' + sessionId);
    await name.waitFor();
    assert.equal(await name.inputValue(), '');
    await name.fill('Closing Party');
    await page
        .getByRole('button', { name: 'Guardar sesión', exact: true })
        .click();
    await page.waitForURL('**/session/' + sessionId);
    await page.getByText('Closing Party', { exact: true }).first().waitFor();
    assert.equal(saved.title, 'Closing Party');
    await page.goto('http://localhost:8081/edit-session/' + sessionId);
    await name.waitFor();
    await name.fill('');
    await page
        .getByRole('button', { name: 'Guardar sesión', exact: true })
        .click();
    await page.waitForURL('**/session/' + sessionId);
    assert.equal(saved.title, '');
    assert.equal(edits, 2);
    await page.goto('http://localhost:8081/home');
    await page.getByText('Sesión en Sala X', { exact: true }).first().waitFor();
    await page.getByText('Sevilla', { exact: true }).first().waitFor();
    assert.equal(await page.getByText('Sala X', { exact: true }).count(), 0);
    await page.screenshot({
        path: '/private/tmp/djplanner-unnamed-session-home.png',
    });
    await page.goto('http://localhost:8081/community');
    await page.getByText('Sesión en Sala X', { exact: true }).first().waitFor();
    await page.getByText('Sevilla', { exact: true }).first().waitFor();
    assert.equal(await page.getByText('Sala X', { exact: true }).count(), 0);
    await context.close();
    assert.deepEqual(errors, []);
    console.log(
        'PASS unnamed creation, explicit-name edit, clearing name, home/community automatic title and city without duplicate venue. All API requests mocked.',
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
