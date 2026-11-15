const { PGlite } = require('@electric-sql/pglite'),
    fs = require('node:fs'),
    assert = require('node:assert/strict');
(async () => {
    const db = new PGlite();
    await db.exec(fs.readFileSync('tests/fixtures/bookingBase.sql', 'utf8'));
    await db.exec(`alter table public.sessions add column booking_timezone text default 'Europe/Madrid';
 create table public.expenses(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users,amount numeric,description text,category text,date date,created_at timestamptz default now(),updated_at timestamptz default now());
 alter table public.expenses enable row level security;
 grant select,insert,update,delete on public.expenses to authenticated;
 create policy "Users can view their own expenses" on public.expenses for select to authenticated using(auth.uid()=user_id);
 create policy "Users can insert their own expenses" on public.expenses for insert to authenticated with check(auth.uid()=user_id);
 create policy "Users can update their own expenses" on public.expenses for update to authenticated using(auth.uid()=user_id);
 create policy "Users can delete their own expenses" on public.expenses for delete to authenticated using(auth.uid()=user_id);
 create schema storage;grant usage on schema storage to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit int,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 create function storage.foldername(name text) returns text[] language sql as $$select string_to_array(name,'/')$$;
 alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;`);
    await db.exec(
        fs.readFileSync(
            'supabase/migrations/20261008223136_session_expenses_preparation_blocked_days.sql',
            'utf8',
        ),
    );
    await db.exec(
        fs.readFileSync(
            'supabase/migrations/20261008224314_expense_agreement_accounting.sql',
            'utf8',
        ),
    );
    await db.exec(
        fs.readFileSync(
            'supabase/migrations/20261008224800_expense_owner_index_and_policies.sql',
            'utf8',
        ),
    );
    const a = crypto.randomUUID(),
        b = crypto.randomUUID(),
        future = crypto.randomUUID(),
        past = crypto.randomUUID(),
        foreign = crypto.randomUUID();
    await db.query('insert into auth.users values($1),($2)', [a, b]);
    await db.query(
        "insert into public.sessions(id,user_id,date,title,venue,start_time,end_time) values($1,$2,'2099-10-10','Future','Club','22:00','04:00'),($3,$2,'2020-10-10','Past','Club','22:00','04:00'),($4,$5,'2099-10-10','Foreign','Club','22:00','04:00')",
        [future, a, past, foreign, b],
    );
    const role = async (uid, name = 'authenticated') => {
        await db.exec('reset role');
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
            uid,
        ]);
        await db.exec(`set role ${name}`);
    };
    await role(a);
    const q = (sql, args = []) => db.query(sql, args);
    const expense = async (
        sid,
        amount = 10,
        currency = 'EUR',
        receipt = null,
    ) =>
        q(
            'insert into public.expenses(user_id,session_id,amount,date,currency,receipt_path)values($1,$2,$3,current_date,$4,$5)returning id',
            [a, sid, amount, currency, receipt],
        );
    const e = (await expense(past, 70, 'EUR', `${a}/invoice.jpg`)).rows[0].id;
    await expense(future, 15);
    await assert.rejects(() => expense(foreign), /invalidSession/);
    await assert.rejects(() => expense(past, -5), /expense_positive/);
    await assert.rejects(() => expense(past, 5, 'USD'), /currencyMismatch/);
    await assert.rejects(
        () => expense(past, 5, 'EUR', `${b}/private.jpg`),
        /expense_receipt_owner/,
    );
    await assert.rejects(
        () => q('update public.expenses set user_id=$1 where id=$2', [b, e]),
        /row-level security|invalidSession/,
    );
    await assert.rejects(
        () =>
            q("update public.sessions set currency='USD' where id=$1", [past]),
        /currencyLocked/,
    );
    const task = crypto.randomUUID();
    await q(
        'insert into public.session_tasks(id,user_id,session_id,title)values($1,$2,$3,$4)',
        [task, a, future, 'Preparar USB'],
    );
    await q('update public.session_tasks set completed=true where id=$1', [
        task,
    ]);
    assert.equal(
        (await q('select completed from public.session_tasks')).rows[0]
            .completed,
        true,
    );
    await assert.rejects(
        () =>
            q(
                'insert into public.session_tasks(id,user_id,session_id,title)values($1,$2,$3,$4)',
                [crypto.randomUUID(), a, past, 'Past task'],
            ),
        /row-level security/,
    );
    await assert.rejects(
        () =>
            q(
                'insert into public.session_tasks(id,user_id,session_id,title)values($1,$2,$3,$4)',
                [crypto.randomUUID(), a, foreign, 'Foreign task'],
            ),
        /row-level security/,
    );
    await q(
        "insert into public.blocked_days(user_id,date) values($1,'2099-10-11')",
        [a],
    );
    await q('insert into storage.objects(bucket_id,name)values($1,$2)', [
        'expense-receipts',
        `${a}/invoice.jpg`,
    ]);
    await assert.rejects(
        () =>
            q('insert into storage.objects(bucket_id,name)values($1,$2)', [
                'expense-receipts',
                `${b}/stolen.jpg`,
            ]),
        /row-level security/,
    );
    await role(b);
    assert.equal((await q('select * from public.expenses')).rows.length, 0);
    assert.equal(
        (await q('select * from public.session_tasks')).rows.length,
        0,
    );
    assert.equal((await q('select * from public.blocked_days')).rows.length, 0);
    assert.equal((await q('select * from storage.objects')).rows.length, 0);
    await role('', 'anon');
    await assert.rejects(
        () => q('select * from public.session_tasks'),
        /permission denied/,
    );
    await role(a);
    await q('delete from public.sessions where id=$1', [future]);
    assert.equal(
        (await q('select * from public.session_tasks')).rows.length,
        0,
    );
    assert.equal(
        (await q('select * from public.expenses where session_id is null')).rows
            .length,
        1,
        'Session deletion preserves real spending',
    );
    assert.equal((await q('select * from public.expenses')).rows.length, 2);
    await q('delete from public.expenses where id=$1', [e]);
    assert.equal((await q('select * from public.expenses')).rows.length, 1);
    await db.close();
    console.log(
        'Session tools database: ownership, currencies, past expenses, future tasks, private invoices and deletion passed',
    );
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
