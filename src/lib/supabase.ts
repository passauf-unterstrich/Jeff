import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

let client: SupabaseClient | null = null;

export function supabaseConfigured(): boolean {
	return Boolean(env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabase(): SupabaseClient {
	if (!supabaseConfigured()) throw new Error('Supabase ist noch nicht eingerichtet.');
	const url = env.PUBLIC_SUPABASE_URL!;
	const key = env.PUBLIC_SUPABASE_ANON_KEY!;
	client ??= createClient(url, key, {
		auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
	});
	return client;
}
