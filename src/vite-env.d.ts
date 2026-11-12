/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
    readonly VITE_APP_NAME: string;
    readonly VITE_APP_URL: string;
    readonly VITE_ENABLE_MOCK_DATA: string;
    readonly VITE_DEBUG_MODE: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
