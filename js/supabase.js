// Supabase: customer login and the account data (profiles, orders). See supabase/README.md for setup.
//
// Paste your project's two PUBLIC values below (Supabase dashboard → Project Settings → API):
//   SUPABASE_URL       the Project URL, like https://abcdefghijklm.supabase.co
//   SUPABASE_ANON_KEY  the "anon public" key (or the "publishable" key, sb_publishable_…)
// Both are meant to be public: what a signed-in customer can read or change is enforced by the row level security
// rules in supabase/schema.sql. Never put the service_role / secret key in this file or anywhere in the site.
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client = null;
// Loads the Supabase library only on pages that need it (login, account), then reuses one client.
export async function getSupabase() {
  if (!isConfigured) return null;
  if (!client) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm');
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    });
  }
  return client;
}

// Where login providers send the customer back to: the account page, next to whichever page is open
// (works on localhost and on GitHub Pages under /plus25-site/). Add these URLs in Supabase → Authentication →
// URL Configuration → Redirect URLs.
export const accountUrl = () => new URL('account.html', location.href).href;

// Cheap check for the nav, without loading the library: Supabase keeps the session in localStorage under
// sb-<project ref>-auth-token.
export function hasStoredSession() {
  try {
    return Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k));
  } catch {
    return false;
  }
}
