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

    const context = await setup();
    let saved;
    await page.route('**/rest/v1/community_profile_mixes*', async route => {
        if (route.request().method() === 'POST') {
            saved = route.request().postDataJSON();
            return route.fulfill({ json: { id: 'fixture-mix' } });
        }
        return route.fulfill({ json: [] });
    });
    await context.route('https://api.mixcloud.com/**', async route => {
        const key = new URL(route.request().url()).pathname;
        if (key.includes('broken')) return route.fulfill({ status: 503, body: '' });
        if (key.includes('slow')) await new Promise(resolve => setTimeout(resolve, 1200));
        await route.fulfill({ json: { key, name: key.includes('slow') ? 'Old slow title' : 'Original mix title' } });
    });
    await page.goto('http://localhost:8081/add-mix');
    // Use the locale label rather than assuming the wording.
    const labels = JSON.parse(fs.readFileSync('src/i18n/languages/es.json', 'utf8')).profileMixes;
    const input = page.getByLabel(labels.url, { exact: true });
    const name = page.getByLabel(labels.name, { exact: true });
    await input.waitFor();
    assert.equal(await name.count(), 0, 'Only URL input initially');
    await input.fill('https://www.mixcloud.com/dj/slow/');
    await page.getByText(labels.findingTitle, { exact: true }).waitFor();
    await new Promise(resolve => setTimeout(resolve, 450));
    await input.fill('https://www.mixcloud.com/dj/new/');
    await page.getByText('Original mix title', { exact: true }).waitFor();
    await new Promise(resolve => setTimeout(resolve, 1300));
    assert.equal(await page.getByText('Old slow title', { exact: true }).count(), 0);
    await page.getByRole('button', { name: labels.editTitle, exact: true }).click();
    await name.fill('My custom title');
    await input.fill('https://www.mixcloud.com/dj/broken/');
    await name.waitFor();
    assert.equal(await name.inputValue(), '', 'URL changes clear previous title');
    await name.fill('Manual fallback mix');
    await page.screenshot({ path: '/private/tmp/djplanner-mix-url-form.png' });
    await page.getByRole('button', { name: labels.save, exact: true }).click();
    await page.waitForURL('**/home');
    assert.equal(saved.title, 'Manual fallback mix');
    assert.equal(saved.source_url, 'https://www.mixcloud.com/dj/broken/');
    await page.goto('http://localhost:8081/add-mix');
    await input.fill('https://www.mixcloud.com/dj/new/');
    await page.getByText('Original mix title', { exact: true }).waitFor();
    await page.getByRole('button', { name: labels.save, exact: true }).click();
    await page.waitForURL('**/home');
    assert.equal(saved.title, 'Original mix title');
    await page.goto('http://localhost:8081/profile');
    await page.getByRole('button', { name: labels.add, exact: true }).click();
    assert.equal(await name.count(), 0);
    await input.fill('https://www.mixcloud.com/dj/new/');
    await page.getByText('Original mix title', { exact: true }).waitFor();
    await page.getByRole('button', { name: labels.editTitle, exact: true }).click();
    await name.fill('Profile custom title');
    await page.getByRole('button', { name: labels.save, exact: true }).click();
    await page.getByRole('button', { name: labels.add, exact: true }).waitFor();
    assert.equal(saved.title, 'Profile custom title');
    assert.deepEqual(errors, []);
    console.log('PASS URL-only form, stale response, manual editing, fallback and save');
    await browser.close();
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
