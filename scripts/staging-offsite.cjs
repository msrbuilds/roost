// Run inside the backend container with bucket-scoped AWS_BACKUP_* variables.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const zlib=require('node:zlib');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const {S3Client,GetObjectCommand}=require(require.resolve('@aws-sdk/client-s3',{paths:[process.cwd(),`${__dirname}/../server`]}));
if(process.env.ROOST_STAGING_TESTS!=='true')throw new Error('Staging opt-in required');
const tables=['profiles','posts','groups','activation_requests'];
const database=`roost_offsite_restore_${Date.now()}`;
const file='/tmp/roost-offsite-restore.sql';
function sql(db,args){
 const result=cp.spawnSync('psql',['-h',process.env.SUPABASE_DB_HOST,'-U',process.env.SUPABASE_DB_USER,'-d',db,'-v','ON_ERROR_STOP=1',...args],{encoding:'utf8',env:{...process.env,PGPASSWORD:process.env.SUPABASE_DB_PASSWORD}});
 if(result.status)throw new Error(result.stderr.split('\n').filter(l=>/ERROR|FATAL/.test(l)).join('\n')||'Restore SQL command failed');
 return result.stdout;
}
function counts(db){return Object.fromEntries(tables.map(table=>[table,Number(sql(db,['-Atc',`SELECT count(*) FROM public.${table}`]))]));}
async function main(){
 const before=counts('postgres');
 const {performBackup}=require('./dist/services/backup.js');
 const backup=await performBackup();
 assert.equal(backup.success,true,backup.error);
 console.log('PASS database dump uploaded to separate offsite S3 bucket');
 const client=new S3Client({region:process.env.AWS_BACKUP_REGION,endpoint:process.env.AWS_BACKUP_ENDPOINT,forcePathStyle:true,credentials:{accessKeyId:process.env.AWS_BACKUP_ACCESS_KEY_ID,secretAccessKey:process.env.AWS_BACKUP_SECRET_ACCESS_KEY}});
 const bucket=process.env.AWS_BACKUP_BUCKET;
 const anonymous=await fetch(`${process.env.AWS_BACKUP_ENDPOINT}/${bucket}/${backup.s3Key}`);
 assert.equal(anonymous.status,403,'backup object must deny anonymous reads');
 console.log('PASS anonymous offsite backup read denied');
 const object=await client.send(new GetObjectCommand({Bucket:bucket,Key:backup.s3Key}));
 const bytes=Buffer.from(await object.Body.transformToByteArray());
 assert.equal(bytes.length,object.ContentLength);
 fs.writeFileSync(file,zlib.gunzipSync(bytes),{mode:0o600});
 sql('postgres',['-c',`CREATE DATABASE ${database} TEMPLATE template0`]);
 let after;
 try{sql(database,['-f',file]);after=counts(database);assert.deepEqual(after,before);}
 finally{sql('postgres',['-c',`DROP DATABASE ${database}`]);fs.unlinkSync(file);}
 const report={result:'passed',bucket,region:process.env.AWS_BACKUP_REGION,object:backup.s3Key,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),sourceRows:before,restoredRows:after,anonymousReadStatus:anonymous.status};
 fs.writeFileSync('/tmp/roost-offsite-report.json',JSON.stringify(report,null,2),{mode:0o600});
 console.log('PASS offsite download, gzip integrity, full restore and exact row-count comparison');
 console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
