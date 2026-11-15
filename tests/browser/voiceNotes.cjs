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
                localStorage.setItem('@theme', typeof dark === 'string' ? dark : dark ? 'dark' : 'light');
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
        page.on('dialog', dialog => dialog.accept());
        return context;
    }





    const base=process.env.BASE_URL||'http://localhost:8097';
    const id='00000000-0000-4000-8000-000000000919';
    for(const [pro,guest,width] of [[false,false,390],[true,false,320],[true,true,390]]) {
        const context=await setup('es',width,true,pro);
        const saved={id,user_id:guest?'00000000-0000-4000-8000-000000000999':user.id,is_guest:guest,
            title:'Voice Test',venue:'Zoco',venue_id:'00000000-0000-4000-8000-000000000912',date:'2030-11-01',
            start_time:'22:00',end_time:'04:00',booking_timezone:'Europe/Madrid',status:'confirmed',
            earning_type:'fixed',earning_amount:200,currency:'EUR',notes:'Nota escrita existente',djs:[],
            created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
        let voiceWrites=0;
        const note={id:'00000000-0000-4000-8000-000000000923',user_id:user.id,session_id:'old-session',venue_id:saved.venue_id,
            title:'Preguntar por el monitor',duration_ms:10000,ready:true,remind_next:true,resolved_at:null,created_at:'2029-11-01T02:00:00Z'};
        await context.route('**/*.supabase.co/**',async route=>{
            const req=route.request(),url=new URL(req.url());let body;
            if(url.pathname.endsWith('/rpc/get_session_usage'))body={count:1,limit:15,remaining:14,isPro:pro};
            else if(url.pathname.endsWith('/sessions')) {
                if(req.method()==='PATCH') {Object.assign(saved,req.postDataJSON());body=[{id}];}
                else body=req.headers().accept?.includes('vnd.pgrst.object')?saved:[saved];
            }
            else if(url.pathname.endsWith('/rpc/pending_voice_notes'))body=[note];
            else if(url.pathname.endsWith('/rpc/voice_reminder_schedule'))body=[];
            else if(url.pathname.endsWith('/session_voice_notes')) {
                if(req.method()==='PATCH') {voiceWrites++;body={id:note.id};}else body=[];
            }else {await route.fallback();return;}
            await route.fulfill({json:body});
        });
        await page.goto(base+'/session/'+id);
        await page.getByText('Voice Test',{exact:true}).first().waitFor();
        assert.equal(await page.getByTestId('session-detail-place').evaluate(el=>el.nextElementSibling?.getAttribute('data-testid')),'session-detail-information','Details immediately follow the place');
        assert.equal(await page.getByTestId('session-voice-notes').count(),0,'Voice recording is no longer embedded in session detail');
        const notice=page.getByRole('button',{name:'Aviso de sesión',exact:true});
        const written=page.getByRole('button',{name:'Notas privadas',exact:true});
        assert.equal(await page.getByTestId('session-notes-card').count(),0,'Written notes also moved out of the session detail');
        if(guest) {
            assert.equal(await notice.count(),0,'Guests never see private notice tools');
            assert.equal(await written.count(),0,'Guests never see written private notes');
        } else {
            await page.getByTestId('session-detail-tools').scrollIntoViewIfNeeded();
            const nb=await notice.boundingBox(),wb=await written.boundingBox();
            assert.ok(Math.abs(nb.y-wb.y)<2 && wb.x>nb.x,'Private notes sit beside the session notice');
            await written.click();await page.waitForURL('**/session-notes?*');
            await page.getByText('Nota escrita existente',{exact:true}).waitFor();
            if(!pro) {
                await page.getByRole('button',{name:'Editar notas',exact:true}).click();
                await page.getByRole('textbox',{name:'Notas privadas',exact:true}).fill('Nota escrita actualizada');
                await page.getByRole('button',{name:'Guardar notas',exact:true}).click();
                await page.getByText('Nota escrita actualizada',{exact:true}).waitFor();
                await page.getByRole('button',{name:'Volver',exact:true}).click();await page.waitForURL('**/session/'+id);
                await notice.click();await page.waitForURL('**/paywall?*');
                assert.equal(await page.getByTestId('session-voice-notes').count(),0,'Free tool button opens PRO paywall');
            } else {
                await page.getByRole('button',{name:'Volver',exact:true}).click();await page.waitForURL('**/session/'+id);
                await page.getByTestId('session-detail-tools').scrollIntoViewIfNeeded();
                await page.screenshot({path:'/tmp/dj-session-notice-button-320.png'});
                await notice.click();await page.waitForURL('**/session-notice?*');
                const card=page.getByTestId('session-voice-notes');await card.waitFor();
                await card.getByText('Graba una nota de audio y recibe un aviso la próxima vez que tengas una sesión en ese lugar.',{exact:true}).waitFor();
                await card.getByText('Graba y escucha tus notas en la app móvil.',{exact:true}).waitFor();
                await page.getByRole('button',{name:/avisos de sesión para Zoco/}).click();
                await page.getByText('Avisos de sesión de Zoco',{exact:true}).waitFor();
                await page.getByText('Preguntar por el monitor',{exact:true}).waitFor();
                await page.getByRole('button',{name:'Recordarme el día anterior',exact:true}).waitFor();
                assert.equal(await page.getByRole('button',{name:'Marcar como resuelta',exact:true}).count(),0);
                assert.equal(voiceWrites,0,'No resolution writes');
                await page.getByRole('button',{name:'Cerrar',exact:true}).click();
                await page.getByRole('button',{name:'Volver',exact:true}).click();await page.waitForURL('**/session/'+id);
                await page.getByTestId('session-detail-place').scrollIntoViewIfNeeded();
                await page.screenshot({path:'/tmp/dj-session-details-order-320.png'});
                // Previously issued links must still open pending notes on the new screen.
                await page.goto(base+'/session/'+id+'?voiceReminder=1');
                await page.waitForURL('**/session-notice?*');
                await page.getByText('Avisos de sesión de Zoco',{exact:true}).waitFor();
            }
        }
        saved.date='2026-10-28';
        await page.goto(base+'/session/'+id+'?postSessionReview=1');
        if(guest) {
            await page.getByText('Voice Test',{exact:true}).first().waitFor();
            assert.equal(await page.getByTestId('session-review-prompt').count(),0,'Review prompt stays private');
        } else {
            const prompt=page.getByTestId('session-review-prompt');await prompt.waitFor();
            await prompt.getByText('¿Qué tal fue tu sesión en Zoco?',{exact:true}).waitFor();
            await page.screenshot({path:'/tmp/dj-post-session-review-'+width+'.png'});
            await prompt.getByRole('button',{name:'Notas privadas',exact:true}).click();
            await page.waitForURL('**/session-notes?*');
            await page.getByTestId('session-notes-card').waitFor();
            await page.getByRole('button',{name:'Volver',exact:true}).click();await page.waitForURL('**/session/'+id+'*');
            await page.goto(base+'/session/'+id+'?postSessionReview=1');
            await page.getByTestId('session-review-prompt').getByRole('button',{name:'Editar sesión',exact:true}).click();
            await page.waitForURL('**/edit-session/'+id);
            await page.goto(base+'/session/'+id+'?postSessionReview=1');
            await page.getByTestId('session-review-prompt').getByRole('button',{name:'Aviso de sesión · PRO',exact:true}).click();
            await page.waitForURL(pro?'**/session-notice?*':'**/paywall?*');
        }
        await context.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: details immediately below place, adjacent microphone/private-note tools, free written-note editing and return, Free paywall, private guest UI, pending notices, legacy links and post-session review actions in Free/PRO.');
    await browser.close();
})().catch(async error=>{console.error(error);if(page&&!page.isClosed()) console.error((await page.locator('body').innerText()).slice(-2000));if(browser)await browser.close();process.exitCode=1;});
