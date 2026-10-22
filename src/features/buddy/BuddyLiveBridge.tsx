import { LiveKitRoom, useLocalParticipant, useRemoteParticipants, useRoomContext, useTrackVolume } from '@livekit/react-native';
import { RoomEvent, Track } from 'livekit-client';
import type { LocalAudioTrack, RemoteAudioTrack, RemoteParticipant } from 'livekit-client';
import { memo, useEffect } from 'react';

import type { BuddyLiveJoin } from './buddyLive';

export type LiveLevels = { you: number; buddy: number; buddyHere: boolean };

type Props = {
  /** Muted: your mic sends no audio, so nothing reaches Buddy's speech-to-text. */
  muted: boolean;
  onLevels: (levels: LiveLevels) => void;
  onCaption: (role: 'user' | 'assistant', text: string) => void;
  onExpression: (expression: string) => void;
  /** What the STT has heard of your current turn so far (shown live under the robot). */
  onHeard: (text: string) => void;
  /** Saying "synth" / "chat mode" switched Buddy's mode. */
  onMode: (mode: 'chat' | 'synth') => void;
};

/**
 * The LiveKit room for a live chat with Buddy. Memoized: the screen re-renders on every voice
 * level change, and re-rendering <LiveKitRoom> with new props makes it try to connect again.
 * Keep the callbacks passed here stable (useCallback).
 */
export const BuddyLiveRoom = memo(function BuddyLiveRoom({ join, onError, ...bridge }: Props & { join: BuddyLiveJoin; onError: (message: string) => void }) {
  return (
    <LiveKitRoom serverUrl={join.livekit_url} token={join.livekit_token} connect audio video={false} onError={(reason) => onError(reason.message)}>
      <BuddyLiveBridge {...bridge} />
    </LiveKitRoom>
  );
});

/**
 * Lives inside <LiveKitRoom> and draws nothing: it reports how loud you and Buddy are,
 * and passes on Buddy's captions and reply moods (data messages from backend/app/buddy_voice.py).
 */
export function BuddyLiveBridge({ muted, onLevels, onCaption, onExpression, onHeard, onMode }: Props) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const buddy = useRemoteParticipants().find((participant) => participant.identity.startsWith('buddy-'));
  const localMic = localParticipant.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined;
  const buddyVoice = buddy?.getTrackPublication(Track.Source.Microphone)?.track as RemoteAudioTrack | undefined;
  const you = useTrackVolume(localMic);
  const buddyLevel = useTrackVolume(buddyVoice);
  const buddyHere = buddy !== undefined;

  useEffect(() => {
    void localParticipant.setMicrophoneEnabled(!muted);
  }, [localParticipant, muted]);

  useEffect(() => {
    onLevels({ you: muted ? 0 : you, buddy: buddyLevel, buddyHere });
  }, [you, muted, buddyLevel, buddyHere, onLevels]);

  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant) => {
      if (!participant?.identity.startsWith('buddy-')) return;
      try {
        const message = JSON.parse(new TextDecoder().decode(payload)) as { type?: string; role?: string; text?: string; expression?: string; mode?: string };
        if (message.type === 'buddy_expression' && message.expression) onExpression(message.expression);
        else if (message.type === 'user_partial' && message.text) onHeard(message.text);
        else if (message.type === 'buddy_mode' && (message.mode === 'chat' || message.mode === 'synth')) onMode(message.mode);
        else if (message.type === 'call_caption' && message.text && (message.role === 'user' || message.role === 'assistant')) {
          onCaption(message.role, message.text);
        }
      } catch {
        // Not one of Buddy's messages.
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, onCaption, onExpression, onHeard, onMode]);

  return null;
}
