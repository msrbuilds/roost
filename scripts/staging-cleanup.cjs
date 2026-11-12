const fs=require('node:fs');
const {createClient}=require(require.resolve('@supabase/supabase-js',{paths:[process.cwd(),`${__dirname}/../server`]}));
if(process.env.ROOST_STAGING_TESTS!=='true')throw new Error('Staging opt-in required');
async function main(){
 const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const fixtures=JSON.parse(fs.readFileSync('/tmp/roost-staging-users.json','utf8'));
 for(const user of fixtures.users){
  if(!/^roost-[a-z0-9]+-(admin|member|outsider)@example\.com$/.test(user.email))throw new Error('Unexpected cleanup account');
  const existing=await client.auth.admin.getUserById(user.id);
  if(existing.error||existing.data.user.email!==user.email)throw new Error('Cleanup account identity mismatch');
  const removed=await client.auth.admin.deleteUser(user.id);
  if(removed.error)throw new Error(removed.error.message);
 }
 const list=await client.auth.admin.listUsers({perPage:100});
 if(list.error)throw new Error(list.error.message);
 for(const user of list.data.users){
  if(user.user_metadata?.display_name==='Email delivery check'&&user.user_metadata?.username?.startsWith('email_check_')){
   const result=await client.auth.admin.deleteUser(user.id);
   if(result.error)throw new Error(result.error.message);
  }
 }
 console.log('Removed only marked staging test accounts and their dependent content; owner retained');
 fs.unlinkSync('/tmp/roost-staging-users.json');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
