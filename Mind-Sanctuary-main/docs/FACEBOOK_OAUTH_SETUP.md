# Facebook OAuth — Supabase dashboard requirements

Project: **fsterbxivhhzipfgpvou** (do not change project ref).

## 1. Meta Developer Console

1. Create or open an app at [developers.facebook.com](https://developers.facebook.com/).
2. Add product **Facebook Login** → **Settings**.
3. **Valid OAuth Redirect URIs** — add exactly:

   ```
   https://fsterbxivhhzipfgpvou.supabase.co/auth/v1/callback
   ```

4. **App Domains** (if required): `fsterbxivhhzipfgpvou.supabase.co` and your production site host (e.g. `localhost` is not valid here; use Site URL for local dev).
5. Copy **App ID** and **App Secret**.

### Permissions / scopes

The client uses Supabase’s default Facebook provider (email + public profile). In Meta:

- **Use Cases** → ensure **email** and **public_profile** are allowed for your app mode.
- For production, complete **App Review** if Meta restricts `email` for non-test users.

## 2. Supabase Dashboard → Authentication

Path: **Authentication → Providers → Facebook**

| Field | Value |
|-------|--------|
| Enable Facebook | ON |
| Facebook client ID | Meta App ID |
| Facebook secret | Meta App Secret |

## 3. URL configuration (required for Google + Facebook)

**Authentication → URL Configuration**

| Setting | Values |
|---------|--------|
| Site URL | Your production origin (e.g. `https://your-domain.com`) |
| Redirect URLs | Include every origin that loads the app, e.g. `http://localhost:8080`, `http://127.0.0.1:8080`, production URL — each must end at `/` as configured in code (`redirectTo: ${origin}/`) |

## 4. Client behavior (this repo)

- `signInWithOAuth({ provider: 'facebook', redirectTo: origin + '/' })`
- PKCE + `detectSessionInUrl` on the Supabase client
- After sign-in, `useAuthSessionGate` loads profile and sets stage `dashboard`

## 5. Verification checklist

- [ ] Facebook provider enabled in Supabase with valid App ID/secret  
- [ ] Redirect URI matches `…/auth/v1/callback`  
- [ ] Site URL + Redirect URLs include the host you test on (Vite default: port **8080**)  
- [ ] Click Facebook on login → Meta consent → return to `/` → **dashboard** (not login loop)  

## 6. Common failures

| Symptom | Likely cause |
|---------|----------------|
| Redirect URI mismatch | Meta callback URL not exactly the Supabase callback |
| Login loop | Fixed in app via session gate; ensure latest frontend deployed |
| `user_settings` / trigger error on signup | Apply migration `20260603120000_fix_handle_new_user.sql` on the project |
| Email missing on Facebook user | App not approved for `email` scope, or user denied email |
