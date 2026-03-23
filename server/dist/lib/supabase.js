"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('Missing Supabase environment variables');
}
// Admin client with secret key for privileged server-side operations
exports.supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseSecretKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
    global: {
        fetch: (url, options = {}) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15_000); // 15s timeout
            return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
        },
    },
});
//# sourceMappingURL=supabase.js.map