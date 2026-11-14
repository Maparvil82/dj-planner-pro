#!/usr/bin/env python3
"""Restore an encrypted DJ Planner copy only into a new network-isolated local container."""
import json,os,secrets,shutil,subprocess,sys,tarfile,tempfile,time
from pathlib import Path
from snapshot import ROOT,run,sha,sql_literal,sql_ident,table_digest
os.umask(0o077)
def main(archive):
    work=Path(tempfile.mkdtemp(prefix='djplanner-drill-'));container=None;created=False
    try:
        tarfile_path=work/'restore.tar'
        run(['node',str(ROOT/'scripts/backup/crypto.cjs'),'decrypt',str(archive),str(tarfile_path),str(ROOT.parent/'private-backups'/'recovery-key.local')])
        restored=work/'files';restored.mkdir()
        with tarfile.open(tarfile_path) as tar:tar.extractall(restored,filter='data')
        manifest=json.loads((restored/'manifest.json').read_text());image=manifest['databaseImage']
        if image!='public.ecr.aws/supabase/postgres:17.6.1.063':raise RuntimeError('Unapproved local database image')
        container='djplanner-restore-'+secrets.token_hex(4);password=secrets.token_hex(24)
        run(['docker','run','--rm','-d','--name',container,'--network','none','--env','POSTGRES_PASSWORD='+password,'--env','PGPASSWORD='+password,'--env','PGDATA=/var/lib/postgresql/data/drill','--tmpfs','/var/lib/postgresql/data',image,'postgres','-c','shared_preload_libraries=pg_cron','-c','cron.database_name=drill','-c','cron.launch_active_jobs=off']);created=True
        def sql(query,db='drill'):
            return run(['docker','exec','-i',container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d',db],input=query.encode()).strip()
        for i in range(120):
            state=subprocess.run(['docker','exec',container,'cat','/proc/1/comm'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
            if state.stdout.strip() not in (b'postgres',b'.postgres-wrapp'):time.sleep(0.5);continue
            result=subprocess.run(['docker','exec',container,'psql','-X','-q','-A','-t','-U','postgres','-d','postgres','-c','SELECT 1'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
            if result.returncode==0 and result.stdout.strip()==b'1':break
            time.sleep(0.5)
        else:raise RuntimeError('Local database access unavailable')
        print('Local database ready; restoring roles and schema.',flush=True)
        run(['docker','exec',container,'psql','-X','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres','-c','ALTER ROLE postgres SUPERUSER;'])
        for role in manifest['roles']:
            name=role['name'];sql("DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname="+sql_literal(name)+") THEN CREATE ROLE "+sql_ident(name)+" NOLOGIN; END IF;END$$;",'postgres')
        sql('CREATE DATABASE drill TEMPLATE template0;','postgres')
        run(['docker','cp',str(restored/'database.dump'),container+':/tmp/database.dump'])
        run(['docker','exec',container,'pg_restore','-U','postgres','-d','drill','--exit-on-error','--single-transaction','/tmp/database.dump'])
        inventory=manifest['tables'];actual=[json.loads(sql(table_digest(t['schema'],t['table']))) for t in inventory]
        if actual!=inventory:raise RuntimeError('Restored rows differ from snapshot')
        schemas=','.join(sql_literal(s) for s in sorted(set(t['schema'] for t in inventory)))
        policies=json.loads(sql("SELECT coalesce(json_agg(to_jsonb(p) order by schemaname,tablename,policyname),'[]') FROM pg_policies p WHERE schemaname IN ("+schemas+");"))
        if policies!=manifest['policies']:raise RuntimeError('Restored RLS policies differ')
        for item in manifest['storage']:
            if sha(restored/item['blob'])!=item['sha256']:raise RuntimeError('Restored object digest differs')
        report={'verified':True,'backup':str(archive.resolve()),'backupSha256':sha(archive),'tablesVerified':len(inventory),'filesVerified':len(manifest['storage']),'rowsVerified':sum(t['rows'] for t in inventory),'rlsPoliciesVerified':len(policies),'isolated':True,'cloudPasswordChanged':False,'offsiteCopyPending':True,'providerSecretsNotIncluded':True}
        archive.with_suffix('.verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
    finally:
        if created:subprocess.run(['docker','rm','-f',container],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        shutil.rmtree(work,ignore_errors=True)
if __name__=='__main__':
    try:main(Path(sys.argv[1]))
    except Exception as error:print('Restore not marked verified: '+str(error),file=sys.stderr);sys.exit(1)
