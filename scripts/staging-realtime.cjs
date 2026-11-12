const fs=require('node:fs');
const assert=require('node:assert/strict');
const {createClient}=require(require.resolve('@supabase/supabase-js',{paths:[process.cwd(),`${__dirname}/../server`]}));
if(process.env.ROOST_STAGING_TESTS!=='true')throw new Error('Staging opt-in required');
async function main(){
  const fixtures=JSON.parse(fs.readFileSync('/tmp/roost-staging-users.json','utf8'));
  const user=fixtures.users.find(u=>u.role==='member');
  const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await client.auth.signInWithPassword({email:user.email,password:fixtures.password});
  assert.equal(login.error,null,login.error?.message);
  let received;
  const title=`Realtime staging regression ${Date.now()}`;
  const event=new Promise(resolve=>{received=resolve});
  const channel=client.channel(`staging-check-${Date.now()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'posts',filter:`author_id=eq.${user.id}`},payload=>{if(payload.new.title===title)received(payload);});
  try{
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Realtime subscription timed out')),20000);
      channel.subscribe((status,error)=>{
        if(status==='SUBSCRIBED'){clearTimeout(timer);resolve();}
        if(status==='CHANNEL_ERROR'){clearTimeout(timer);reject(error||new Error(status));}
      });
    });
    console.log('PASS authenticated WebSocket subscription');
    const post=await client.from('posts').insert({author_id:user.id,title,content:'<p>Realtime regression</p>'}).select().single();
    assert.equal(post.error,null,post.error?.message);
    let timer;
    const update=await Promise.race([event,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Postgres change was not delivered')),20000)})]).finally(()=>clearTimeout(timer));
    assert.equal(update.new.id,post.data.id);
    console.log('PASS Postgres INSERT delivered over authenticated Realtime');
  } finally{await client.removeChannel(channel);}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
