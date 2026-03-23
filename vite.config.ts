import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5000,
        open: true,
    },
    build: {
        outDir: 'dist',
        sourcemap: process.env.SOURCEMAP === 'true',
        rollupOptions: {
            output: {
                manualChunks: {
                    // Vendor chunks - split large dependencies
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-supabase': ['@supabase/supabase-js'],
                    'vendor-aws': ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
                    'vendor-ui': ['lucide-react', 'date-fns'],
                    // Heavy libs loaded on-demand (lazy-loaded via React.lazy)
                    'vendor-calendar': ['react-big-calendar'],
                    'vendor-editor': ['react-quill-new'],
                    'vendor-emoji': ['emoji-picker-react'],
                },
            },
        },
        chunkSizeWarningLimit: 600,
    },
});
