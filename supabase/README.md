# Customer accounts with Supabase (free plan)

The site has a login page (`login.html`) and an account page (`account.html`). Customers log in with **Discord**,
**Google** or a **one-time email link**; there are no passwords on the site. Their profile and orders live in Supabase.

Free plan limits worth knowing: 50,000 monthly active users, a 500 MB database, and **a free project pauses after
7 days with no activity** (un-pause it from the dashboard; upgrade to Pro before launch if that matters).

## 1. Create the project

1. Sign up at https://supabase.com and create a new project (any name, e.g. `plus25`). Pick the region closest to
   most customers and save the database password somewhere safe (the site never needs it).
2. When it's ready, open **SQL Editor → New query**, paste all of [`schema.sql`](schema.sql) and press **Run**.
   This creates the `profiles` and `orders` tables and their security rules.

## 2. Connect the site

Open **Project Settings → API** (or **Data API**) and copy:

- **Project URL**, like `https://abcdefghijklm.supabase.co`
- **anon public** key (or the **publishable** key, `sb_publishable_…`)

Paste both into [`js/supabase.js`](../js/supabase.js). These two values are public by design.
**Never** paste the `service_role` or secret key into the site.

## 3. Allow the site's addresses

**Authentication → URL Configuration**

- **Site URL:** `https://tsamanjamil05-blip.github.io/plus25-site/`
- **Redirect URLs** (add each):
  - `https://tsamanjamil05-blip.github.io/plus25-site/account.html`
  - `http://localhost:5178/account.html` (for testing locally)

If the site later moves to its own domain, add that domain's `/account.html` too.

## 4. Turn on the login methods

**Email link** works out of the box (Authentication → Providers → Email). Supabase's built-in email sender is limited
to a few emails an hour, which is fine for testing; connect your own SMTP (Authentication → Emails → SMTP) before launch.

**Discord**

1. https://discord.com/developers/applications → **New Application** → name it `Plus 25`.
2. **OAuth2** → copy the **Client ID**, reset and copy the **Client Secret**.
3. **OAuth2 → Redirects** → add the callback URL shown in Supabase under Authentication → Providers → Discord
   (it looks like `https://<project>.supabase.co/auth/v1/callback`).
4. In Supabase, enable **Discord** and paste the Client ID and Client Secret. Save.

**Google**

1. https://console.cloud.google.com → create a project → **APIs & Services → OAuth consent screen**: External, app name
   `Plus 25`, your support email; add the scopes `email`, `profile`, `openid`.
2. **Credentials → Create credentials → OAuth client ID** → Web application. Under **Authorized redirect URIs** add the
   same Supabase callback URL as above.
3. In Supabase, enable **Google** and paste the Client ID and Client Secret. Save.
4. While the consent screen is in "Testing", only test users you add can log in; publish it before launch.

## 5. Managing customers

- **Members:** Table Editor → `profiles` → set `is_member` to true for a customer. Customers can't change this themselves.
- **Orders:** Table Editor → `orders` → Insert row with the customer's `user_id` (from `profiles.id`), `service`
  (`mmr_boost`, `replay_analysis` or `coaching`), `status`, a one-line `summary` (e.g. `Haste · 2,500 → 3,500 MMR`),
  `total_usd` and, while in progress, `progress` (0–100). It appears on the customer's account page.
  Customers can read their orders but never create or edit them.
- Later, when online checkout is built, the payment provider's webhook can create these rows automatically (a Supabase Edge Function
  using the service role key, which stays on the server).

**Never store Steam usernames or passwords in Supabase.** Collect them per order through a secure handover and delete
them when the order is done.
