// Explicitly opt in inside a dedicated demo backend. Never run on a real community.
const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');
if (process.env.ROOST_DEMO_SEED !== 'true' || !new URL(process.env.FRONTEND_URL).hostname.includes('demo')) {
  throw new Error('Requires ROOST_DEMO_SEED=true and a dedicated demo hostname');
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const id = (label) => {
  const hex = crypto.createHash('sha256').update(`roost-demo-v1:${label}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
const checked = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};
async function put(table, rows, onConflict = 'id') {
  checked(await db.from(table).upsert(rows, { onConflict }), table);
}
async function main() {
  const existing = checked(await db.auth.admin.listUsers({ perPage: 1000 }), 'list demo users').users;
  if (existing.some((user) => !user.email?.endsWith('@roost.example'))) {
    throw new Error('Refusing to seed a database containing non-demo accounts');
  }
  const people = [
    ['demo', 'Demo Explorer', 'Curious about what a community can become. Exploring Roost with you.'],
    ['maya', 'Maya Chen', 'Designer, maker, and host of the Design Studio classroom.'],
    ['alex', 'Alex Rivera', 'Building useful things with open-source tools.'],
    ['sara', 'Sara Khan', 'Learning in public and helping others get started.'],
    ['jordan', 'Jordan Lee', 'Developer and community gardener. Small steps, shared progress.'],
  ];
  const users = {};
  for (const [username, display_name, bio] of people) {
    const email = `${username}@roost.example`;
    let user = existing.find((entry) => entry.email === email);
    if (!user) user = checked(await db.auth.admin.createUser({
      email, email_confirm: true,
      // The shared account password is intentionally public and matches the demo login UI.
      password: username === 'demo' ? 'ExploreRoost2026!' : crypto.randomBytes(32).toString('hex'),
      user_metadata: { username, display_name },
    }), `create ${username}`).user;
    users[username] = user.id;
    checked(await db.from('profiles').update({ display_name, bio, role: 'user', membership_type: 'premium', location: 'Roost demo community' }).eq('id', user.id), `profile ${username}`);
  }
  await put('site_settings', [
    { key: 'site_name', value: 'Roost Demo' },
    { key: 'site_tagline', value: 'A place to learn. A place to belong.' },
    { key: 'site_description', value: 'Explore a read-only sample community. All content and people are fictional.' },
    { key: 'feature_activations', value: 'disabled' },
    { key: 'feature_live_room', value: 'disabled' },
  ], 'key');
  const groups = [
    ['design-studio', 'Design Studio', 'Practice thoughtful interface design, share what you make, and learn from each other.', 'maya'],
    ['build-with-roost', 'Build with Roost', 'From a first idea to a working community. Explore the tools and habits that help you ship.', 'alex'],
    ['learning-lab', 'Learning Lab', 'A welcoming space for questions, small experiments, and weekly learning goals.', 'sara'],
  ];
  await put('groups', groups.map(([slug, name, description, owner]) => ({
    id: id(slug), slug, name, description, created_by: users[owner], layout_mode: 'learn',
    cover_url: `/demo/${slug}.svg`,
  })));
  await put('group_members', groups.flatMap(([slug, , , owner]) => people.map(([username]) => ({
    id: id(`${slug}:${username}`), group_id: id(slug), user_id: users[username], role: username === owner ? 'admin' : 'member',
  }))));
  const posts = [
    ['welcome', 'maya', 'Welcome to a community that feels like home', '<p>This is a sample Roost community: a shared feed, places to learn, and people bringing ideas to life.</p><p>Try the classrooms, explore member profiles, or open a conversation. This shared demo is read-only, so you can browse without changing anything.</p>', true],
    ['weekly-wins', 'alex', 'Small wins, shared progress', '<p>This week I turned a rough sketch into a working prototype. The best part was getting feedback before spending days polishing it.</p><p>What is one small thing you learned or built this week?</p>', false],
    ['design-feedback', 'sara', 'A better way to ask for feedback', '<p>Give people context: what you are trying to do, who it helps, and one specific question. Clear questions make thoughtful answers much easier.</p>', false],
    ['learning-together', 'jordan', 'Make room for the beginner questions', '<p>A good learning community makes it easy to say “I do not know yet.” A short explanation today can help the next ten people who arrive tomorrow.</p>', false],
    ['first-project', 'maya', 'From blank page to first project', '<p>Start with one useful thing. Make it work, share it early, and improve it with your community. You will find a sample learning path in the Build with Roost classroom.</p>', false],
  ];
  await put('posts', posts.map(([slug, author, title, content, is_pinned], index) => ({
    id: id(slug), author_id: users[author], title, content, is_pinned,
    created_at: new Date(Date.now() - index * 86400000).toISOString(),
  })));
  await put('comments', [
    { id: id('comment-1'), post_id: id('weekly-wins'), author_id: users.sara, content: '<p>I learned to break a big task into a small experiment. Much easier to start!</p>' },
    { id: id('comment-2'), post_id: id('weekly-wins'), author_id: users.jordan, content: '<p>Sharing early has been a great habit for me too. Progress over perfection.</p>' },
  ]);
  for (const [slug, name, , owner] of groups) {
    await put('modules', [
      { id: id(`${slug}:module-1`), group_id: id(slug), title: 'Start here', description: `Your first steps in ${name}.`, created_by: users[owner], display_order: 0 },
      { id: id(`${slug}:module-2`), group_id: id(slug), title: 'Put it into practice', description: 'Turn what you learned into a small project.', created_by: users[owner], display_order: 1 },
    ]);
    await put('recordings', [
      { id: id(`${slug}:lesson-1`), group_id: id(slug), module_id: id(`${slug}:module-1`), title: 'Welcome to your learning space', description: '<p>Lessons, progress, and discussion live together here. Sample lesson: HTML Crash Course for Absolute Beginners by Traversy Media, embedded from their public YouTube channel.</p>', video_url: 'https://www.youtube.com/watch?v=UB1O30fR-EE', video_platform: 'youtube', video_id: 'UB1O30fR-EE', published_by: users[owner], display_order: 0 },
    ]);
  }
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7); nextWeek.setHours(15, 0, 0, 0);
  await put('events', [{ id: id('community-session'), title: 'Community co-working · example event', description: 'A sample calendar event. Bring a small project, share a goal, and make progress together. This is example content, not an actual scheduled session.', start_time: nextWeek.toISOString(), end_time: new Date(nextWeek.getTime() + 3600000).toISOString(), location: 'Demo community', is_virtual: false, created_by: users.maya }]);
  await put('showcases', [{ id: id('showcase'), title: 'Roost: a place for your people', tagline: 'Conversations, classrooms, and community in one place.', description: 'An example project showcase for the open-source Roost platform. Read the code, explore the docs, and make your own community on infrastructure you control.', url: 'https://roost.msrbuilds.com', category: 'web_app', tech_stack: ['React', 'TypeScript', 'Supabase'], author_id: users.alex, status: 'approved', is_featured: true, thumbnail_url: '/demo/build-with-roost.svg' }]);
  await put('feature_requests', [{ id: id('roadmap'), title: 'A home for every learning journey', description: '<p>A sample roadmap idea: make it easier to discover the next lesson, find related discussions, and celebrate progress together.</p>', author_id: users.sara }]);
  console.log('Demo seeded: 5 fictional members, 3 classrooms, 6 modules, 3 lessons, feed, comments, event, showcase, and roadmap. Shared login has member access only.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
