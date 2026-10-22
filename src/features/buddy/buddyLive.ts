import { AudioSession } from '@livekit/react-native';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { apiBaseUrl, expoHost } from '@/api/config';
import { getAccessToken } from '@/features/auth/session';

/**
 * Live voice chat with Buddy. POST /api/v1/buddy/live starts Buddy's voice agent on the
 * backend (Pod 4's voice pipeline with the companion as the brain, see backend/app/buddy_voice.py)
 * and returns a LiveKit room to join, like the call screen does.
 */
export type BuddyLiveJoin = { room: string; livekit_url: string; livekit_token: string };

async function post(path: string, body?: object): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error('Please sign in again.');
  return fetch(`${apiBaseUrl()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Start/stop the live chat. It stops by itself when `active` turns false (tab or app left). */
export function useBuddyLive(active: boolean) {
  const [join, setJoin] = useState<BuddyLiveJoin | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = useRef(false);

  const stop = useCallback(async () => {
    const wasOn = on.current;
    on.current = false;
    setJoin(null);
    setStarting(false);
    if (!wasOn) return;
    void AudioSession.stopAudioSession();
    await post('/api/v1/buddy/live/end').catch(() => undefined);
  }, []);

  const start = useCallback(async () => {
    if (on.current) return;
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('Allow microphone access so Buddy can hear you.');
      return;
    }
    on.current = true;
    setStarting(true);
    try {
      await AudioSession.startAudioSession();
      await AudioSession.selectAudioOutput(Platform.OS === 'ios' ? 'force_speaker' : 'speaker').catch(() => undefined);
      let response: Response;
      try {
        response = await post('/api/v1/buddy/live', { client_host: expoHost() });
      } catch {
        throw new Error("Can't reach Buddy right now. Check your connection and try again.");
      }
      const payload = (await response.json().catch(() => ({}))) as Partial<BuddyLiveJoin> & { detail?: unknown };
      if (!response.ok || !payload.livekit_token || !payload.livekit_url || !payload.room) {
        throw new Error(typeof payload.detail === 'string' ? payload.detail : 'Buddy’s voice couldn’t start. Please try again.');
      }
      // The user may have stopped (or left the tab) while this was starting.
      if (on.current) setJoin({ room: payload.room, livekit_url: payload.livekit_url, livekit_token: payload.livekit_token });
      else await post('/api/v1/buddy/live/end').catch(() => undefined);
    } catch (reason) {
      console.warn('Buddy live could not start:', reason);
      setError(reason instanceof Error ? reason.message : 'Buddy’s voice couldn’t start.');
      await stop();
    } finally {
      setStarting(false);
    }
  }, [stop]);

  // Leaving the tab or the app ends the live chat; so does leaving the screen.
  useEffect(() => {
    if (!active && on.current) void stop();
  }, [active, stop]);
  useEffect(() => () => void stop(), [stop]);

  return { join, starting, live: join !== null, error, start, stop, fail: setError };
}
