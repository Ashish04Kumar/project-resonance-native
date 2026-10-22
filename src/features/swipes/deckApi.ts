import { apiBaseUrl } from '@/api/config';
import { getAccessToken } from '@/features/auth/session';
import { fromDto, type ProfileDraft, type ProfileDto } from '@/features/profile/profileApi';

/** One person in the swipe deck. */
export type DeckProfile = {
  userId: string;
  profile: ProfileDraft;
  /** I already sent this person a spark. */
  sparked: boolean;
};

export class DeckApiError extends Error {}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new DeckApiError('Please sign in again.');
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new DeckApiError("Can't reach Resonance right now. Check your connection and try again.");
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { detail?: unknown };
    throw new DeckApiError(typeof payload.detail === 'string' ? payload.detail : 'Something went wrong. Please try again.');
  }
  return response;
}

/** Everyone else with a finished profile. */
export async function getDeck(): Promise<DeckProfile[]> {
  const body = (await (await request('/api/v1/discover')).json()) as {
    profiles: { user_id: string; profile: ProfileDto; sparked: boolean }[];
  };
  return body.profiles.map((item) => ({ userId: item.user_id, profile: fromDto(item.profile), sparked: item.sparked }));
}

/** Record a spark (Send Spark). Passing isn't recorded. */
export async function sendSpark(userId: string): Promise<void> {
  await request('/api/v1/sparks', { method: 'POST', body: JSON.stringify({ to_user_id: userId }) });
}

/** Forget my sparks so the whole deck shows again. */
export async function resetSparks(): Promise<void> {
  await request('/api/v1/sparks/reset', { method: 'POST' });
}
