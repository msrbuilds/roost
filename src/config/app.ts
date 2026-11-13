const envFlag = (value: string | boolean | undefined, defaultValue = false) => {
  if (value === undefined || value === '') return defaultValue;
  return value === true || String(value).toLowerCase() === 'true' || value === '1';
};

// App configuration - customize your community
export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME || 'Roost',
  tagline: import.meta.env.VITE_APP_TAGLINE || 'Learn, Build, Grow Together',
  description: import.meta.env.VITE_APP_DESCRIPTION || 'A community platform for learning, building, and growing together.',
  url: import.meta.env.VITE_APP_URL || 'http://localhost:5000',
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  // Public, read-only demonstration credentials. Never use this account on a real community.
  demo: {
    enabled: envFlag(import.meta.env.VITE_DEMO_MODE),
    email: 'demo@roost.example',
    password: 'ExploreRoost2026!',
  },
  logo: {
    square: '/logo-square-sm.png',
    wide: '/logo-wide.png',
    favicon: '/favicon.ico',
  },
  support: {
    email: import.meta.env.VITE_SUPPORT_EMAIL || '',
    website: import.meta.env.VITE_SUPPORT_URL || '',
  },
  features: {
    signup: envFlag(import.meta.env.VITE_ENABLE_SIGNUP, true),
    stripe: envFlag(import.meta.env.VITE_STRIPE_ENABLED),
    showcase: envFlag(import.meta.env.VITE_ENABLE_SHOWCASE, true),
    liveRoom: envFlag(import.meta.env.VITE_ENABLE_LIVE_ROOM, true),
    activations: envFlag(import.meta.env.VITE_ENABLE_ACTIVATIONS),
    leaderboard: envFlag(import.meta.env.VITE_ENABLE_LEADERBOARD, true),
  },
} as const;
