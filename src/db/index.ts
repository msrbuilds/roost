// ============================================================
// Roost - Database Factory
// Returns the correct adapter based on configuration
// ============================================================

import type { DatabaseAdapter } from './interfaces';
import { getDatabaseConfig, type DatabaseProvider } from './config';

let _db: DatabaseAdapter | null = null;

export async function getDatabase(): Promise<DatabaseAdapter> {
  if (_db) return _db;

  const config = getDatabaseConfig();
  _db = await createAdapter(config.provider);
  return _db;
}

async function createAdapter(provider: DatabaseProvider): Promise<DatabaseAdapter> {
  switch (provider) {
    case 'supabase-cloud':
    case 'supabase-selfhosted': {
      const { SupabaseAdapter } = await import('./adapters/supabase');
      return new SupabaseAdapter();
    }
    case 'mongodb': {
      const { MongoDBAdapter } = await import('./adapters/mongodb');
      return new MongoDBAdapter();
    }
    default:
      throw new Error(`Unknown database provider: ${provider}`);
  }
}

// Convenience: synchronous access after initialization
export function db(): DatabaseAdapter {
  if (!_db) {
    throw new Error('Database not initialized. Call getDatabase() first.');
  }
  return _db;
}

// Re-export interfaces
export type { DatabaseAdapter } from './interfaces';
export * from './interfaces/types';
