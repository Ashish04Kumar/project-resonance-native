import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { MAX_VOICE_SECONDS, formatSeconds, type VoiceReflection } from './profileModel';

const C = { ink: '#251719', wine: '#521927', muted: '#78716C', line: '#ECDCDA', card: '#FAF3F1' };

/** Record a short voice reflection (up to 30 s) with a title; the public profile plays it back. */
export function VoiceReflectionEditor({ value, onChange }: { value: VoiceReflection; onChange: (next: VoiceReflection) => void }) {
  // Saved in the app's document folder so the system doesn't clear it like the cache.
  // Metering gives the live mic level that drives the waveform while recording.
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document', isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(recorder, 90);
  const player = useAudioPlayer(value.uri ? { uri: value.uri } : null);
  const playback = useAudioPlayerStatus(player);
  const [error, setError] = useState<string | null>(null);
  const recording = recorderState.isRecording;
  const elapsed = recorderState.durationMillis / 1000;

  async function start() {
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('Allow microphone access to record a voice reflection.');
      return;
    }
    player.pause();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function stop() {
    await recorder.stop();
    // Back to playback mode so the preview plays from the loudspeaker.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (recorder.uri) onChange({ ...value, uri: recorder.uri, durationSeconds: Math.min(elapsed, MAX_VOICE_SECONDS) });
  }

  // Stop on its own at the time limit.
  useEffect(() => {
    if (recording && elapsed >= MAX_VOICE_SECONDS) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, elapsed]);

  function togglePreview() {
    if (playback.playing) {
      player.pause();
      return;
    }
    if (playback.duration > 0 && playback.currentTime >= playback.duration - 0.05) void player.seekTo(0);
    player.play();
  }

  return (
    <View style={s.card}>
      <TextInput
        accessibilityLabel="Voice reflection title"
        value={value.title}
        onChangeText={(title) => onChange({ ...value, title })}
        style={s.title}
        placeholder="Give your reflection a title"
        placeholderTextColor="#A8A29E"
        maxLength={70}
      />
      {recording ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Recording. Tap to stop" onPress={() => void stop()} style={[s.recordRow, s.recordingRow]}>
          <PulsingDot />
          <LiveWave metering={recorderState.metering} tick={recorderState.durationMillis} />
          <Text style={s.timer}>{formatSeconds(elapsed)} / {formatSeconds(MAX_VOICE_SECONDS)}</Text>
          <View style={s.stopSquare} />
        </Pressable>
      ) : value.uri ? (
        <View style={s.previewRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={playback.playing ? 'Pause preview' : 'Play preview'} onPress={togglePreview} style={s.playButton}>
            <Text style={s.playGlyph}>{playback.playing ? 'Ⅱ' : '▶'}</Text>
          </Pressable>
          <Text style={s.previewTime}>
            {playback.playing ? formatSeconds(playback.currentTime) : formatSeconds(value.durationSeconds)}
          </Text>
          <View style={s.previewActions}>
            <Pressable accessibilityRole="button" onPress={() => void start()} hitSlop={6}><Text style={s.action}>Record again</Text></Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => { player.pause(); onChange({ ...value, uri: null, durationSeconds: 0 }); }}
              hitSlop={6}
            >
              <Text style={[s.action, s.remove]}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Record a voice reflection" onPress={() => void start()} style={s.recordRow}>
          <View style={s.micDot} />
          <Text style={s.recordText}>Record a voice reflection</Text>
          <Text style={s.timer}>up to {MAX_VOICE_SECONDS}s</Text>
        </Pressable>
      )}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      <Text style={s.hint}>Shown as your Voice Reflection to a match</Text>
    </View>
  );
}

const BAR_COUNT = 26;
const MIN_BAR = 3;
const MAX_BAR = 22;

/** Map the mic level (dBFS, about -160 silent to 0 loudest) to 0..1, so ordinary speech fills most of the range. */
function levelFrom(metering: number | undefined, tick: number): number {
  if (metering === undefined || !Number.isFinite(metering)) {
    // No level on this device: a gentle wave so recording still feels alive.
    return 0.25 + 0.2 * Math.sin(tick / 160);
  }
  return Math.min(1, Math.max(0, (metering + 50) / 45));
}

/** Thin bars that scroll left, newest level on the right, as you speak. */
function LiveWave({ metering, tick }: { metering?: number; tick: number }) {
  const [wave, setWave] = useState({ tick, levels: Array<number>(BAR_COUNT).fill(0) });
  // A new recorder reading (every ~90 ms) adds one bar on the right and drops the oldest.
  if (wave.tick !== tick) {
    setWave({ tick, levels: [...wave.levels.slice(1), levelFrom(metering, tick)] });
  }
  const levels = wave.levels;
  return (
    <View style={s.liveWave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {levels.map((level, index) => <WaveBar key={index} level={level} />)}
    </View>
  );
}

function WaveBar({ level }: { level: number }) {
  const height = useSharedValue(MIN_BAR);
  useEffect(() => {
    // Runs on the UI thread: each bar eases to its new height instead of jumping.
    height.value = withTiming(MIN_BAR + level * (MAX_BAR - MIN_BAR), { duration: 110, easing: Easing.out(Easing.quad) });
  }, [height, level]);
  const style = useAnimatedStyle(() => ({ height: height.value }));
  return <Animated.View style={[s.liveBar, style]} />;
}

function PulsingDot() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[s.recDot, style]} />;
}

const s = StyleSheet.create({
  card: { gap: 10, marginTop: 8, padding: 16, borderWidth: 1, borderColor: C.line, borderRadius: 22, backgroundColor: C.card },
  title: { padding: 0, color: '#471925', fontFamily: 'CormorantGaramond', fontSize: 18, fontWeight: '500' },
  recordRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: '#EFE5E3', backgroundColor: '#FFF' },
  recordingRow: { borderColor: '#E7B8BF', backgroundColor: '#FFF7F7' },
  micDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.wine },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C2334B' },
  liveWave: { flex: 1, height: MAX_BAR, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveBar: { width: 2, borderRadius: 1, backgroundColor: '#7D293B', opacity: 0.85 },
  stopSquare: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#521927' },
  recordText: { flex: 1, color: C.ink, fontFamily: 'PlusJakartaSans', fontSize: 12, fontWeight: '600' },
  timer: { color: C.muted, fontFamily: 'PlusJakartaSans', fontSize: 10 },
  previewRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.82)' },
  playButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#4D201A' },
  playGlyph: { color: '#FFF', fontSize: 11, marginLeft: 1 },
  previewTime: { color: C.muted, fontFamily: 'PlusJakartaSans', fontSize: 10 },
  previewActions: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 14, paddingRight: 6 },
  action: { color: '#662031', fontFamily: 'PlusJakartaSans', fontSize: 10, fontWeight: '700' },
  remove: { color: C.muted },
  error: { color: '#7D293B', fontFamily: 'PlusJakartaSans', fontSize: 10, lineHeight: 15 },
  hint: { color: '#A8A29E', fontFamily: 'PlusJakartaSans', fontSize: 9, fontStyle: 'italic' },
});
