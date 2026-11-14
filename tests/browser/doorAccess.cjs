const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'),
    assert = require('node:assert/strict');
let browser, page;
const errors = [];
const {doorDb}=require('../fixtures/doorDb.cjs');
let db;
const {randomUUID,createHash}=require('node:crypto');
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
    const token = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 604800, role: 'authenticated' })}.${enc('fixture')}`;
    const session = {
        access_token: token,
        refresh_token: 'fixture',
        expires_in: 604800,
        expires_at: Math.floor(Date.now() / 1000) + 604800,
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

    db=await doorDb();
    const eventId=randomUUID(),guest=randomUUID(),labels=JSON.parse(fs.readFileSync('src/i18n/languages/es.json','utf8'));
    await db.query('insert into auth.users values($1)',[user.id]);
    const event=(await db.query("insert into sessions(id,user_id,date,title,venue,start_time,end_time,booking_timezone) values($1,$2,current_date,'Soul Night','Sala X','00:00','23:59','UTC') returning *",[eventId,user.id])).rows[0];
    event.date=new Date(event.date).toISOString().slice(0,10);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user.id]);
    await db.query('select public.save_event_guest($1,$2,$3,$4,$5)',[eventId,guest,'Manuel Parra',2,0]);
    let sequence=Promise.resolve(),staffAuthCalls=0,failManual=true;
    async function attach(context,owner){
        await context.route('**/rest/v1/sessions*',r=>r.fulfill({json:r.request().headers().accept?.includes('object')?event:[event]}));
        await context.route('**/rest/v1/rpc/door_*',r=>{
            const fn=new URL(r.request().url()).pathname.split('/').pop(),body=r.request().postDataJSON();
            const params={door_manage:['p_session','p_action','p_id','p_label','p_hash','p_zone'],door_claim:['p_id','p_token','p_device'],door_state:['p_id','p_device'],door_scan:['p_id','p_device','p_hash'],door_admit:['p_id','p_device','p_request','p_guest','p_quantity']}[fn];
            assert.ok(params,'Known limited door RPC');
            if(!owner){const bearer=r.request().headers().authorization.split(' ')[1];assert.notEqual(bearer,token,'Door must not use the owner JWT');}
            const run=async()=>{
                await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner?user.id:'']);await db.exec(`set role ${owner?'authenticated':'anon'}`);
                try{
                    const data=(await db.query(`select public.${fn}(${params.map((_,i)=>'$'+(i+1)).join(',')}) as r`,params.map(x=>body[x]??null))).rows[0].r;
                    if(fn==='door_admit'&&!body.p_guest&&failManual){failManual=false;await r.abort('failed');return;}
                    await r.fulfill({json:data});
                }catch(e){await r.fulfill({status:400,json:{message:e.message,code:'P0001'}});}
            };
            sequence=sequence.then(run);return sequence;
        });
    }
    const ownerContext=await setup();const ownerPage=page;ownerPage.on('dialog',d=>d.dismiss());await attach(ownerContext,true);
    await ownerPage.goto('http://localhost:8081/door-access?sessionId='+eventId);
    const links=[];
    for(let i=1;i<=3;i++){
        await ownerPage.getByRole('textbox',{name:labels.door.person}).fill('Puerta '+i);
        await ownerPage.getByRole('button',{name:labels.door.create,exact:true}).click();
        await ownerPage.getByText('Puerta '+i,{exact:true}).first().waitFor();
        await ownerPage.getByRole('button',{name:labels.door.copy,exact:true}).click();
        links.push(await ownerPage.evaluate(()=>navigator.clipboard.readText()));
    }
    assert.equal((await ownerPage.getByText(labels.door.pending,{exact:true}).all()).length,3);
    const staff=[];
    for(const url of links){
        const context=await browser.newContext({viewport:{width:390,height:844},locale:'es'});
        await context.grantPermissions(['camera']);
        await context.route('**/*.supabase.co/**',r=>{if(r.request().url().includes('/auth/v1/'))staffAuthCalls++;return r.fulfill({json:[]});});
        await attach(context,false);
        const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
        await p.goto(url);await p.getByTestId('door-entries').waitFor();staff.push({context,page:p});
        assert.ok(!new URL(p.url()).searchParams.has('key'),'Remove invite token from URL');
    }
    assert.equal(staffAuthCalls,0,'No login/signup request for staff');
    await staff[0].page.getByRole('button',{name:labels.entryCounter.addManual,exact:true}).click();
    await staff[0].page.getByRole('button',{name:labels.door.retryAdmission,exact:true}).click();
    await staff[0].page.getByTestId('door-entries').filter({hasText:/^1$/}).waitFor();
    await staff[1].page.getByTestId('door-entries').filter({hasText:/^1$/}).waitFor({timeout:20000});
    for(let i=0;i<2;i++){
        const p=staff[i].page;
        await p.getByRole('button',{name:labels.tickets.scan,exact:true}).click();
        await p.getByRole('textbox',{name:labels.tickets.manualQr,exact:true}).fill('external-provider-qr');
        await p.getByRole('button',{name:labels.tickets.validate,exact:true}).click();
        await p.getByText(i===0?labels.entryCounter.result_accepted:labels.entryCounter.result_already_used,{exact:true}).waitFor();
        await p.getByRole('button',{name:labels.door.back,exact:true}).click();
        await p.getByTestId('door-entries').filter({hasText:/^2$/}).waitFor();
    }
    for(const {page:p} of staff){
        await p.getByRole('button',{name:labels.guests.title,exact:true}).click();
        await p.getByRole('button',{name:labels.door.admitOne+' Manuel Parra',exact:true}).click();
    }
    await staff[2].page.getByText('3 de 3 han accedido',{exact:true}).waitFor();
    assert.equal(await staff[2].page.getByRole('button',{name:labels.door.admitOne+' Manuel Parra',exact:true}).isDisabled(),true);
    await staff[2].page.screenshot({path:'/private/tmp/djplanner-door-guests.png'});
    // A forwarded invitation cannot be activated on another installation.
    const fourth=await browser.newContext({viewport:{width:390,height:844},locale:'es'});
    await fourth.route('**/*.supabase.co/**',r=>r.fulfill({json:[]}));await attach(fourth,false);
    const forwarded=await fourth.newPage();await forwarded.goto(links[0]);await forwarded.getByText(labels.door.alreadyClaimed,{exact:true}).waitFor();
    // Resume after reload without signing up or reopening the original invitation.
    await staff[1].page.goto('http://localhost:8081/');await staff[1].page.getByTestId('door-entries').waitFor();
    // Revoke the first invitation, then check the next request rejects it.
    await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user.id]);await db.exec('set role authenticated');
    const firstId=new URL(links[0]).searchParams.get('invite');await db.query('select public.door_manage($1,$2,$3)',[eventId,'revoke',firstId]);
    await staff[0].page.getByText(labels.door.unavailable,{exact:true}).waitFor({timeout:20000});
    assert.deepEqual(errors,[]);
    console.log('PASS: owner creates three invitations; three devices without registration share real SQL counts; lost-response retry counts once; guest capacity; forwarded invitation rejected; resume; revocation');
    await browser.close();await db.close();
})().catch(async e=>{console.error(e);if(page)console.error(await page.locator('body').innerText());if(browser)await browser.close();if(db)await db.close();process.exitCode=1;});
