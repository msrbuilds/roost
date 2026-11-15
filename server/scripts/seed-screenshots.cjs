// Fictional fixtures for a loopback-only, writable documentation installation.
const { createClient } = require('@supabase/supabase-js');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const crypto = require('node:crypto');

const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
const origin = new URL(process.env.FRONTEND_URL || 'http://invalid.example');
const database = new URL(process.env.SUPABASE_URL || 'http://invalid.example');
if (process.env.ROOST_SCREENSHOT_SEED !== 'true' || !localHosts.has(origin.hostname)
    || !new Set(['kong', ...localHosts]).has(database.hostname)) {
  throw new Error('Screenshot fixtures require explicit opt-in and an isolated local installation.');
}
if (!process.env.LOCAL_ADMIN_PASSWORD || process.env.LOCAL_ADMIN_PASSWORD.length < 20) {
  throw new Error('Set a strong LOCAL_ADMIN_PASSWORD in the ignored local environment.');
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
function checked(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}
const id = label => {
  const value = crypto.createHash('sha256').update(`roost-demo-v1:${label}`).digest('hex');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-a${value.slice(17, 20)}-${value.slice(20, 32)}`;
};
const put = async (table, rows, onConflict = 'id') => checked(await db.from(table).upsert(rows, { onConflict }), table);

async function main() {
  const existing = checked(await db.auth.admin.listUsers({ perPage: 1000 }), 'inspect local users').users;
  if (existing.length >= 1000 || existing.some(user => !user.email?.endsWith('@roost.example'))) {
    throw new Error('Refusing to change a database containing non-fixture accounts.');
  }

  // Reuse the maintained community fixture only after the stricter local guard.
  const base = spawnSync(process.execPath, [join(__dirname, 'seed-demo.cjs')], {
    env: { ...process.env, ROOST_DEMO_SEED: 'true', FRONTEND_URL: 'http://demo.localhost' },
    stdio: 'inherit',
  });
  if (base.status !== 0) throw new Error('Base sample-community seed failed.');

  const accounts = checked(await db.auth.admin.listUsers({ perPage: 1000 }), 'list fixture accounts').users;
  const member = email => accounts.find(user => user.email === `${email}@roost.example`);
  let owner = member('owner');
  if (!owner) {
    owner = checked(await db.auth.admin.createUser({
      email: 'owner@roost.example', password: process.env.LOCAL_ADMIN_PASSWORD, email_confirm: true,
      user_metadata: { username: 'owner', display_name: 'Alex Morgan' },
    }), 'create local owner').user;
  }
  await put('profiles', [{ id: owner.id, username: 'owner', display_name: 'Alex Morgan', role: 'superadmin',
    membership_type: 'premium', bio: 'Community host, educator, and builder.', location: 'Roost community' }]);
  checked(await db.from('profiles').update({ role: 'admin' }).eq('id', member('maya').id), 'sample admin');
  checked(await db.from('profiles').update({ role: 'moderator' }).eq('id', member('sara').id), 'sample moderator');
  checked(await db.from('profiles').update({ membership_type: 'free' }).eq('id', member('jordan').id), 'sample free membership');
  checked(await db.auth.admin.updateUserById(member('demo').id, { user_metadata: { username: 'jamie', display_name: 'Jamie Carter' } }), 'sample member metadata');
  checked(await db.from('profiles').update({ username: 'jamie', display_name: 'Jamie Carter',
    bio: 'Learning in public and building my first community project.', location: 'Roost community' }).eq('id', member('demo').id), 'sample member profile');

  await put('site_settings', [
    { key: 'site_name', value: 'Roost' },
    { key: 'site_tagline', value: 'A place to learn. A place to belong.' },
    { key: 'site_description', value: 'A community for learning, building, and growing together.' },
    { key: 'support_email', value: 'hello@roost.example' },
    ...['live_room', 'activations', 'roadmap', 'showcase'].map(feature => ({ key: `feature_${feature}`, value: 'all' })),
  ], 'key');
  await put('group_members', ['design-studio', 'build-with-roost', 'learning-lab'].map(slug => ({
    id: id(`${slug}:owner`), group_id: id(slug), user_id: owner.id, role: 'admin',
  })), 'group_id,user_id');
  await put('posts', [{ id: id('welcome'), author_id: member('maya').id,
    title: 'Welcome to a community that feels like home', is_pinned: true,
    content: '<p>Bring your ideas, questions, and small wins. This is a space to learn, build, and grow together.</p><p>Share something you are working on, join a classroom, or meet another member. Your next conversation could be the start of something good.</p>' }]);
  const conversationStart = Date.now() - 86400000;
  await put('messages', [
    { id: id('message-1'), sender_id: member('maya').id, recipient_id: member('demo').id,
      content: 'Welcome to Roost! The Build with Roost classroom is a great place to begin. Happy to help you find your way around.', created_at: new Date(conversationStart).toISOString() },
    { id: id('message-2'), sender_id: member('demo').id, recipient_id: member('maya').id,
      content: 'Thanks, Maya! I am working on my first community project and looking forward to learning with everyone.', created_at: new Date(conversationStart + 3600000).toISOString() },
  ]);
  await put('categories', [
    ['Introductions', 'introductions', '#0ea5e9'], ['Questions', 'questions', '#8b5cf6'],
    ['Share your work', 'share-your-work', '#10b981'], ['Learning resources', 'learning-resources', '#f59e0b'],
  ].map(([name, slug, color], index) => ({ name, slug, color, display_order: index + 1, is_active: true })), 'slug');
  await put('announcements', [{ id: id('local-announcement'), title: 'Welcome to your community',
    content: 'Introduce yourself, explore the classrooms, and share what you are building this week.', type: 'info',
    scope: 'global', is_active: false, created_by: owner.id }]);
  await put('showcases', [{ id: id('local-pending-project'), title: 'Learning journal',
    tagline: 'A small place to reflect on what you learn each week.',
    description: 'A sample member project that brings weekly learning notes, useful resources, and small achievements together in a personal journal.',
    url: 'https://example.com/learning-journal', category: 'web_app', tech_stack: ['React', 'TypeScript'],
    author_id: member('jordan').id, status: 'pending', thumbnail_url: '/demo/learning-lab.svg' }]);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 3); tomorrow.setHours(15, 0, 0, 0);
  await put('events', [{ id: id('community-session'), title: 'Community co-working',
    description: 'Bring a small project, share one goal, and spend an hour making progress together. All experience levels are welcome.',
    start_time: tomorrow.toISOString(), end_time: new Date(tomorrow.getTime() + 3600000).toISOString(),
    location: 'Community lounge', is_virtual: false, created_by: member('maya').id }]);
  await put('activation_products', [{ id: id('local-starter-kit'), name: 'Community Starter Kit', slug: 'community-starter-kit',
    description: 'An example member resource for learning how activation requests are managed.', product_type: 'plugin',
    monthly_limit: 2, is_active: true, instructions: 'Submit your site details for the community administrator to review.' }]);
  await put('activation_requests', [{ id: id('local-activation'), user_id: member('demo').id,
    product_id: id('local-starter-kit'), website_url: 'https://example.com', wp_username: 'example-editor',
    status: 'pending', notes: 'Sample request for the documentation installation. No real site credentials are stored.' }]);
  await put('live_sessions', [{ id: id('local-workshop'), title: 'Weekly community workshop',
    description: 'Bring a question, share progress, and learn with the community.',
    youtube_embed_url: 'https://www.youtube.com/embed/UB1O30fR-EE', scheduled_at: tomorrow.toISOString(),
    status: 'idle', visibility: 'unlisted', created_by: owner.id }]);
  console.log('Local writable sample community ready. Owner: owner@roost.example; password stays in the ignored local environment.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
