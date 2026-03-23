// App configuration - customize your community
export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME || 'Roost',
  tagline: import.meta.env.VITE_APP_TAGLINE || 'Learn, Build, Grow Together',
  description: import.meta.env.VITE_APP_DESCRIPTION || 'A community platform for learning, building, and growing together.',
  url: import.meta.env.VITE_APP_URL || 'http://localhost:5173',
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
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
    signup: import.meta.env.VITE_ENABLE_SIGNUP !== 'false',
    stripe: !!import.meta.env.VITE_STRIPE_ENABLED,
    showcase: import.meta.env.VITE_ENABLE_SHOWCASE !== 'false',
    liveRoom: import.meta.env.VITE_ENABLE_LIVE_ROOM !== 'false',
    activations: !!import.meta.env.VITE_ENABLE_ACTIVATIONS,
    leaderboard: import.meta.env.VITE_ENABLE_LEADERBOARD !== 'false',
  },
} as const;
