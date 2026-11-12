import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
    const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
    if (command === 'build') {
        const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];
        const missing = required.filter((key) => !env[key]?.trim());
        if (missing.length > 0) {
            throw new Error(`Missing required production build variables: ${missing.join(', ')}`);
        }
    }

    return {
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5000,
        open: false,
    },
    preview: {
        port: 5000,
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
                    'vendor-ui': ['lucide-react', 'date-fns'],
                    // Heavy libs loaded on-demand (lazy-loaded via React.lazy)
                    'vendor-calendar': ['react-big-calendar'],
                    'vendor-emoji': ['emoji-picker-react'],
                },
            },
        },
        chunkSizeWarningLimit: 600,
    },
    };
});
