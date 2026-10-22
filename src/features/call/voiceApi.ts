import { apiBaseUrl, expoHost } from '@/api/config';
import type { CallLanguage } from './callSession';
import { getBackendCallId, setBackendCallId } from './callSession';

export type VoiceJoin = {
  call_id: string;
  livekit_url: string;
  livekit_token: string;
  assistant_text: string;
};

class VoiceApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'VoiceApiError';
  }
}

async function requestVoice(path: string, language: CallLanguage): Promise<VoiceJoin> {
  const host = expoHost();
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language_mode: language, consent: true, client_host: host }),
  });
  const payload = await response.json() as VoiceJoin | { detail?: string };
  if (!response.ok || !('livekit_token' in payload)) {
    throw new VoiceApiError('detail' in payload ? payload.detail ?? 'The call could not connect.' : 'The call could not connect.', response.status);
  }
  return payload;
}

export async function joinVoiceCall(language: CallLanguage): Promise<VoiceJoin> {
  const existingCallId = getBackendCallId();
  let result: VoiceJoin;
  if (existingCallId) {
    try {
      result = await requestVoice(`/api/v1/calls/${existingCallId}/resume`, language);
    } catch (error) {
      // A backend restart clears its in-memory calls; start a fresh call if the saved ID is stale.
      if (!(error instanceof VoiceApiError) || (error.status !== 404 && error.status !== 409)) throw error;
      setBackendCallId(null);
      result = await requestVoice('/api/v1/calls', language);
    }
  } else {
    result = await requestVoice('/api/v1/calls', language);
  }
  setBackendCallId(result.call_id);
  return result;
}

export async function closeVoiceCall() {
  const callId = getBackendCallId();
  if (!callId) return;
  try {
    await fetch(`${apiBaseUrl()}/api/v1/calls/${callId}/end`, { method: 'POST' });
  } finally {
    setBackendCallId(null);
  }
}
