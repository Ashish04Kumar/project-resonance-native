import { fetch } from 'expo/fetch';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiBaseUrl } from '@/api/config';
import { getAccessToken } from '@/features/auth/session';

import { moodFromTag, type Mood } from './robot/robotState';

/**
 * Buddy text chat: POST /api/v1/buddy/chat streams the reply back as JSON lines
 * (see backend/app/buddy.py). `expo/fetch` is Expo's own fetch, which can read a
 * response while it is still arriving (React Native's built-in fetch cannot).
 */

export type ChatMessage = { id: string; from: 'me' | 'buddy'; text: string; failed?: boolean };

/** chat (shown as "Buddy"): only talks and reads memory. synth (shown as "Umbrella"): every companion tool. Separate threads. */
export type BuddyMode = 'chat' | 'synth';

type StreamEvent =
  | { type: 'mode'; mode: BuddyMode }
  | { type: 'delta'; text: string }
  | { type: 'expression'; expression: string }
  | { type: 'done'; text: string; expression: string }
  | { type: 'error'; message: string };

/** Splits received text into whole lines; the unfinished last line is kept for the next chunk. */
export function takeLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split('\n');
  const rest = parts.pop() ?? '';
  return { lines: parts.filter((line) => line.trim() !== ''), rest };
}

class BuddyChatError extends Error {}

/** Read or change this account's Buddy mode on the backend (GET/POST /api/v1/buddy/mode). */
async function modeRequest(mode?: BuddyMode): Promise<BuddyMode | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const response = await fetch(`${apiBaseUrl()}/api/v1/buddy/mode`, {
      method: mode ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: mode ? JSON.stringify({ mode }) : undefined,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { mode?: BuddyMode };
    return payload.mode === 'synth' ? 'synth' : 'chat';
  } catch {
    return null;
  }
}

async function streamReply(text: string, onEvent: (event: StreamEvent) => void, signal: AbortSignal): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new BuddyChatError('Please sign in again.');
  let response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/v1/buddy/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new BuddyChatError("Can't reach Buddy right now. Check your connection and try again.");
  }
  if (!response.ok || !response.body) throw new BuddyChatError('Buddy couldn’t reply right now. Please try again.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { lines, rest } = takeLines(buffer);
    buffer = rest;
    for (const line of lines) onEvent(JSON.parse(line) as StreamEvent);
  }
}

let nextId = 0;
const newId = () => `m${Date.now()}-${nextId++}`;

/** How long the reply's mood stays on Buddy's face after the reply ends. */
const MOOD_SECONDS = 8;

/**
 * Chat state for the Buddy tab. Only this visit's messages are shown; the companion
 * keeps the whole conversation on the backend.
 * - waiting: sent, nothing back yet (robot thinks)
 * - streaming: reply text is arriving (robot talks)
 * - mood: the last reply's mood, cleared after MOOD_SECONDS
 */
export function useBuddyChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [mood, setMood] = useState<Mood | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setModeState] = useState<BuddyMode>('chat');
  const abort = useRef<AbortController | null>(null);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      abort.current?.abort();
      if (moodTimer.current) clearTimeout(moodTimer.current);
    },
    [],
  );

  // The backend keeps the mode; read it when the tab opens.
  useEffect(() => {
    let active = true;
    void modeRequest().then((saved) => {
      if (active && saved) setModeState(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  /** The Chat / Synth toggle: show it at once, then save it on the backend. */
  const setMode = useCallback((next: BuddyMode) => {
    setModeState(next);
    void modeRequest(next).then((saved) => {
      if (saved) setModeState(saved);
    });
  }, []);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || abort.current) return;
    const replyId = newId();
    const setReply = (update: (message: ChatMessage) => ChatMessage) =>
      setMessages((list) => list.map((message) => (message.id === replyId ? update(message) : message)));

    setMessages((list) => [...list, { id: newId(), from: 'me', text }, { id: replyId, from: 'buddy', text: '' }]);
    setWaiting(true);
    setFailed(false);
    setMood(null);
    if (moodTimer.current) clearTimeout(moodTimer.current);
    const controller = new AbortController();
    abort.current = controller;
    let finalMood: Mood | null = null;

    try {
      await streamReply(
        text,
        (event) => {
          if (event.type === 'delta') {
            setWaiting(false);
            setStreaming(true);
            setReply((message) => ({ ...message, text: message.text + event.text }));
          } else if (event.type === 'mode') {
            setModeState(event.mode); // "synth" / "chat mode" in the message switched it
          } else if (event.type === 'expression') {
            finalMood = moodFromTag(event.expression);
          } else if (event.type === 'done') {
            // The final text can differ from the streamed pieces (the backend may clean it up).
            setReply((message) => ({ ...message, text: event.text }));
            finalMood = moodFromTag(event.expression);
          } else {
            throw new BuddyChatError(event.message);
          }
        },
        controller.signal,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof BuddyChatError ? error.message : 'Buddy couldn’t reply right now. Please try again.';
      setReply((reply) => ({ ...reply, text: message, failed: true }));
      setFailed(true);
      finalMood = null;
    } finally {
      if (abort.current === controller) abort.current = null;
      setWaiting(false);
      setStreaming(false);
    }
    setMood(finalMood);
    if (finalMood) moodTimer.current = setTimeout(() => setMood(null), MOOD_SECONDS * 1000);
  }, []);

  /** Add a finished message from the live voice chat (its captions). */
  const addMessage = useCallback((from: ChatMessage['from'], text: string) => {
    setMessages((list) => [...list, { id: newId(), from, text }]);
  }, []);

  /** Set the face's mood directly (live voice); it stays until changed. */
  const showMood = useCallback((next: Mood | null) => {
    if (moodTimer.current) clearTimeout(moodTimer.current);
    setMood(next);
  }, []);

  return {
    messages,
    send,
    addMessage,
    showMood,
    mode,
    setMode,
    /** The mode changed on the backend (a keyword in the live voice chat): show it, no request. */
    applyMode: setModeState,
    waiting,
    streaming,
    busy: waiting || streaming,
    mood,
    failed,
  };
}
