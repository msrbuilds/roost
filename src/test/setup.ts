import '@testing-library/jest-dom';

// Mock environment variables
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.VITE_AWS_REGION = 'us-east-1';
process.env.VITE_AWS_BUCKET_NAME = 'test-bucket';

