#!/usr/bin/env python3
"""Read-only cloud export and isolated local restore drill. No production restore mode."""
import hashlib,json,os,re,secrets,shlex,shutil,subprocess,sys,tarfile,tempfile,time
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import quote
ROOT=Path(__file__).resolve().parents[2]
REF='voyurnwckmateohuzbab'
IMAGE='public.ecr.aws/supabase/postgres:17.6.1.063'
CLI=['npx','--yes','supabase@2.81.3']
CORE=['public','auth','storage','account_private','billing_private','booking_private','community_private','door_private','poster_private','storage_private','ticketing_private','supabase_migrations']
os.umask(0o077)
def run(args,env=None,output=None,input=None):
    with (open(output,'wb') if output else open(os.devnull,'wb')) as target:
        result=subprocess.run(args,cwd=ROOT,env=env,input=input,stdout=target if output else subprocess.PIPE,stderr=subprocess.PIPE,timeout=600)
    if result.returncode:
        detail=next((line for line in result.stderr.decode(errors='replace').splitlines() if line.startswith(('pg_restore: error:','pg_dump: error:','psql: error:','ERROR:'))),'')
        raise RuntimeError('Command failed: '+args[0]+' '+(' '.join(args[1:3]))+(' — '+detail if detail else ''))
    return result.stdout.decode() if result.stdout is not None else ''
def sql_literal(value):return "'"+value.replace("'","''")+"'"
def sql_ident(value):return '"'+value.replace('"','""')+'"'
def sha(file):
    h=hashlib.sha256()
    with open(file,'rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()
def connection():
    script=run(CLI+['db','dump','--linked','--dry-run'])
    env=os.environ.copy()
    for line in script.splitlines():
        if re.match(r'^export PG[A-Z_]+=',line):
            _,assignment=shlex.split(line);name,value=assignment.split('=',1);env[name]=value
    if not all(env.get(k) for k in ['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE']):raise RuntimeError('Temporary connection unavailable')
    env['PGHOST']=env['PGHOST'].strip('[]');env['PGSSLMODE']='require';env['PGOPTIONS']='-c default_transaction_read_only=on'
    return env
def remote_command(env,binary,args):
    names=['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE','PGOPTIONS']
    return ['docker','run','--rm','-i','--read-only']+sum((['--env',name] for name in names),[])+['--entrypoint',binary,IMAGE]+args
class Snapshot:
    def __init__(self,env):
        self.p=subprocess.Popen(remote_command(env,'psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1']),env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
        self.ask('SET ROLE postgres; BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();')
        self.id=self.last
        if not re.fullmatch(r'[a-fA-F0-9-]+',self.id):raise RuntimeError('Snapshot unavailable')
    def ask(self,sql):
        self.p.stdin.write(sql+'\n');self.p.stdin.flush();self.last=self.p.stdout.readline().strip()
        if not self.last:raise RuntimeError('Snapshot query failed')
        return self.last
    def json(self,sql):return json.loads(self.ask(sql))
    def close(self):
        if self.p.poll() is None:
            self.p.stdin.write('ROLLBACK;\n\\q\n');self.p.stdin.flush();self.p.wait(timeout=15)
def table_digest(schema,table):
    return "SELECT json_build_object('schema',"+sql_literal(schema)+",'table',"+sql_literal(table)+",'rows',count(*),'digest',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) FROM "+sql_ident(schema)+'.'+sql_ident(table)+' t;'
def local_sql(container,sql,db='drill'):
    return run(['docker','exec','-i',container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d',db],input=sql.encode()).strip()
def create():
    folder=ROOT.parent/'private-backups';folder.mkdir(mode=0o700,exist_ok=True);(folder/'.gitignore').write_text('*\n')
    stamp=time.strftime('%Y%m%d-%H%M%S');work=Path(tempfile.mkdtemp(prefix='djplanner-snapshot-'));snapshot=None;container=None;cleanup=[]
    try:
        env=connection();snapshot=Snapshot(env);print('Connected with a read-only snapshot.',flush=True)
        schemas=','.join(sql_literal(s) for s in CORE)
        tables=snapshot.json("SELECT coalesce(json_agg(json_build_object('schema',n.nspname,'table',c.relname) order by n.nspname,c.relname),'[]') FROM pg_class c join pg_namespace n on n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN ("+schemas+");")
        inventory=[snapshot.json(table_digest(t['schema'],t['table'])) for t in tables]
        files=snapshot.json("SELECT coalesce(json_agg(json_build_object('bucket',bucket_id,'name',name,'size',(metadata->>'size')::bigint) order by bucket_id,name),'[]') FROM storage.objects;")
        run(remote_command(env,'pg_dump',['--role=postgres','--format=custom','--no-subscriptions','--snapshot='+snapshot.id]),env=env,output=work/'database.dump')
        roles=snapshot.json("SELECT coalesce(json_agg(json_build_object('name',rolname,'inherit',rolinherit,'bypassrls',rolbypassrls) order by rolname),'[]') FROM pg_roles WHERE rolname !~ '^pg_' AND rolname !~ '^cli_login_';")
        policies=snapshot.json("SELECT coalesce(json_agg(to_jsonb(p) order by schemaname,tablename,policyname),'[]') FROM pg_policies p WHERE schemaname IN ("+schemas+");")
        snapshot.close();snapshot=None
        print('Database snapshot exported; downloading Storage.',flush=True)
        storage=work/'storage'/'blobs';storage.mkdir(parents=True)
        keys=json.loads(run(CLI+['projects','api-keys','--project-ref',REF,'--output','json']))
        service_key=next((item.get('api_key') for item in keys if item.get('name')=='service_role'),None)
        if not service_key:raise RuntimeError('Storage backup access unavailable')
        for item in files:
            # Hash paths on disk so case-sensitive or unusual object names cannot collide.
            blob=hashlib.sha256((item['bucket']+'\0'+item['name']).encode()).hexdigest()
            item['blob']='storage/blobs/'+blob;file=work/item['blob']
            url='https://'+REF+'.supabase.co/storage/v1/object/authenticated/'+quote(item['bucket'],safe='')+'/'+quote(item['name'],safe='/')
            request=Request(url,headers={'apikey':service_key,'Authorization':'Bearer '+service_key})
            with urlopen(request,timeout=60) as response,open(file,'wb') as target:shutil.copyfileobj(response,target)
            if item['size'] is not None and file.stat().st_size!=item['size']:raise RuntimeError('Storage size changed during export')
            item['sha256']=sha(file)
        del service_key,keys
        manifest={'project':REF,'createdAt':stamp,'databaseImage':IMAGE,'tables':inventory,'policies':policies,'roles':roles,'storage':files,'consistentDatabaseSnapshot':True,'storageAtomicWithDatabase':False}
        (work/'manifest.json').write_text(json.dumps(manifest,indent=2))
        shutil.copytree(ROOT/'supabase'/'functions',work/'local-function-sources',ignore=shutil.ignore_patterns('.env*'))
        shutil.copytree(ROOT/'supabase'/'migrations',work/'local-migrations')
        shutil.copy(ROOT/'supabase'/'config.toml',work/'local-config-reference.toml')
        archive=work.parent/(work.name+'.tar');cleanup.append(archive)
        with tarfile.open(archive,'w') as tar:
            for entry in work.iterdir():tar.add(entry,arcname=entry.name)
        keyfile=ROOT.parent/'private-backups'/'recovery-key.local';existing=keyfile.read_text() if keyfile.exists() else ''
        if not re.search(r'^BACKUP_RECOVERY_KEY=[a-f0-9]{64}$',existing,re.M):
            with open(keyfile,'a') as stream:stream.write('\nBACKUP_RECOVERY_KEY='+secrets.token_hex(32)+'\n')
        keyfile.chmod(0o600)
        encrypted=folder/('djplanner-'+stamp+'.tar.aesgcm')
        run(['node',str(ROOT/'scripts/backup/crypto.cjs'),'encrypt',str(archive),str(encrypted),str(keyfile)])
        restored_tar=work.parent/(work.name+'-restored.tar');cleanup.append(restored_tar)
        run(['node',str(ROOT/'scripts/backup/crypto.cjs'),'decrypt',str(encrypted),str(restored_tar),str(keyfile)])
        restored=Path(tempfile.mkdtemp(prefix='djplanner-restore-'));cleanup.append(restored)
        with tarfile.open(restored_tar) as tar:tar.extractall(restored,filter='data')
        print('Encrypted copy verified; checking isolated restore.',flush=True)
        result=run(['python3',str(ROOT/'scripts/backup/restore.py'),str(encrypted)])
        print(result,flush=True)

    finally:
        if snapshot:
            try:snapshot.close()
            except Exception:pass
        if container:subprocess.run(['docker','rm','-f',container],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        shutil.rmtree(work,ignore_errors=True)
        for item in cleanup:
            if item.is_dir():shutil.rmtree(item,ignore_errors=True)
            else:item.unlink(missing_ok=True)
if __name__=='__main__':
    try:create()
    except Exception as error:print('Backup not marked verified: '+str(error),file=sys.stderr);sys.exit(1)
