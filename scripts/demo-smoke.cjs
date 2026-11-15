// Safe to repeat against the public read-only demo. Uses only its public member login.
const assert = require('node:assert/strict');
const origin = process.env.DEMO_URL;
const anon = process.env.DEMO_ANON_KEY;
if (!origin || !anon || !new URL(origin).hostname.includes('demo')) throw new Error('Set DEMO_URL and DEMO_ANON_KEY for a dedicated demo');
async function main() {
  const request = (path, options = {}) => fetch(`${origin}${path}`, options);
  assert.equal((await request('/api/health')).status, 200, 'dependency health');
  const login = await request('/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@roost.example', password: 'ExploreRoost2026!' }) });
  assert.equal(login.status, 200, 'shared member login');
  const session = await login.json();
  const headers = { apikey: anon, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
  const read = (path) => request(path, { headers });
  const write = (path, method = 'POST', body = {}) => request(path, { method, headers, body: JSON.stringify(body) });
  const profile = await read(`/rest/v1/profiles?id=eq.${session.user.id}&select=id,role,membership_type`).then((response) => response.json());
  assert.equal(profile[0].role, 'user', 'demo never receives an admin role');
  assert.equal((await read('/rest/v1/posts?select=id&limit=1')).status, 200, 'feed readable');
  assert.equal((await read('/rest/v1/groups?select=id&limit=1')).status, 200, 'classrooms readable');
  assert.equal((await write('/rest/v1/rpc/has_premium_access', 'POST', { p_user_id: session.user.id })).status, 200, 'read-only RPC allowed');
  assert.equal((await write('/rest/v1/rpc/get_leaderboard_for_period', 'POST', { p_group_id: null, p_period_start: '2000-01-01T00:00:00Z', p_limit: 5, p_offset: 0 })).status, 200, 'read-only period leaderboard RPC allowed');
  const futureRanking = await write('/rest/v1/rpc/get_leaderboard_for_period', 'POST', { p_group_id: null, p_period_start: '2100-01-01T00:00:00Z', p_limit: 5, p_offset: 0 });
  assert.equal(futureRanking.status, 200, 'period leaderboard accepts a date filter');
  assert.deepEqual(await futureRanking.json(), [], 'period filter excludes old activities');
  const blocked = [
    ['/auth/v1/signup', 'POST', { email: 'not-created@roost.example', password: 'ShouldNotBeCreated2026!' }],
    ['/auth/v1/user', 'PUT', { password: 'MustNeverBeApplied2026!' }],
    ['/auth/v1/factors', 'POST', { factor_type: 'totp' }],
    ['/api/auth/request-reset', 'POST', { email: 'demo@roost.example' }],
    ['/api/auth/delete-account', 'DELETE', {}],
    ['/rest/v1/profiles', 'PATCH', { role: 'superadmin' }],
    ['/rest/v1/posts', 'POST', { author_id: session.user.id, content: 'Must never be created' }],
    ['/rest/v1/posts', 'DELETE', {}],
    ['/rest/v1/rpc/toggle_reaction', 'POST', {}],
    ['/api/upload/file', 'POST', {}],
    ['/api/backup/trigger', 'POST', {}],
    ['/api/stripe/create-checkout-session', 'POST', {}],
    ['/storage/v1/object/demo/test', 'POST', {}],
  ];
  for (const [path, method, body] of blocked) assert.equal((await write(path, method, body)).status, 403, `${method} ${path} blocked`);
  assert.equal((await read('/rest/v1/rpc/toggle_reaction')).status, 403, 'unsafe GET RPC blocked');
  assert.equal((await read('/api/activations/products')).status, 403, 'admin API denied');
  const refreshed = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }) });
  assert.equal(refreshed.status, 200, 'session refresh');
  const refreshedSession = await refreshed.json();
  const secondLogin = await request('/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@roost.example', password: 'ExploreRoost2026!' }) });
  assert.equal(secondLogin.status, 200, 'second visitor login');
  const secondSession = await secondLogin.json();
  const logout = await request('/auth/v1/logout?scope=local', { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${secondSession.access_token}` } });
  assert.equal(logout.status, 204, 'sign out only this visitor');
  const otherVisitor = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshedSession.refresh_token }) });
  assert.equal(otherVisitor.status, 200, 'other visitor remains signed in');
  console.log('PASS demo health, login, member role, feed, classrooms, read RPC, period rankings, 15 mutation/admin denials, session refresh, and isolated visitor sign-out');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
