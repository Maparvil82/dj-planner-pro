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
        avatar_url: 'https://fixture.example/avatar.jpg',
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
            poster_url: 'https://fixture.example/avatar.jpg',
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
            poster_url: 'https://fixture.example/avatar.jpg',
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
    const otherDj = {
        ...dj,
        user_id: fixtures[1].author_id,
        artist_name: 'Luna',
        city: 'Madrid',
        genres: 'Techno',
    };
    const follows = new Set();
    const bookmarks = new Set();
    let failSave = true;
    await context.route('https://fixture.example/avatar.jpg', (route) =>
        route.fulfill({
            contentType: 'image/jpeg',
            body: fs.readFileSync(
                require('node:path').join(
                    __dirname,
                    '../../assets/community/dj-welcome.jpg',
                ),
            ),
        }),
    );
    await context.route('**/*.supabase.co/**', async (route) => {
        const req = route.request(),
            url = new URL(req.url());
        let body;
        if (url.pathname.endsWith('/saved_mixes')) {
            if (req.method() === 'POST') {
                assert.equal(req.postDataJSON().owner_id, user.id);
                if (failSave) {
                    failSave = false;
                    await route.fulfill({
                        status: 503,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            code: 'fixture',
                            message: 'Save unavailable',
                        }),
                    });
                    return;
                }
                bookmarks.add(req.postDataJSON().mix_id);
                body = null;
            } else if (req.method() === 'DELETE') {
                assert.equal(url.searchParams.get('owner_id'), 'eq.' + user.id);
                bookmarks.delete(
                    url.searchParams.get('mix_id').replace('eq.', ''),
                );
                body = null;
            } else body = [...bookmarks].map((mix_id) => ({ mix_id }));
        } else if (url.pathname.endsWith('/rpc/saved_mix_list')) {
            body = bookmarks.has('fixture-mix')
                ? [
                      {
                          id: 'fixture-mix',
                          user_id: dj.user_id,
                          title: 'Jazz in Sevilla',
                          source_url: 'https://www.mixcloud.com/pepe/jazz/',
                          platform: 'mixcloud',
                          artist_name: dj.artist_name,
                          avatar_url: dj.avatar_url,
                          created_at: '2026-10-05T12:00:00Z',
                          saved_at: '2026-10-06T00:00:00Z',
                      },
                  ]
                : [];
        } else if (url.pathname.endsWith('/rpc/community_filter_options'))
            body = {
                cities:
                    req.postDataJSON().mode === 'djs'
                        ? ['Barcelona', 'Madrid']
                        : ['Madrid', 'Málaga'],
                genres: ['House', 'Techno'],
            };
        else if (url.pathname.endsWith('/rpc/community_session_shelf')) {
            const args = req.postDataJSON();
            filters.push(args);
            body = fixtures.filter((x) => {
                const followed = follows.has(x.author_id);
                const nearby =
                    x.city === args.home_city && x.date >= args.from_date;
                const group =
                    args.shelf === 'following'
                        ? followed
                        : args.shelf === 'city'
                          ? nearby && !followed
                          : !followed && !nearby;
                return (
                    group &&
                    (!args.filter_city || args.filter_city === x.city) &&
                    (!args.filter_genre ||
                        x.title
                            .toLowerCase()
                            .includes(args.filter_genre.toLowerCase())) &&
                    (!args.search_text ||
                        (x.title + ' ' + x.venue)
                            .toLowerCase()
                            .includes(args.search_text.toLowerCase()))
                );
            });
        } else if (
            url.pathname.endsWith('/rpc/community_profile_session_counts')
        )
            body = req.postDataJSON().author_ids.map((user_id) => ({
                user_id,
                session_count: user_id === dj.user_id ? 27 : 0,
            }));
        else if (url.pathname.endsWith('/rpc/community_following_activity')) {
            body = follows.has(dj.user_id)
                ? [
                      {
                          kind: 'mix',
                          id: 'fixture-mix',
                          published_at: '2026-10-05T12:00:00Z',
                          payload: {
                              id: 'fixture-mix',
                              user_id: dj.user_id,
                              artist_name: dj.artist_name,
                              avatar_url: dj.avatar_url,
                              city: dj.city,
                              title: 'Jazz in Sevilla',
                              source_url: 'https://www.mixcloud.com/pepe/jazz/',
                              platform: 'mixcloud',
                              created_at: '2026-10-05T12:00:00Z',
                          },
                      },
                      {
                          kind: 'session',
                          id: fixtures[0].session_id,
                          published_at: '2026-10-04T12:00:00Z',
                          payload: fixtures[0],
                      },
                  ]
                : [];
        } else if (url.pathname.endsWith('/community_follows')) {
            if (req.method() === 'POST') {
                follows.add(req.postDataJSON().following_id);
                body = null;
            } else if (req.method() === 'DELETE') {
                follows.delete(
                    url.searchParams.get('following_id').replace('eq.', ''),
                );
                body = null;
            } else
                body = [...follows].map((following_id) => ({ following_id }));
        } else if (
            url.pathname.endsWith('/rpc/community_followed_djs') ||
            url.pathname.endsWith('/rpc/community_discover_filtered')
        ) {
            const args = req.postDataJSON();
            filters.push(args);
            body = [dj, otherDj].filter(
                (x) =>
                    (!url.pathname.endsWith('community_followed_djs') ||
                        follows.has(x.user_id)) &&
                    x.user_id !== user.id &&
                    (!args.search_name ||
                        x.artist_name
                            .toLowerCase()
                            .includes(args.search_name.toLowerCase())) &&
                    (!args.filter_city || x.city === args.filter_city) &&
                    (!args.filter_genre || x.genres === args.filter_genre),
            );
        } else if (
            url.pathname.endsWith('/community_profiles') &&
            url.searchParams.get('is_visible')
        )
            body = [dj, otherDj];
        else if (url.pathname.endsWith('/rpc/community_feed')) body = fixtures;
        else if (
            url.pathname.endsWith('/rpc/community_feed_filtered') ||
            url.pathname.endsWith('/rpc/community_feed_search')
        ) {
            const args = req.postDataJSON();
            filters.push(args);
            body = fixtures.filter(
                (x) =>
                    (!args.filter_city || args.filter_city === x.city) &&
                    (!args.filter_genre ||
                        x.title
                            .toLowerCase()
                            .includes(args.filter_genre.toLowerCase())) &&
                    (!args.search_text ||
                        (x.title + ' ' + x.venue)
                            .toLowerCase()
                            .includes(args.search_text.toLowerCase())),
            );
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
    await context.route('https://api.mixcloud.com/**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                key: '/pepe/jazz/',
                user: { name: 'Pepe' },
                tags: [],
                audio_length: 3600,
            }),
        }),
    );
    await context.route(
        'https://widget.mixcloud.com/media/js/widgetApi.js',
        (route) =>
            route.fulfill({
                contentType: 'application/javascript',
                body: 'window.Mixcloud={PlayerWidget:()=>({ready:Promise.resolve(),play:()=>Promise.resolve(true)})};',
            }),
    );
    await context.route('**/widget/iframe/**', (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: '<html>Official player fixture</html>',
        }),
    );
    const openFilters = () =>
        page.getByRole('button', { name: 'Filtros', exact: true }).click();
    const pick = async (kind, choice) => {
        await page.getByRole('button', { name: kind, exact: true }).click();
        await page.getByRole('button', { name: choice, exact: true }).click();
    };
    const apply = () =>
        page
            .getByRole('button', { name: 'Aplicar filtros', exact: true })
            .click();
    await page.goto('http://localhost:8081/community');
    await page
        .getByRole('button', { name: 'Ver perfil: Pepe', exact: true })
        .waitFor();
    assert.equal(
        await page.getByText('House Málaga', { exact: true }).count(),
        0,
        'Community initially shows DJs, not sessions',
    );
    const tabPositions = await Promise.all(
        [
            labels.community.djs,
            labels.community.sessions,
            labels.community.following,
        ].map((name) =>
            page.getByRole('button', { name, exact: true }).boundingBox(),
        ),
    );
    assert(
        tabPositions[0].x < tabPositions[1].x &&
            tabPositions[1].x < tabPositions[2].x,
        'Community tabs are DJs, Sessions, Following',
    );
    await page
        .getByRole('button', { name: labels.community.sessions, exact: true })
        .click();

    await page.getByText('Techno Madrid', { exact: true }).waitFor();
    const square = await page
        .getByRole('button', { name: 'Ver sesión: Techno Madrid', exact: true })
        .boundingBox();
    const compact = await page
        .getByRole('button', { name: 'Ver sesión: House Málaga', exact: true })
        .boundingBox();
    assert.ok(
        Math.abs(square.width - square.height) < 1 && square.height === 200,
    );
    assert.ok(compact.height === 112 && compact.width > compact.height);
    await page.screenshot({
        path: '/private/tmp/djplanner-session-shelves.png',
    });
    await page
        .getByRole('button', { name: 'Ver sesión: House Málaga', exact: true })
        .click();
    await page.getByRole('button', { name: 'Pepe', exact: true }).waitFor();
    await page
        .getByRole('img', { name: 'House Málaga', exact: true })
        .waitFor();
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

    assert.equal(
        await page.getByRole('button', { name: 'Ciudad', exact: true }).count(),
        0,
        'Filters are inside the search action, not standalone buttons',
    );
    await openFilters();
    await pick('Ciudad', 'Málaga');
    await pick('Estilos de los DJs', 'House');
    await apply();
    await page.getByText('House Málaga', { exact: true }).waitFor();
    assert.equal(
        await page.getByText('Techno Madrid', { exact: true }).count(),
        0,
    );
    await page
        .getByRole('textbox', {
            name: labels.community.searchSessions,
            exact: true,
        })
        .fill('Club A');
    await page.waitForResponse(
        (r) =>
            r.url().includes('community_session_shelf') &&
            r.request().postDataJSON().search_text === 'Club A',
    );
    assert.ok(
        filters.some(
            (x) =>
                x.filter_city === 'Málaga' &&
                x.filter_genre === 'House' &&
                x.search_text === 'Club A',
        ),
    );
    await page
        .getByRole('button', { name: labels.community.djs, exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Ver perfil: Pepe', exact: true })
        .waitFor();
    const a = await page
        .getByRole('button', { name: 'Ver perfil: Pepe', exact: true })
        .boundingBox();
    const b = await page
        .getByRole('button', { name: 'Ver perfil: Luna', exact: true })
        .boundingBox();
    assert.ok(
        Math.abs(a.y - b.y) < 2 && b.x > a.x + a.width,
        'DJs appear in two columns at 320px',
    );
    assert.ok(
        a.height < 180,
        'Profile photo and metadata remain compact at 320px',
    );
    assert.equal(
        await page
            .getByRole('button', { name: 'Ver perfil: DJ Demo', exact: true })
            .count(),
        0,
    );
    await page
        .getByLabel(`27 ${labels.community.sessions}`, { exact: true })
        .waitFor();
    await page
        .getByLabel(`0 ${labels.community.sessions}`, { exact: true })
        .waitFor();
    await page.screenshot({
        path: '/private/tmp/djplanner-community-dj-grid.png',
    });
    await page
        .getByRole('button', { name: 'Seguir Pepe', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Dejar de seguir Pepe', exact: true })
        .waitFor();
    await page
        .getByRole('button', { name: labels.community.sessions, exact: true })
        .click();
    await page.getByText('De DJs que sigues', { exact: true }).waitFor();
    const followedSquare = await page
        .getByRole('button', { name: 'Ver sesión: House Málaga', exact: true })
        .boundingBox();
    assert.equal(followedSquare.height, 200);
    assert.equal(
        await page.getByText('House Málaga', { exact: true }).count(),
        1,
    );
    await page
        .getByRole('button', { name: labels.community.following, exact: true })
        .click();
    await page.getByText('Jazz in Sevilla', { exact: true }).waitFor();
    await page.getByText(fixtures[0].title, { exact: true }).waitFor();
    await page
        .getByRole('button', { name: 'Abrir reproductor', exact: true })
        .click();
    await page.locator('iframe[title="Jazz in Sevilla"]').waitFor();
    await page.screenshot({
        path: '/private/tmp/djplanner-following-activity.png',
    });
    assert.equal(
        await page
            .getByRole('button', { name: 'Actividad', exact: true })
            .count(),
        0,
    );
    assert.equal(
        await page
            .getByRole('button', { name: 'DJs que sigo', exact: true })
            .count(),
        0,
    );
    await page.getByText('Ha subido un nuevo mix', { exact: false }).waitFor();
    await page
        .getByText('Ha publicado una nueva sesión', { exact: false })
        .waitFor();
    const activityCards = await page
        .getByText('Jazz in Sevilla', { exact: true })
        .boundingBox();
    const sessionCards = await page
        .getByText(fixtures[0].title, { exact: true })
        .boundingBox();
    assert(
        activityCards.y < sessionCards.y,
        'Newest publication appears first',
    );
    await page
        .getByRole('button', { name: labels.savedMixes.save, exact: true })
        .click();
    await page.getByText(labels.savedMixes.error, { exact: true }).waitFor();
    assert.equal(bookmarks.size, 0, 'Failed writes must not look saved');
    await page
        .getByRole('button', { name: labels.savedMixes.save, exact: true })
        .click();
    await page
        .getByRole('button', { name: labels.savedMixes.remove, exact: true })
        .waitFor();
    assert.equal(bookmarks.size, 1);
    await page.getByLabel(labels.accountMenu.open, { exact: false }).click();
    await page
        .getByRole('button', {
            name: labels.accountMenu.savedMixes,
            exact: true,
        })
        .click();
    await page
        .getByRole('button', { name: labels.accountMenu.close, exact: true })
        .first()
        .waitFor({ state: 'hidden' });
    await page.getByText(labels.savedMixes.private, { exact: true }).waitFor();
    await page.getByText('Jazz in Sevilla', { exact: true }).last().waitFor();
    await page
        .getByRole('button', { name: labels.profileMixes.listen, exact: true })
        .click();
    await page.locator('iframe[title="Jazz in Sevilla"]').waitFor();
    await page.screenshot({ path: '/private/tmp/djplanner-saved-mixes.png' });
    await page.reload();
    await page.getByText('Jazz in Sevilla', { exact: true }).waitFor();
    await page
        .getByRole('button', { name: labels.savedMixes.remove, exact: true })
        .click();
    await page.getByText(labels.savedMixes.empty, { exact: true }).waitFor();
    assert.equal(bookmarks.size, 0);
    await page
        .getByRole('button', { name: labels.savedMixes.discover, exact: true })
        .click();
    await page
        .getByRole('button', { name: labels.community.sessions, exact: true })
        .click();
    await openFilters();
    await pick('Ciudad', 'Málaga');
    await pick('Estilos de los DJs', 'House');
    await apply();
    await page
        .getByRole('textbox', {
            name: labels.community.searchSessions,
            exact: true,
        })
        .fill('Club A');
    await page.waitForResponse(
        (r) =>
            r.url().includes('community_session_shelf') &&
            r.request().postDataJSON().search_text === 'Club A',
    );
    await page
        .getByRole('button', { name: labels.community.djs, exact: true })
        .click();
    const switchingTabs = await page
        .getByRole('button', { name: labels.community.following, exact: true })
        .boundingBox();
    const switchingSearch = await page
        .getByRole('textbox', { name: labels.community.search, exact: true })
        .boundingBox();
    assert.equal(
        await page.locator('iframe[title="Jazz in Sevilla"]').count(),
        0,
    );
    await page
        .getByRole('button', { name: 'Ver perfil: Pepe', exact: true })
        .waitFor();
    const loadedTabs = await page
        .getByRole('button', { name: labels.community.following, exact: true })
        .boundingBox();
    const loadedSearch = await page
        .getByRole('textbox', { name: labels.community.search, exact: true })
        .boundingBox();
    assert.equal(
        switchingTabs.y,
        loadedTabs.y,
        'Loading must not push the tabs down',
    );
    assert.equal(
        switchingSearch.y,
        loadedSearch.y,
        'Loading must not push the search down',
    );
    await page
        .getByRole('button', { name: 'Dejar de seguir Pepe', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Seguir Pepe', exact: true })
        .waitFor();
    await page
        .getByRole('button', { name: labels.community.following, exact: true })
        .click();
    await page.getByText('Tu escena empieza aquí', { exact: true }).waitFor();
    assert.equal(
        await page.getByText('Jazz in Sevilla', { exact: true }).count(),
        0,
    );
    await page
        .getByRole('button', { name: labels.community.djs, exact: true })
        .click();
    await openFilters();
    await pick('Ciudad', 'Barcelona');
    await pick('Estilo', 'House');
    await apply();
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
        .getByRole('button', { name: 'Quitar filtro Barcelona', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Quitar filtro House', exact: true })
        .click();
    await openFilters();
    await pick('Ciudad', 'Madrid');
    await page
        .getByRole('button', { name: 'Cancelar', exact: true })
        .last()
        .click();
    assert.equal(
        await page
            .getByRole('button', { name: 'Quitar filtro Madrid', exact: true })
            .count(),
        0,
        'Cancelling discards unapplied filters',
    );
    await page
        .getByRole('button', { name: labels.community.sessions, exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Quitar filtro Málaga', exact: true })
        .waitFor();
    assert.equal(
        await page
            .getByRole('textbox', {
                name: labels.community.searchSessions,
                exact: true,
            })
            .inputValue(),
        'Club A',
        'Search is independent between tabs',
    );
    assert.deepEqual(errors, []);
    await context.close();
    await browser.close();
    console.log(
        'PASS: two-column DJ cards at 320px, private saved mixes, failed save recovery, persistence, menu access, playback and removal, direct following activity, newest-first updates, stable controls during loading, follow/unfollow updates, filters inside search, combined search, cancel and independent tab state. Mock APIs.',
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
