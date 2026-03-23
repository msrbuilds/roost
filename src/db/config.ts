// ============================================================
// Roost - Database Configuration
// Determines which database adapter to use
// ============================================================

export type DatabaseProvider = 'supabase-cloud' | 'supabase-selfhosted' | 'mongodb';

export interface DatabaseConfig {
  provider: DatabaseProvider;

  // Supabase (Cloud & Self-hosted)
  supabase?: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string; // Server-side only
  };

  // MongoDB
  mongodb?: {
    url: string; // mongodb://... or mongodb+srv://...
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

    case 'mongodb':
      return {
        provider,
        mongodb: {
          url: import.meta.env.VITE_DATABASE_URL || '',
        },
      };

    default:
      throw new Error(`Unknown database provider: ${provider}`);
  }
}

export function getAuthConfig() {
  const provider = (import.meta.env.VITE_DB_PROVIDER || 'supabase-cloud') as DatabaseProvider;

  // Supabase uses its own auth, MongoDB uses local JWT auth
  if (provider === 'supabase-cloud' || provider === 'supabase-selfhosted') {
    return { provider: 'supabase' as const };
  }
  return { provider: 'local' as const };
}
