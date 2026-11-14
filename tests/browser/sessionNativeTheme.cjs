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




    const base = process.env.BASE_URL || 'http://localhost:8081';
    const id='00000000-0000-4000-8000-000000000919';
    const event={id,user_id:user.id,title:'Theme Test',venue:'Club Test',date:'2030-10-10',start_time:'22:00',end_time:'04:00',status:'confirmed',djs:[],is_collective:false,earning_type:'fixed',earning_amount:150,currency:'EUR',booking_timezone:'Europe/Madrid',color:'#34D399'};
    function contrast(fg,bg){
        const luminance=color=>{
            const values=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{const s=n/255;return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;});
            return .2126*values[0]+.7152*values[1]+.0722*values[2];
        };
        const a=luminance(fg),b=luminance(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    }
    for(const theme of ['dark','dark-honey','dark-ocean','dark-bubble','light']){
        const dark=theme!=='light';
        const context=await setup('es',390,theme);
        await context.route('**/rest/v1/sessions*',route=>route.fulfill({json:route.request().headers().accept?.includes('vnd.pgrst.object')?event:[event]}));
        await context.route('**/rest/v1/rpc/get_session_usage',route=>route.fulfill({json:{count:1,limit:15,remaining:14,isPro:false}}));
        const disableDarkUtilities=async()=>{
            if(!dark)return;
            const removed=await page.evaluate(()=>{
                let count=0;
                const visit=sheet=>{
                    let rules;try{rules=sheet.cssRules;}catch{return;}
                    for(const rule of rules){
                        if(rule.cssRules)visit(rule);
                        if(rule.selectorText?.includes('.dark')&&rule.style){
                            for(const property of ['background-color','color','border-color']){
                                if(rule.style.getPropertyValue(property)){rule.style.removeProperty(property);count++;}
                            }
                        }
                    }
                };
                for(const sheet of document.styleSheets)visit(sheet);
                return count;
            });
            assert(removed>0,'The regression test must suppress dark utility colours');
        };
        const checkField=async testId=>{
            const field=page.getByTestId(testId).filter({visible:true}).first();
            const colors=await field.evaluate(element=>{
                const own=getComputedStyle(element);
                const text=element.tagName==='INPUT'?element:element.querySelector('[dir="auto"]')||element;
                return {background:own.backgroundColor,color:getComputedStyle(text).color};
            });
            assert.equal(colors.background,dark?'rgb(36, 36, 34)':'rgb(248, 249, 253)',testId+': '+JSON.stringify(colors));
            if(dark)assert(contrast(colors.color,colors.background)>=7,testId+': '+JSON.stringify(colors));
        };
        const checkLabels=async()=>{
            for(const label of ['Nombre del evento · Opcional','Lugar *','Fecha *','Hora inicio','Hora fin']){
                const el=page.getByText(label,{exact:true}).filter({visible:true}).first();
                assert.equal(await el.evaluate(el=>getComputedStyle(el).color),dark?'rgb(247, 247, 247)':'rgb(55, 65, 81)',label);
            }
        };
        await page.goto(base+'/home');
        await page.getByRole('button',{name:'Crear',exact:true}).click();
        await page.getByRole('button',{name:'Simple',exact:true}).click();
        await page.waitForURL('**/add-session');
        await page.getByTestId('session-date-field').waitFor();await disableDarkUtilities();
        await checkLabels();
        for(const field of ['session-date-field','session-repeat-field','session-start-time-field','session-end-time-field','session-color-field'])await checkField(field);
        await page.getByTestId('session-date-field').scrollIntoViewIfNeeded();
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/session-native-colors-'+theme+'.png'});
        await page.getByTestId('session-repeat-field').click();
        const weekly=page.getByText('Todas las semanas',{exact:true}).filter({visible:true});await weekly.waitFor();
        if(dark){assert.equal(await weekly.evaluate(el=>getComputedStyle(el).color),'rgb(247, 247, 247)');}
        await weekly.click();
        await page.getByTestId('session-repeat-field').scrollIntoViewIfNeeded();await checkField('session-repeat-field');
        await page.getByTestId('session-color-field').click();
        await page.getByText('Tomate',{exact:true}).filter({visible:true}).click();
        await checkField('session-color-field');
        await page.getByTestId('session-venue-field').click();
        const add=page.getByRole('button',{name:'Añadir lugar',exact:true});await add.waitFor();
        const colors=await add.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el.querySelector('[dir="auto"]')).color}));
        assert(contrast(colors.color,colors.background)>=4.5,'Add place contrast: '+JSON.stringify(colors));
        if(theme==='dark')assert.equal(colors.color,'rgb(35, 35, 35)');
        await page.screenshot({path:process.cwd()+'/../outputs/DJPlannerPro/venue-button-contrast-'+theme+'.png'});
        await add.click();
        // Open the new-place form without saving data.
        await page.getByText('Nuevo lugar',{exact:true}).waitFor();
        await page.getByRole('button',{name:'Cancelar',exact:true}).click();
        await page.goto(base+'/home');
        await page.getByText('Theme Test',{exact:true}).filter({visible:true}).first().click();
        await page.waitForURL('**/session/'+id);
        await page.getByRole('button',{name:'Editar sesión',exact:true}).click();
        await page.waitForURL('**/edit-session/'+id);await page.getByTestId('session-date-field').waitFor();await disableDarkUtilities();
        await checkLabels();
        for(const field of ['session-date-field','session-start-time-field','session-end-time-field','session-color-field'])await checkField(field);
        await context.close();console.log('PASS native colour fallback and button contrast: '+theme);
    }
    assert.deepEqual(errors,[]);
    await browser.close();
})().catch(async error=>{console.error(error);if(page&&!page.isClosed()){console.error((await page.locator('body').innerText()).slice(-2600));await page.screenshot({path:'/private/tmp/session-native-theme-failure.png'});}if(browser)await browser.close();process.exitCode=1;});
