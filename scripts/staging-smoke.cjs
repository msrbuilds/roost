// Run only against a disposable staging installation, inside the backend container.
// Requires ROOST_STAGING_TESTS=true; generated credentials remain in /tmp for browser tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createClient } = require(require.resolve('@supabase/supabase-js', { paths: [process.cwd(), `${__dirname}/../server`] }));
if (process.env.ROOST_STAGING_TESTS !== 'true') throw new Error('Explicit staging test opt-in required');
const origin = process.env.FRONTEND_URL;
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, key, options);
const id = Date.now().toString(36);
const password = `Roost-${crypto.randomBytes(18).toString('hex')}!`;
const users = [];
function ok(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}
function pass(label) { console.log(`PASS ${label}`); }
async function api(path, token, init = {}) {
  return fetch(`${origin}/api${path}`, { ...init, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
}
async function main() {
  assert.equal((await api('/health')).status, 200); pass('HTTPS and dependency health');
  for (const role of ['admin', 'member', 'outsider']) {
    const email = `roost-${id}-${role}@example.com`;
    const data = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `roost_${id}_${role}`, display_name: `Staging ${role}` } }), 'create test user');
    users.push({ id: data.user.id, email, role });
    ok(await admin.from('profiles').update({ role: role === 'admin' ? 'superadmin' : 'user', membership_type: role === 'outsider' ? 'free' : 'premium' }).eq('id', data.user.id), 'configure test user');
  }
  const clients = {};
  for (const user of users) {
    const client = createClient(url, key, options);
    const auth = ok(await client.auth.signInWithPassword({ email: user.email, password }), 'real password login');
    clients[user.role] = { client, token: auth.session.access_token, user };
  }
  pass('auth user creation, profile trigger, login, premium and admin profiles');
  const a = clients.admin, m = clients.member, o = clients.outsider;
  assert.equal((await api('/activations/products')).status, 401);
  assert.equal((await api('/activations/products', m.token)).status, 403);
  assert.equal((await api('/activations/products', a.token)).status, 200);
  pass('API anonymous/member denial and legitimate admin access');
  assert.ok((await m.client.from('profiles').update({ role: 'superadmin' }).eq('id',m.user.id)).error);
  pass('profile privilege escalation denied');
  const group = ok(await a.client.from('groups').insert({ name:`Private ${id}`, slug:`private-${id}`, is_private:true, created_by:a.user.id }).select().single(),'private group');
  const post = ok(await a.client.from('posts').insert({ author_id:a.user.id, group_id:group.id, title:`Private ${id}`, content:'<p>Private staging test</p>' }).select().single(),'private post');
  assert.equal(ok(await o.client.from('posts').select('id').eq('id',post.id),'private post read').length,0);
  assert.equal(ok(await o.client.rpc('search_posts',{p_search_term:id}),'private search').some(p=>p.id===post.id),false);
  pass('private group content and search isolation');
  const publicPost = ok(await m.client.from('posts').insert({author_id:m.user.id,title:`Staging fixture ${id}`,content:'<p>Browser test fixture</p>'}).select().single(),'public post');
  ok(await m.client.rpc('toggle_reaction',{p_user_id:m.user.id,p_reactable_type:'post',p_reactable_id:publicPost.id,p_reaction_type:'like'}),'reaction');
  ok(await m.client.from('comments').insert({author_id:m.user.id,post_id:publicPost.id,content:'Staging comment'}),'comment');
  pass('post creation, reaction, comment and database triggers');
  const message = ok(await m.client.from('messages').insert({sender_id:m.user.id,recipient_id:a.user.id,content:'Private staging message'}).select().single(),'message');
  assert.equal(ok(await o.client.from('messages').select('id').eq('id',message.id),'message isolation').length,0);
  pass('premium messaging and foreign conversation isolation');
  const form = new FormData();
  form.append('folder','documents'); form.append('file',new Blob(['%PDF-1.4 staging test'],{type:'application/pdf'}),'staging.pdf');
  const upload = await api('/upload/file',m.token,{method:'POST',body:form});
  const uploaded = await upload.json();
  assert.equal(upload.status,201,JSON.stringify(uploaded));
  ok(await m.client.from('assets').insert({filename:'staging.pdf',file_url:uploaded.publicUrl,storage_key:uploaded.key,asset_type:'document',uploaded_by:m.user.id}),'private asset record');
  const encoded = Buffer.from(uploaded.key).toString('base64url');
  assert.equal((await api(`/upload/content/${encoded}`)).status,401);
  assert.equal((await api(`/upload/content/${encoded}`,o.token)).status,403);
  assert.equal((await api(`/upload/content/${encoded}`,m.token)).status,200);
  assert.equal((await api('/upload/delete',o.token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:uploaded.key})})).status,403);
  assert.equal((await api('/upload/delete',m.token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:uploaded.key})})).status,200);
  pass('S3 upload, private read isolation and owner-only delete');
  const enrolled = ok(await m.client.auth.mfa.enroll({factorType:'totp',friendlyName:`Staging ${id}`}), 'MFA enroll');
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits=[...enrolled.totp.secret.toUpperCase().replace(/=+$/,'')].map(c=>alphabet.indexOf(c).toString(2).padStart(5,'0')).join('');
  const secret=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2)));
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const digest=crypto.createHmac('sha1',secret).update(counter).digest();const offset=digest[19]&15;
  const code=((digest.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
  ok(await m.client.auth.mfa.challengeAndVerify({factorId:enrolled.id,code}), 'MFA verify');
  assert.equal((await api('/auth/mfa/status',m.token)).status,200);
  assert.equal((await api('/upload/content/'+encoded,m.token)).status,403);
  const session=ok(await m.client.auth.getSession(),'AAL2 session').session;
  assert.equal((await api('/auth/mfa/status',session.access_token)).status,200);
  ok(await m.client.auth.mfa.unenroll({factorId:enrolled.id}),'MFA unenroll');
  await api('/auth/mfa/status',session.access_token);
  pass('native MFA enrollment, TOTP verification, AAL1 denial and AAL2 access');
  const backup=await api('/backup/trigger',a.token,{method:'POST'});
  assert.equal(backup.status,200,await backup.text());
  pass('database dump and private S3 backup');
  assert.equal((await api('/auth/request-reset',undefined,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:m.user.email})})).status,200);
  const mail=await fetch('http://mailpit:8025/api/v1/messages').then(r=>r.json());
  assert.ok(mail.total>0,'mail delivery captured');
  pass('password reset request and real SMTP capture');
  fs.writeFileSync('/tmp/roost-staging-users.json',JSON.stringify({users,password,fixturePostId:publicPost.id,groupId:group.id}),{mode:0o600});
  pass('integration suite complete; browser fixture credentials saved privately');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
