import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const demoEmails = ['demo', 'maya', 'alex', 'sara', 'jordan'].map(name => `${name}@roost.example`);

export function demoMaintenanceEnabled(env: NodeJS.ProcessEnv): boolean {
  if (env.ROOST_DEMO_MODE !== 'true') return false;
  try {
    return new URL(env.FRONTEND_URL || '').hostname.split('.').some(label => label === 'demo' || label.endsWith('-demo'));
  } catch {
    return false;
  }
}

// The stable event identifier is shared with scripts/seed-demo.cjs.
const hex = createHash('sha256').update('roost-demo-v1:community-session').digest('hex');
const eventId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;

export async function refreshDemoDates(db: SupabaseClient, env: NodeJS.ProcessEnv, now = new Date()): Promise<void> {
  if (!demoMaintenanceEnabled(env)) return;
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const users = data.users;
  if (users.length !== demoEmails.length || new Set(users.map(user => user.email)).size !== demoEmails.length
      || users.some(user => !demoEmails.includes(user.email || ''))) {
    throw new Error('Demo date refresh requires exactly the five fictional seeded accounts');
  }

  // Only refresh timestamps: no accounts, content, permissions, or totals change.
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(15, 0, 0, 0);
  const event = await db.from('events').update({
    start_time: start.toISOString(),
    end_time: new Date(start.getTime() + 3600000).toISOString(),
  }).eq('id', eventId);
  if (event.error) throw event.error;

  const activity = await db.from('point_activities').update({ created_at: now.toISOString() }).in('user_id', users.map(user => user.id));
  if (activity.error) throw activity.error;
}

export function startDemoMaintenance(db: SupabaseClient, env: NodeJS.ProcessEnv): () => void {
  if (!demoMaintenanceEnabled(env)) return () => {};
  let running = false;
  const refresh = async () => {
    if (running) return;
    running = true;
    try {
      await refreshDemoDates(db, env);
      console.log('[Demo] Sample calendar and activity dates refreshed');
    } catch (error) {
      console.error('[Demo] Date refresh skipped:', error instanceof Error ? error.message : 'Database request failed');
    } finally {
      running = false;
    }
  };
  void refresh();
  const timer = setInterval(() => void refresh(), 6 * 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
