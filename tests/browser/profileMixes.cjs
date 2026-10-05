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

    let context = await setup();
    let current = {
        ...profile,
        avatar_url: null,
        city: '',
        genres: '',
        is_visible: false,
    };
    let recordings = [];
    const followed = [];
    await context.route('**/*.supabase.co/**', async (route) => {
        const req = route.request(),
            url = new URL(req.url()),
            method = req.method();
        let body = [];
        if (url.pathname.includes('/auth/v1/user')) body = user;
        else if (url.pathname.includes('/auth/v1/token')) body = session;
        else if (url.pathname.includes('/rpc/community_city_suggestions')) {
            const q = req.postDataJSON().search_city.toLowerCase();
            body = [
                { city: 'Sevilla', city_location: null },
                { city: 'Barcelona', city_location: null },
                ...(current.is_visible
                    ? [
                          {
                              city: current.city,
                              city_location: current.city_location || null,
                          },
                      ]
                    : []),
            ].filter((x) => x.city.toLowerCase().includes(q));
        } else if (url.pathname.includes('/rpc/community_filter_options')) {
            body = {
                cities: [
                    'SEvilla',
                    'sevilla',
                    'Barcelona',
                    ...(current.is_visible ? [current.city] : []),
                ],
                genres: ['Jazz', 'House'],
            };
        } else if (url.pathname.includes('/rpc/save_unified_profile')) {
            const input = req.postDataJSON().input;
            current = { ...current, ...input };
            body = { profile: { ...current, id: user.id }, community: current };
        } else if (
            url.pathname.includes('/community_profiles') ||
            url.pathname.includes('/users_profile')
        ) {
            body = current;
            if (url.searchParams.get('is_visible') === 'eq.true')
                body = [
                    {
                        ...profile,
                        user_id: '00000000-0000-4000-8000-000000000902',
                        artist_name: 'DJ Jazz',
                        city: 'Barcelona',
                        genres: 'Jazz',
                    },
                ];
        } else if (url.pathname.includes('/community_profile_mixes')) {
            if (method === 'POST') {
                const row = req.postDataJSON();
                recordings.push({
                    ...row,
                    id: '00000000-0000-4000-8000-000000000991',
                    created_at: new Date().toISOString(),
                });
                body = { id: recordings[0].id };
            } else if (method === 'PATCH') {
                recordings = recordings.map((row) => ({
                    ...row,
                    ...req.postDataJSON(),
                }));
                body = { id: recordings[0].id };
            } else if (method === 'DELETE') {
                recordings = [];
            } else body = recordings;
        } else if (
            url.pathname.includes('/community_follows') &&
            method === 'POST'
        )
            followed.push(req.postDataJSON());
        else if (url.pathname.includes('/subscription-access'))
            body = { count: 12, limit: 30, remaining: 18, isPro: false };
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body),
        });
    });
    await context.route('https://example.invalid/avatar.jpg', (route) =>
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
    await context.route('https://api.mixcloud.com/**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                key: '/spartacus/party-time/',
                user: { name: 'Spartacus' },
                pictures: {
                    large: 'https://thumbnailer.mixcloud.com/fixture.jpg',
                },
                tags: [
                    { name: 'Jazz' },
                    { name: 'Soul' },
                    { name: 'Vinyl Only' },
                ],
                audio_length: 3840,
                play_count: 230,
            }),
        }),
    );
    await context.route(
        'https://thumbnailer.mixcloud.com/fixture.jpg',
        (route) =>
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
    await context.route(
        'https://widget.mixcloud.com/media/js/widgetApi.js',
        (route) =>
            route.fulfill({
                contentType: 'application/javascript',
                body: `window.Mixcloud={PlayerWidget:function(frame){return {ready:Promise.resolve(),play:function(){window.__mixcloudPlayRequests=(window.__mixcloudPlayRequests||0)+1;return Promise.resolve(true);}};}};`,
            }),
    );
    await context.route('**/widget/iframe/**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<html><body style="font:16px sans-serif;background:#f0edfc;color:#6554df"><p>Mixcloud · Test player</p><button>Play</button></body></html>',
        }),
    );
    await context.route('https://photon.komoot.io/api/**', async (route) => {
        const q = new URL(route.request().url()).searchParams
            .get('q')
            .toLowerCase();
        const city = (id, name, region, country, code) => ({
            properties: {
                osm_type: 'R',
                osm_id: id,
                osm_key: 'place',
                osm_value: 'city',
                name,
                state: region,
                country,
                countrycode: code,
            },
        });
        if (q.includes('cord'))
            return route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    features: [
                        city(1, 'Córdoba', 'Andalucía', 'España', 'ES'),
                        city(2, 'Córdoba', 'Córdoba', 'Argentina', 'AR'),
                    ],
                }),
            });
        if (q.includes('madr'))
            return route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    features: [
                        city(
                            3,
                            'Madrid',
                            'Comunidad de Madrid',
                            'España',
                            'ES',
                        ),
                    ],
                }),
            });
        return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: '{}',
        });
    });
    await page.goto('http://localhost:8081/community');
    await page
        .getByRole('button', { name: 'Completar perfil', exact: true })
        .waitFor();
    for (const label of ['Sesiones', 'Siguiendo', 'DJs', 'Ciudad', 'Estilo'])
        assert.equal(
            await page.getByText(label, { exact: true }).count(),
            0,
            `Gate must hide ${label}`,
        );
    await page.screenshot({
        path: '/private/tmp/djplanner-community-welcome.png',
    });
    await page
        .getByRole('button', { name: 'Completar perfil', exact: true })
        .click();
    await page.waitForURL('**/edit-dj-profile**');
    assert.equal(followed.length, 0);
    assert.equal(
        await page.getByText('Tus enlaces · opcional', { exact: true }).count(),
        0,
        'Setup must not show external links',
    );
    await page
        .getByRole('button', { name: 'Cambiar foto', exact: true })
        .first()
        .waitFor();
    await page.screenshot({ path: '/private/tmp/djplanner-profile-photo.png' });
    assert.equal(
        await page
            .getByRole('button', {
                name: 'Publicar perfil y entrar',
                exact: true,
            })
            .isDisabled(),
        true,
    );
    const genre = page.getByRole('textbox', {
        name: 'Estilos musicales',
        exact: true,
    });
    await genre.waitFor();
    const cityInput = page.getByRole('textbox', {
        name: 'Ciudad *',
        exact: true,
    });
    await cityInput.fill('sev');
    await page.getByRole('button', { name: 'Sevilla', exact: true }).click();
    assert.equal(await cityInput.inputValue(), 'Sevilla');
    await cityInput.fill('  SÃO   PAULO  ');
    await page
        .getByRole('button', {
            name: 'Usar «São Paulo» manualmente',
            exact: true,
        })
        .click();
    assert.equal(
        await cityInput.inputValue(),
        'São Paulo',
        'Unknown worldwide city can be entered manually',
    );
    await cityInput.fill('cord');
    await page
        .getByRole('button', {
            name: 'Córdoba · Andalucía · España',
            exact: true,
        })
        .waitFor();
    await page
        .getByRole('button', {
            name: 'Córdoba · Córdoba · Argentina',
            exact: true,
        })
        .waitFor();
    await page
        .getByRole('button', {
            name: 'Córdoba · Andalucía · España',
            exact: true,
        })
        .click();
    assert.equal(await cityInput.inputValue(), 'Córdoba');
    await cityInput.fill('Unknown Town');
    await page
        .getByText(
            'No pudimos cargar las sugerencias. Puedes escribir y guardar tu ciudad.',
            { exact: true },
        )
        .waitFor();
    await page
        .getByRole('button', {
            name: 'Usar «Unknown Town» manualmente',
            exact: true,
        })
        .click();
    assert.equal(
        await cityInput.inputValue(),
        'Unknown Town',
        'Provider failure leaves manual selection available',
    );
    assert.equal(
        await page.getByText('House', { exact: true }).count(),
        0,
        'No default genre suggestions',
    );
    await genre.fill('jazz');
    await page
        .getByRole('button', { name: 'Añadir Jazz', exact: true })
        .click();
    await genre.fill('house');
    await page
        .getByRole('button', { name: 'Añadir House', exact: true })
        .click();
    await page.screenshot({
        path: '/private/tmp/djplanner-profile-completion.png',
        fullPage: true,
    });
    // Incomplete setup cannot publish. Returning later resumes the welcome gate.
    await page
        .getByRole('button', { name: 'Cancelar', exact: true })
        .last()
        .click();
    await page
        .getByRole('button', { name: 'Completar perfil', exact: true })
        .waitFor();
    // Fixture supplies a photo already uploaded through the native picker boundary.
    current = {
        ...current,
        avatar_url: profile.avatar_url,
        city: 'Madrid',
        genres: 'Jazz · House',
        is_visible: false,
    };
    await page.goto('http://localhost:8081/edit-dj-profile?edit=1&setup=1');
    await page
        .getByRole('textbox', { name: 'Ciudad *', exact: true })
        .fill('madr');
    await page
        .getByRole('button', {
            name: 'Madrid · Comunidad de Madrid · España',
            exact: true,
        })
        .click();
    await page
        .getByRole('button', { name: 'Publicar perfil y entrar', exact: true })
        .click();
    await page.waitForURL('**/community');
    await page.getByText('Sesiones', { exact: true }).waitFor();
    assert.equal(current.city, 'Madrid', 'Saving normalizes the city');
    assert.equal(
        current.city_location.id,
        'photon:R:3',
        'Selected provider identity is saved with the profile',
    );
    assert.equal(
        current.is_visible,
        true,
        'Setup explicitly activates the public DJ profile',
    );
    await page.goto('http://localhost:8081/profile');
    await page
        .getByRole('button', { name: 'Añadir mix', exact: true })
        .waitFor();
    await page
        .getByRole('button', { name: 'Editar Perfil', exact: true })
        .click();
    await page.getByText('Tus enlaces · opcional', { exact: true }).waitFor();
    assert.equal(
        await page
            .getByRole('textbox', { name: 'Ciudad *', exact: true })
            .inputValue(),
        'Madrid',
        'Editing hydrates saved city',
    );
    await page
        .getByRole('textbox', { name: 'Ciudad *', exact: true })
        .fill('ma');
    await page
        .getByRole('button', {
            name: 'Madrid · Comunidad de Madrid · España',
            exact: true,
        })
        .click();
    assert.equal(
        await page
            .getByRole('textbox', { name: 'Ciudad *', exact: true })
            .inputValue(),
        'Madrid',
        'A newly published city becomes a suggestion',
    );
    await page
        .getByRole('button', { name: 'Cancelar', exact: true })
        .last()
        .click();
    await page.getByRole('button', { name: 'Añadir mix', exact: true }).click();
    await page
        .getByRole('textbox', { name: 'Título del mix', exact: true })
        .fill('Late Night Jazz');
    await page
        .getByRole('textbox', { name: 'Enlace de la grabación', exact: true })
        .fill('https://mixcloud.com/spartacus/');
    assert.equal(
        await page
            .getByRole('button', { name: 'Guardar mix', exact: true })
            .isDisabled(),
        true,
    );
    await page
        .getByRole('textbox', { name: 'Enlace de la grabación', exact: true })
        .fill('https://www.mixcloud.com/spartacus/party-time/');
    await page
        .getByRole('button', { name: 'Vista previa', exact: true })
        .click();
    await page.locator('iframe[title="Late Night Jazz"]').waitFor();
    await page
        .getByRole('button', { name: 'Guardar mix', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Abrir reproductor', exact: true })
        .waitFor();
    assert.equal(recordings.length, 1);
    await page.getByText('Spartacus', { exact: true }).waitFor();
    await page
        .getByText('1h 4m · 230 reproducciones', { exact: true })
        .waitFor();
    assert.equal(
        await page
            .getByRole('img', { name: 'Late Night Jazz', exact: true })
            .count(),
        1,
    );

    await page
        .getByRole('button', { name: 'Abrir reproductor', exact: true })
        .click();
    await page.locator('iframe[title="Late Night Jazz"]').waitFor();
    await page.waitForFunction(() => window.__mixcloudPlayRequests === 1);
    assert.equal(
        await page
            .locator('iframe[title="Late Night Jazz"]')
            .getAttribute('height'),
        '60',
    );

    await page
        .getByText('Late Night Jazz', { exact: true })
        .scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/private/tmp/djplanner-profile-mixes.png' });
    // A visitor sees an embedded recording and cannot manage another DJ's mixes.
    await page.goto(
        'http://localhost:8081/community/00000000-0000-4000-8000-000000000902',
    );
    await page.getByText('Late Night Jazz', { exact: true }).waitFor();
    await page.screenshot({
        path: '/private/tmp/djplanner-suno-profile-top.png',
    });
    assert.equal(
        await page
            .getByRole('button', { name: 'Editar mix', exact: true })
            .count(),
        0,
    );
    await page
        .getByRole('button', { name: 'Abrir reproductor', exact: true })
        .click();
    await page.locator('iframe[title="Late Night Jazz"]').waitFor();
    await page
        .getByText('Late Night Jazz', { exact: true })
        .scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/private/tmp/djplanner-public-mixes.png' });
    await page.goto(
        'http://localhost:8081/community/00000000-0000-4000-8000-000000000902?testTheme=dark',
    );
    await page.getByText('Late Night Jazz', { exact: true }).waitFor();
    await page.screenshot({
        path: '/private/tmp/djplanner-suno-profile-dark.png',
    });
    await page.goto('http://localhost:8081/profile');
    await page.getByRole('button', { name: 'Editar mix', exact: true }).click();
    await page
        .getByRole('textbox', { name: 'Título del mix', exact: true })
        .fill('Jazz after dark');
    await page
        .getByRole('button', { name: 'Guardar mix', exact: true })
        .click();
    await page.getByText('Jazz after dark', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await page.getByRole('button', { name: 'Quitar mix', exact: true }).click();
    await page.getByText('Todavía no hay mixes', { exact: true }).waitFor();
    assert.equal(recordings.length, 0);
    assert.deepEqual(errors, []);
    console.log(
        'PASS: full welcome gate, hidden social navigation, DJ editor, incomplete setup/cancel, explicit public activation and mix management',
    );
    await browser.close();
})().catch(async (e) => {
    console.error(e);
    if (page)
        await page
            .screenshot({ path: '/private/tmp/djplanner-mixes-failure.png' })
            .catch(() => {});
    if (browser) await browser.close();
    process.exitCode = 1;
});
