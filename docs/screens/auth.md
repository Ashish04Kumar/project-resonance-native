# Loader, sign-in and sign-up

No Figma frame was supplied for these screens; they follow the Welcome & Prologue palette and fonts (`src/theme/brand.ts`).

## Flow

```
App opens → Loader (/) ─ signed in ──────────────────────────────→ Language & Cadence (/language-cadence)
                       └ not signed in → Welcome (/welcome) ─ Get started → Auth, Create account ─┐
                                                            └ Sign in     → Auth, Sign in ────────┴→ Language & Cadence
```

- **Loader** (`src/features/auth/LoaderScreen.tsx`, `InfinityLoader.tsx`): the Resonance loop emblem drawn by Skia; a wine stroke draws the loop and erases it, forever, over a faint track, with the wordmark and tagline below. It shows for at least 1.4 s while it restores the session.
- **Session restore** (`session.ts`): reads the stored tokens, checks them with `/me`, refreshes when the access token is old, and signs out on a rejected refresh. If the backend can't be reached, a stored session is trusted so the user isn't sent to sign in while offline.
- **Auth** (`AuthScreen.tsx`, route `/auth?mode=signin|signup`):
  - "Continue with Google" button (UI only; it shows a "coming soon" note).
  - Sign in / Create account toggle; name only for sign-up.
  - Email and password with show/hide, inline validation, server errors in plain words.
  - A loading state on the button; an existing email on sign-up switches to Sign in.
- **Language & Cadence** is unchanged.

## Backend

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/signup` | `name, email, password` | 201 user + tokens; 409 if the email exists |
| POST | `/api/v1/auth/login` | `email, password` | 200 user + tokens; 401 wrong details; 429 after 5 wrong tries in 15 min |
| POST | `/api/v1/auth/refresh` | `refresh_token` | 200 new tokens (old refresh token stops working) |
| POST | `/api/v1/auth/logout` | `refresh_token` | 204 |
| GET | `/api/v1/auth/me` | `Authorization: Bearer` | the signed-in user |
| POST | `/api/v1/auth/google` | | 501 until Google sign-in is integrated |

- Postgres tables `users` and `auth_sessions` (`../resonance-backend/app/migrations/001_auth.sql`) are created at backend start.
- Passwords are hashed with Argon2. Access tokens are JWTs that last 15 minutes. Refresh tokens last 30 days and are stored only as a hash, one per device.
- Settings in `../resonance-backend/.env`: `DATABASE_URL`, `AUTH_JWT_SECRET` (generated), `AUTH_ACCESS_TOKEN_MINUTES`, `AUTH_REFRESH_TOKEN_DAYS`.

## Set up once

```bash
sudo -u postgres createdb -O bs synq && sudo -u postgres createdb -O bs synq_test
```

Restart the backend afterwards. Tests: `cd backend && .venv/bin/python -m unittest test_auth`.

## Phone notes

- Tokens are kept in `expo-secure-store` (encrypted). It has native code: until a new development build is installed, the app keeps tokens in AsyncStorage and logs a warning.
- The phone talks to the backend over plain HTTP on the local network. Production must use HTTPS.
- `assets/icons/google-g.svg` is a placeholder; replace it with the official Google "G" (same file name).
