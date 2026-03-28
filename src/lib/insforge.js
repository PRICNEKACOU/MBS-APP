import { createClient } from '@insforge/sdk';

const supabaseUrl = import.meta.env.VITE_INSFORGE_URL;
const supabaseAnonKey = import.meta.env.VITE_INSFORGE_ANON_KEY;

export const insforge = createClient({
  baseUrl: supabaseUrl,
  anonKey: supabaseAnonKey
});
