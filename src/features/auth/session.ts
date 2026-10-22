import { AuthError, fetchMe, refreshTokens, signOutRemote, type AuthTokens, type AuthUser } from './authApi';
import { tokenStore } from './tokenStore';

const SESSION_KEY = 'project-synq.session';

export type Session = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds when the access token expires. */
  accessExpiresAt: number;
};

function toSession(tokens: AuthTokens): Session {
  return {
    user: tokens.user,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accessExpiresAt: Date.now() + tokens.expires_in * 1000,
  };
}

export async function saveSession(tokens: AuthTokens): Promise<Session> {
  const session = toSession(tokens);
  await tokenStore.set(SESSION_KEY, JSON.stringify(session));
  return session;
}

async function loadStoredSession(): Promise<Session | null> {
  try {
    const raw = await tokenStore.get(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await tokenStore.remove(SESSION_KEY).catch(() => undefined);
}

/**
 * On app start: is someone signed in? Checks the stored session with the backend,
 * refreshing the access token when needed. If the backend can't be reached, a stored
 * session is trusted for now so the user isn't sent back to sign in while offline.
 */
export async function restoreSession(): Promise<Session | null> {
  const stored = await loadStoredSession();
  if (!stored) return null;
  try {
    if (stored.accessExpiresAt - Date.now() > 30_000) {
      const user = await fetchMe(stored.accessToken);
      return { ...stored, user };
    }
  } catch (error) {
    if (error instanceof AuthError && error.status === 0) return stored;
    if (!(error instanceof AuthError && error.status === 401)) return stored;
  }
  try {
    return await saveSession(await refreshTokens(stored.refreshToken));
  } catch (error) {
    if (error instanceof AuthError && (error.status === 0 || error.status >= 500)) return stored;
    await clearSession();
    return null;
  }
}

/** The signed-in user as last stored on this phone, or null. */
export async function getSessionUser(): Promise<AuthUser | null> {
  return (await loadStoredSession())?.user ?? null;
}

/** A valid access token for API calls, refreshed first when it is about to expire; null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const stored = await loadStoredSession();
  if (!stored) return null;
  if (stored.accessExpiresAt - Date.now() > 30_000) return stored.accessToken;
  try {
    return (await saveSession(await refreshTokens(stored.refreshToken))).accessToken;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  const stored = await loadStoredSession();
  await clearSession();
  if (stored) await signOutRemote(stored.refreshToken).catch(() => undefined);
}
