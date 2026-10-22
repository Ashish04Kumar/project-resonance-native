import { apiBaseUrl } from '@/api/config';
import { getAccessToken } from '@/features/auth/session';

import type { Intent, Photo, Vignette, Visibility, VoiceReflection } from './profileModel';

export class ProfileApiError extends Error {}

type MediaRef = { id: string; url: string };

/** The profile as the backend stores it. */
export type ProfileDto = {
  name: string;
  age: number | null;
  neighborhood: string;
  craft: string;
  bio: string;
  intent: Intent;
  voice: { title: string; media: MediaRef | null; duration_seconds: number };
  vignettes: Vignette[];
  visibility: { vibe_deck_highlights: boolean; value_pillars: boolean; call_reflections: boolean };
  photos: (MediaRef | null)[];
};

/** The profile as Edit Story works with it: photos and the recording are URIs, local or on the server. */
export type ProfileDraft = {
  name: string;
  age: string;
  neighborhood: string;
  craft: string;
  bio: string;
  intent: Intent;
  voice: VoiceReflection;
  vignettes: Vignette[];
  visibility: Visibility;
  photos: Photo[];
};

const MEDIA_PATH = '/api/v1/media/';

async function authorized(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new ProfileApiError('Please sign in again to save your profile.');
  return token;
}

async function call(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${apiBaseUrl()}${path}`, init);
  } catch {
    throw new ProfileApiError("Can't reach Resonance right now. Check your connection and try again.");
  }
}

async function failure(response: Response, fallback: string): Promise<ProfileApiError> {
  const payload = (await response.json().catch(() => ({}))) as { detail?: unknown };
  return new ProfileApiError(typeof payload.detail === 'string' ? payload.detail : fallback);
}

/** Server profile -> the shape Edit Story and Public View use (photo/voice ids become full URLs). */
export function fromDto(dto: ProfileDto): ProfileDraft {
  const base = apiBaseUrl();
  return {
    name: dto.name,
    age: dto.age ? String(dto.age) : '',
    neighborhood: dto.neighborhood,
    craft: dto.craft,
    bio: dto.bio,
    intent: dto.intent,
    voice: { title: dto.voice.title, uri: dto.voice.media ? base + dto.voice.media.url : null, durationSeconds: dto.voice.duration_seconds },
    vignettes: dto.vignettes,
    visibility: [dto.visibility.vibe_deck_highlights, dto.visibility.value_pillars, dto.visibility.call_reflections],
    photos: [0, 1, 2].map((index) => (dto.photos[index] ? base + dto.photos[index]!.url : null)),
  };
}

/** The saved profile, or null before the first save. */
export async function getProfile(): Promise<ProfileDraft | null> {
  const response = await call('/api/v1/profile', { headers: { Authorization: `Bearer ${await authorized()}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw await failure(response, "We couldn't load your profile.");
  return fromDto((await response.json()) as ProfileDto);
}

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  '3gp': 'audio/3gpp',
};

/** Upload a local photo or recording; a file already on the server is reused as it is. */
async function mediaId(uri: string | null, kind: 'photo' | 'voice', token: string): Promise<string | null> {
  if (!uri) return null;
  const onServer = uri.indexOf(MEDIA_PATH);
  if (onServer >= 0) return uri.slice(onServer + MEDIA_PATH.length);
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const file = await (await fetch(uri)).blob();
  const contentType = TYPES[extension] ?? (file.type || (kind === 'photo' ? 'image/jpeg' : 'audio/mp4'));
  const response = await call(`/api/v1/profile/media?kind=${kind}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body: file,
  });
  if (!response.ok) throw await failure(response, kind === 'photo' ? "A photo couldn't be uploaded." : "Your recording couldn't be uploaded.");
  return ((await response.json()) as MediaRef).id;
}

/** Upload any new photos and the recording, then save the whole profile. Returns it as saved. */
export async function saveProfile(draft: ProfileDraft): Promise<ProfileDraft> {
  const token = await authorized();
  const photos = await Promise.all(draft.photos.map((uri) => mediaId(uri, 'photo', token)));
  const voiceId = await mediaId(draft.voice.uri, 'voice', token);
  const age = draft.age.trim() ? Number(draft.age) : null;
  const response = await call('/api/v1/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: draft.name.trim(),
      age,
      neighborhood: draft.neighborhood,
      craft: draft.craft,
      bio: draft.bio,
      intent: draft.intent,
      voice: { title: draft.voice.title, media_id: voiceId, duration_seconds: voiceId ? draft.voice.durationSeconds : 0 },
      vignettes: draft.vignettes.filter((item) => item.title.trim() || item.body.trim()),
      visibility: { vibe_deck_highlights: draft.visibility[0], value_pillars: draft.visibility[1], call_reflections: draft.visibility[2] },
      photos,
    }),
  });
  if (response.status === 422) {
    const payload = (await response.json().catch(() => ({}))) as { detail?: unknown };
    throw new ProfileApiError(typeof payload.detail === 'string' ? payload.detail : 'Please check your details and try again.');
  }
  if (!response.ok) throw await failure(response, "We couldn't save your profile. Please try again.");
  return fromDto((await response.json()) as ProfileDto);
}

/** Ask the backend's AI to polish the introduction in the user's own voice, at about the same length. */
export async function polishBio(text: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new ProfileApiError('Sign in to use Polish tone.');
  const response = await call('/api/v1/profile/polish-bio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text }),
  });
  const payload = (await response.json().catch(() => ({}))) as { text?: string; detail?: unknown };
  if (!response.ok || !payload.text) {
    throw new ProfileApiError(typeof payload.detail === 'string' ? payload.detail : "Polish tone isn't available right now.");
  }
  return payload.text;
}
