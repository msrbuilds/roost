// ============================================================
// Roost - Database Configuration
// Determines which database adapter to use
// ============================================================

export type DatabaseProvider = 'supabase-cloud' | 'supabase-selfhosted';

export interface DatabaseConfig {
  provider: DatabaseProvider;

  // Supabase (Cloud & Self-hosted)
  supabase?: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string; // Server-side only
  };

}

export function getDatabaseConfig(): DatabaseConfig {
  const provider = (import.meta.env.VITE_DB_PROVIDER || 'supabase-cloud') as DatabaseProvider;

  switch (provider) {
    case 'supabase-cloud':
    case 'supabase-selfhosted':
      return {
        provider,
        supabase: {
          url: import.meta.env.VITE_SUPABASE_URL || '',
          anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
        },
      };

    default:
      throw new Error(`Unknown database provider: ${provider}`);
  }
}

export function getAuthConfig() {
  return { provider: 'supabase' as const };
}
