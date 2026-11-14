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
        const fixture = {status:'available',activations:0};
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
            else if (url.pathname.includes('/start_pro_trial')) { fixture.activations++; fixture.status='active'; body={count:12,limit:15,remaining:3,isPro:true,paidPro:false,serverNow:new Date().toISOString(),trial:{eligible:false,status:'active',startedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+15*86400000).toISOString()}}; }
            else if (url.pathname.includes('/subscription-access') || url.pathname.includes('/get_session_usage'))
                body = { count: 12, limit: 15, remaining: 3, isPro: pro || fixture.status==='active', paidPro:pro, serverNow:new Date().toISOString(), trial:{eligible:!pro&&fixture.status==='available',status:fixture.status,startedAt:fixture.status==='available'?null:new Date(Date.now()-86400000).toISOString(),expiresAt:fixture.status==='available'?null:new Date(Date.now()+(fixture.status==='active'?15:-1)*86400000).toISOString()} };
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
        context.trialFixture=fixture;
        return context;
    }


    const base=process.env.BASE_URL||'http://localhost:8081';
    const id='00000000-0000-4000-8000-000000000871';
    const copy=JSON.parse(fs.readFileSync('src/i18n/languages/es.json','utf8'));
    for(const width of [390,320]) {
      for(const target of ['/session/'+id,'/add-session','/edit-session/'+id]) {
        const context=await setup('es',width,true,true);
        const row={id,user_id:user.id,title:'QA navigation',venue:'Sala de prueba',date:'2030-10-10',start_time:'22:00',end_time:'04:00',status:'confirmed',djs:[],earning_type:'free',earning_amount:0,currency:'EUR',color:'#34D399'};
        await context.route('**/rest/v1/sessions*',route=>route.fulfill({json:route.request().headers().accept?.includes('vnd.pgrst.object')?row:[row]}));
        await page.goto(base+target,{waitUntil:'domcontentloaded'});
        if(target.startsWith('/session/')) await page.getByTestId('session-detail-header').waitFor();
        else await page.getByRole('button',{name:'Tipo de sesión',exact:true}).waitFor();
        assert.equal(new URL(page.url()).pathname,target,'cold opening retains its destination');
        await page.reload({waitUntil:'domcontentloaded'});
        if(target.startsWith('/session/')) await page.getByTestId('session-detail-header').waitFor();
        else await page.getByRole('button',{name:'Tipo de sesión',exact:true}).waitFor();
        assert.equal(new URL(page.url()).pathname,target,'reload restores the saved login');
        await context.close();
      }
      const context=await setup('es',width,true);
      await context.addInitScript(()=>localStorage.removeItem('sb-voyurnwckmateohuzbab-auth-token'));
      await page.goto(base+'/session/'+id);
      await page.getByRole('button',{name:copy.login,exact:true}).waitFor();
      assert.equal(new URL(page.url()).pathname,'/login','signed-out access remains protected');
      await page.goto(base+'/login?dj='+id);
      await page.getByRole('link',{name:copy.authExperience.forgotPassword,exact:true}).click();
      assert.equal(new URL(page.url()).searchParams.get('dj'),id);
      await page.getByRole('button',{name:copy.authExperience.back,exact:true}).click();
      assert.equal(new URL(page.url()).searchParams.get('dj'),id,'return from recovery preserves the profile');
      let recoveryRedirect;
      await context.route('**/auth/v1/recover*',async route=>{recoveryRedirect=new URL(route.request().url()).searchParams.get('redirect_to');await route.fulfill({json:{}});});
      await page.getByRole('link',{name:copy.authExperience.forgotPassword,exact:true}).click();
      await page.getByRole('textbox',{name:copy.email_placeholder,exact:true}).fill('fixture@example.invalid');
      await page.getByRole('button',{name:copy.authExperience.sendRecovery,exact:true}).click();
      await page.getByRole('button',{name:copy.authExperience.returnLogin,exact:true}).waitFor();
      assert.equal(new URL(recoveryRedirect).searchParams.get('dj'),id,'recovery email link preserves the target');
      await page.getByRole('button',{name:copy.authExperience.returnLogin,exact:true}).click();
      assert.equal(new URL(page.url()).searchParams.get('dj'),id);
      await page.goto(base+'/reset-password?dj='+id);
      await page.getByRole('button',{name:copy.authExperience.sendNewLink,exact:true}).click();
      assert.equal(new URL(page.url()).searchParams.get('dj'),id,'expired reset keeps the target');
      await page.goto(base+'/reset-password?dj='+id+'#type=recovery&access_token='+token+'&refresh_token=fixture');
      await page.getByLabel(copy.authExperience.newPassword,{exact:true}).waitFor();
      assert.equal(new URL(page.url()).searchParams.get('dj'),id);
      assert.equal(new URL(page.url()).hash,'','consumed credentials are removed from history');
      await page.getByLabel(copy.authExperience.newPassword,{exact:true}).fill('Fixture-only-123!');
      await page.getByLabel(copy.authExperience.confirmPassword,{exact:true}).fill('Fixture-only-123!');
      await page.getByRole('button',{name:copy.authExperience.savePassword,exact:true}).click();
      await page.getByRole('button',{name:copy.authExperience.returnLogin,exact:true}).click();
      assert.equal(new URL(page.url()).searchParams.get('dj'),id,'completed reset retains shared profile intent');
      await context.close();
      console.log('PASS '+width+'px: cold detail/create/edit, reload, signed-out guard, recovery/back/email/retry/reset, credential scrubbing and shared profile intent. Mock APIs only.');
    }
    assert.deepEqual(errors,[]);await browser.close();
})().catch(async e=>{console.error(e);if(page&&!page.isClosed()){console.error('URL',page.url().split('#')[0]);console.error((await page.locator('body').innerText()).slice(0,1800));}if(browser)await browser.close();process.exitCode=1;});
