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

    const labels = JSON.parse(
        fs.readFileSync(
            require('node:path').join(
                __dirname,
                '../../src/i18n/languages/es.json',
            ),
            'utf8',
        ),
    );
    const filters = [];
    const fixtures = [
        {
            session_id: '00000000-0000-4000-8000-000000000931',
            author_id: '00000000-0000-4000-8000-000000000932',
            artist_name: 'Pepe',
            title: 'House Málaga',
            venue: 'Club A',
            city: 'Málaga',
            date: '2027-01-01',
            start_time: '22:00',
            end_time: '04:00',
            poster_url: null,
            collaborators: [],
        },
        {
            session_id: '00000000-0000-4000-8000-000000000933',
            author_id: '00000000-0000-4000-8000-000000000934',
            artist_name: 'Other',
            title: 'Techno Madrid',
            venue: 'Club B',
            city: 'Madrid',
            date: '2027-01-02',
            start_time: '22:00',
            end_time: '04:00',
            poster_url: null,
            collaborators: [],
        },
    ];
    const dj = {
        ...profile,
        user_id: fixtures[0].author_id,
        artist_name: 'Pepe',
        city: 'Barcelona',
        genres: 'House',
    };
    const context = await setup('es', 320, true, false);
    await context.route('**/*.supabase.co/**', async (route) => {
        const req = route.request(),
            url = new URL(req.url());
        let body;
        if (url.pathname.endsWith('/rpc/community_filter_options'))
            body = {
                cities:
                    req.postDataJSON().mode === 'djs'
                        ? ['Barcelona', 'Madrid']
                        : ['Madrid', 'Málaga'],
                genres: ['House', 'Techno'],
            };
        else if (url.pathname.endsWith('/rpc/community_feed')) body = fixtures;
        else if (url.pathname.endsWith('/rpc/community_feed_filtered')) {
            const args = req.postDataJSON();
            filters.push(args);
            body = fixtures.filter(
                (x) =>
                    (!args.filter_city || args.filter_city === x.city) &&
                    (!args.filter_genre ||
                        (args.filter_genre === 'House' &&
                            x.artist_name === 'Pepe')),
            );
        } else if (url.pathname.endsWith('/rpc/community_discover_filtered')) {
            const args = req.postDataJSON();
            filters.push(args);
            body =
                args.filter_city === 'Barcelona' &&
                (!args.filter_genre || args.filter_genre === 'House')
                    ? [dj]
                    : [];
        } else if (
            url.pathname.endsWith('/community_profiles') &&
            url.searchParams.get('is_visible')
        )
            body = [dj];
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
    await page.goto('http://localhost:8081/community');
    await page.getByText('Techno Madrid', { exact: true }).waitFor();
    const city = () => page.getByRole('button', { name: /^Ciudad:/ });
    const genre = () => page.getByRole('button', { name: /^Estilo:/ });
    await city().click();
    await page
        .getByRole('textbox', {
            name: labels.communityFilters.searchCity,
            exact: true,
        })
        .fill('malaga');
    await page.getByRole('button', { name: 'Málaga', exact: true }).click();
    await page.getByText('House Málaga', { exact: true }).waitFor();
    assert.equal(
        await page.getByText('Techno Madrid', { exact: true }).count(),
        0,
    );
    await genre().click();
    await page
        .getByRole('textbox', {
            name: labels.communityFilters.searchGenre,
            exact: true,
        })
        .fill('house');
    await page.getByRole('button', { name: 'House', exact: true }).click();
    await page.getByText('House Málaga', { exact: true }).waitFor();
    assert.ok(
        filters.some(
            (x) => x.filter_city === 'Málaga' && x.filter_genre === 'House',
        ),
    );
    await page.screenshot({
        path: '/private/tmp/djplanner-community-filters.png',
    });
    await page
        .getByRole('button', { name: labels.community.djs, exact: true })
        .click();
    await city().click();
    await page.getByRole('button', { name: 'Barcelona', exact: true }).click();
    await genre().click();
    await page.getByRole('button', { name: 'House', exact: true }).click();
    await page
        .getByRole('textbox', { name: labels.community.search, exact: true })
        .fill('Pepe');
    await page.waitForResponse(
        (r) =>
            r.url().includes('community_discover_filtered') &&
            r.request().postDataJSON().search_name === 'Pepe',
    );
    assert.ok(
        filters.some(
            (x) =>
                x.search_name === 'Pepe' &&
                x.filter_city === 'Barcelona' &&
                x.filter_genre === 'House',
        ),
    );
    await page
        .getByRole('button', {
            name: labels.communityFilters.clear,
            exact: true,
        })
        .click();
    assert.equal(
        await page
            .getByRole('button', {
                name: labels.communityFilters.clear,
                exact: true,
            })
            .count(),
        0,
    );
    await page
        .getByRole('button', { name: labels.community.following, exact: true })
        .click();
    assert.equal(await city().count(), 0);
    await page
        .getByRole('button', { name: labels.community.sessions, exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Ciudad: Málaga', exact: true })
        .waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    await browser.close();
    console.log(
        'PASS session and DJ filters, combinations, accent search, separate tab state, name search and clearing at 320px dark. Mock APIs.',
    );
})().catch(async (e) => {
    console.error(e);
    if (page && !page.isClosed()) {
        console.error('ERRORS', errors, 'URL', page.url());
        console.error(await page.locator('body').innerText());
        await page.screenshot({
            path: '/private/tmp/djplanner-community-filter-failure.png',
        });
    }
    if (browser) await browser.close();
    process.exitCode = 1;
});
