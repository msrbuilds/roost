import '@testing-library/jest-dom';

// Mock environment variables without requiring Node globals in the browser tsconfig.
Object.assign(globalThis, {
  process: {
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-anon-key',
    },
  },
});

