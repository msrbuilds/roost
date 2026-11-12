const assert=require('node:assert/strict');
const fs=require('node:fs');
const zlib=require('node:zlib');
const cp=require('node:child_process');
const {S3Client,ListObjectsV2Command,GetObjectCommand}=require(require.resolve('@aws-sdk/client-s3',{paths:[process.cwd(),`${__dirname}/../server`]}));
if(process.env.ROOST_STAGING_TESTS!=='true')throw new Error('Staging opt-in required');
const database=`roost_restore_check_${Date.now()}`;
const file='/tmp/roost-restore-check.sql';
function sql(db,args){
 const result=cp.spawnSync('psql',['-h',process.env.SUPABASE_DB_HOST,'-U',process.env.SUPABASE_DB_USER,'-d',db,'-v','ON_ERROR_STOP=1',...args],{encoding:'utf8',env:{...process.env,PGPASSWORD:process.env.SUPABASE_DB_PASSWORD}});
 if(result.status)throw new Error(result.stderr.split('\n').filter(l=>/ERROR|FATAL/.test(l)).join('\n')||'Restore SQL command failed');
 return result.stdout;
}
async function main(){
 if(process.env.ROOST_CREATE_TEST_BACKUP==='true'){
  const {createClient}=require(require.resolve('@supabase/supabase-js',{paths:[process.cwd(),`${__dirname}/../server`]}));
  const fixtures=JSON.parse(fs.readFileSync('/tmp/roost-staging-users.json','utf8'));
  const user=fixtures.users.find(u=>u.role==='admin');
  const auth=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await auth.auth.signInWithPassword({email:user.email,password:fixtures.password});
  assert.equal(login.error,null,login.error?.message);
  const response=await fetch(`${process.env.FRONTEND_URL}/api/backup/trigger`,{method:'POST',headers:{Authorization:`Bearer ${login.data.session.access_token}`}});
  assert.equal(response.status,200,await response.text());
  console.log('PASS fresh database backup with matching dump client');
 }
 const client=new S3Client({region:process.env.AWS_BACKUP_REGION,endpoint:process.env.AWS_BACKUP_ENDPOINT,forcePathStyle:true,credentials:{accessKeyId:process.env.AWS_BACKUP_ACCESS_KEY_ID,secretAccessKey:process.env.AWS_BACKUP_SECRET_ACCESS_KEY}});
 const bucket=process.env.AWS_BACKUP_BUCKET;
 const listed=await client.send(new ListObjectsV2Command({Bucket:bucket,Prefix:'backups/'}));
 const backup=listed.Contents?.sort((a,b)=>new Date(b.LastModified)-new Date(a.LastModified))[0];
 assert.ok(backup,'private backup exists');
 const object=await client.send(new GetObjectCommand({Bucket:bucket,Key:backup.Key}));
 fs.writeFileSync(file,zlib.gunzipSync(await object.Body.transformToByteArray()),{mode:0o600});
 sql('postgres',['-c',`CREATE DATABASE ${database} TEMPLATE template0`]);
 try{
  sql(database,['-f',file]);
  const count=Number(sql(database,['-Atc','SELECT count(*) FROM public.profiles']));
  assert.ok(count>=3,'restored profiles and data');
  console.log('PASS private S3 backup download, decompression, full database restore and restored data assertion');
 }finally{sql('postgres',['-c',`DROP DATABASE ${database}`]);fs.unlinkSync(file);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
