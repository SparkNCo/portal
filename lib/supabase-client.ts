import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_APIKEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// "next dev" loads .env.development on top of .env, so this is "portaldev" locally
// and falls back to "portal" for "next build"/"next start" (e.g. the Vercel deploy).
export const PORTAL_SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA ?? 'portal';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
