const { test } = require('node:test');
const assert = require('node:assert/strict');
const { demoMaintenanceEnabled, refreshDemoDates, startDemoMaintenance } = require('../dist/services/demo-maintenance.js');

const env = { ROOST_DEMO_MODE: 'true', FRONTEND_URL: 'https://roost-demo.msrbuilds.com' };
const people = ['demo', 'maya', 'alex', 'sara', 'jordan'].map((name, index) => ({ id: `user-${index}`, email: `${name}@roost.example` }));
function database(users = people, eventError = null) {
  const writes = [];
  let listCalls = 0;
  const db = {
    auth: { admin: { listUsers: async () => { listCalls++; return { data: { users }, error: null }; } } },
    from: table => ({ update: values => {
      const write = { table, values, filter: [] }; writes.push(write);
      return {
        eq: async (...filter) => { write.filter = filter; return { error: eventError }; },
        in: async (...filter) => { write.filter = filter; return { error: null }; },
      };
    } }),
  };
  return { db, writes, get listCalls() { return listCalls; } };
}

test('does nothing without an explicit dedicated demo configuration', async () => {
  for (const settings of [{}, { ...env, ROOST_DEMO_MODE: 'false' }, { ...env, FRONTEND_URL: 'https://community.example.com' }]) {
    const fake = database();
    assert.equal(demoMaintenanceEnabled(settings), false);
    await refreshDemoDates(fake.db, settings);
    startDemoMaintenance(fake.db, settings)();
    assert.equal(fake.listCalls, 0);
    assert.deepEqual(fake.writes, []);
  }
});

test('refuses databases that do not contain exactly the seeded accounts', async () => {
  for (const users of [
    [...people, { id: 'real', email: 'owner@example.com' }], people.slice(1),
    people.map((user, index) => index === 0 ? { ...user, email: 'owner@roost.example' } : user),
    people.map((user, index) => index === 0 ? { ...user, email: people[1].email } : user),
  ]) {
    const fake = database(users);
    await assert.rejects(refreshDemoDates(fake.db, env), /five fictional seeded accounts/);
    assert.deepEqual(fake.writes, []);
  }
});

test('rolls the example event across year boundaries and changes only sample timestamps', async () => {
  const fake = database();
  const now = new Date('2026-12-31T23:59:00Z');
  await refreshDemoDates(fake.db, env, now);
  assert.equal(fake.writes.length, 2);
  assert.equal(fake.writes[0].table, 'events');
  assert.deepEqual(fake.writes[0].values, { start_time: '2027-01-01T15:00:00.000Z', end_time: '2027-01-01T16:00:00.000Z' });
  assert.equal(fake.writes[0].filter[0], 'id');
  assert.match(fake.writes[0].filter[1], /^[a-f0-9-]{36}$/);
  assert.deepEqual(fake.writes[1], { table: 'point_activities', values: { created_at: now.toISOString() }, filter: ['user_id', people.map(user => user.id)] });
});

test('stops on a failed event update instead of silently reporting success', async () => {
  const fake = database(people, new Error('Update refused'));
  await assert.rejects(refreshDemoDates(fake.db, env), /Update refused/);
  assert.equal(fake.writes.length, 1);
});
