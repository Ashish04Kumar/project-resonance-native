import { useIsFocused } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, useWindowDimensions, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BuddyLiveRoom, type LiveLevels } from './BuddyLiveBridge';
import { useBuddyChat, type ChatMessage } from './buddyChat';
import { useBuddyLive } from './buddyLive';
import { toggleBuddyTheme, useBuddyTheme, type BuddyPalette } from './buddyTheme';
import { RobotCanvas } from './robot/RobotCanvas';
import { MOOD_LOOKS, ROBOT_LOOKS, deriveRobotState, moodFromTag, type RobotSignals, type RobotState } from './robot/robotState';
import { navBarHeight } from '@/features/resonance/navBar';
import { buddyError, buddySpeaking, buddyThinking } from '@/services/haptics';

import { useDeviceTilt } from './useDeviceTilt';

const SILENT: LiveLevels = { you: 0, buddy: 0, buddyHere: false };
/** Buddy's voice above this counts as speaking (same idea as the robot's own threshold). */
const BUDDY_TALKING = 0.03;


/**
 * The Buddy tab: the 3D robot in the middle, its status, a chat with Buddy, a mic button
 * and a tilt toggle.
 *
 * - Text chat: the robot thinks while waiting, "talks" while the reply text arrives (a made-up
 *   mouth rhythm), then shows the reply's mood for a few seconds.
 * - Mic: a live voice chat (LiveKit, like the call screen). The robot listens while you talk,
 *   thinks after your turn, and its mouth follows Buddy's real voice. You can talk over Buddy
 *   to stop it. What both of you said appears in the chat.
 */
export function BuddyScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { name: themeName, palette: t } = useBuddyTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const focused = useIsFocused();
  const appActive = useAppActive();
  const active = focused && appActive;
  const reduceMotion = useReducedMotion();
  const [tiltOn, setTiltOn] = useState(true);
  const { tilt, available: tiltAvailable, recalibrate } = useDeviceTilt(tiltOn && !reduceMotion, active);
  const [modelError, setModelError] = useState<string | null>(null);
  const chat = useBuddyChat();
  const live = useBuddyLive(active);
  const [levels, setLevels] = useState<LiveLevels>(SILENT);
  const [muted, setMuted] = useState(false);
  // Live: from the end of your turn (your caption arrives) until Buddy's voice starts.
  const [liveThinking, setLiveThinking] = useState(false);
  // Live: your words as the STT hears them, until your turn is complete (then it becomes a chat bubble).
  const [heard, setHeard] = useState('');
  const talkLevel = useTalkRhythm(chat.streaming);

  const buddyTalking = live.live && levels.buddy > BUDDY_TALKING;
  const robotState: RobotState = deriveRobotState({
    error: Boolean(modelError || live.error || chat.failed),
    buddyVoiceLevel: live.live ? levels.buddy : chat.streaming ? Math.max(talkLevel, 0.04) : 0,
    thinking: chat.waiting || (liveThinking && !buddyTalking),
    micOn: live.live && !muted,
  });
  const level = robotState === 'speaking' ? (live.live ? levels.buddy : talkLevel) : levels.you;
  const mood = chat.mood;

  // The 3D scene reads this every frame; updating a ref never re-renders the canvas.
  const signals = useRef<RobotSignals>({ state: 'idle', level: 0, mood: null });
  useEffect(() => {
    signals.current = { state: robotState, level, mood };
  }, [robotState, level, mood]);

  // One haptic each time Buddy enters thinking, speaking or error (a different feel for each).
  const previousState = useRef<RobotState>('idle');
  useEffect(() => {
    if (robotState === previousState.current) return;
    previousState.current = robotState;
    if (!active) return;
    if (robotState === 'thinking') buddyThinking();
    else if (robotState === 'speaking') buddySpeaking();
    else if (robotState === 'error') buddyError();
  }, [robotState, active]);

  // --- live voice events (from BuddyLiveBridge) ---
  const { addMessage, showMood, applyMode } = chat;
  const onLevels = useCallback((next: LiveLevels) => setLevels(next), []);
  const onCaption = useCallback(
    (role: 'user' | 'assistant', text: string) => {
      addMessage(role === 'user' ? 'me' : 'buddy', text);
      if (role === 'user') {
        setHeard('');
        setLiveThinking(true);
        showMood(null);
      } else {
        setLiveThinking(false);
      }
    },
    [addMessage, showMood],
  );
  const onExpression = useCallback((tag: string) => showMood(moodFromTag(tag)), [showMood]);
  const onHeard = useCallback((text: string) => setHeard(text), []);
  const onMode = useCallback((next: 'chat' | 'synth') => applyMode(next), [applyMode]);

  const { stop: stopLive, start: startLive, fail: failLive } = live;
  const onLiveError = useCallback(
    (message: string) => {
      console.warn('Buddy live LiveKit error:', message);
      failLive(`Voice connection failed: ${message}`);
      void stopLive();
    },
    [failLive, stopLive],
  );
  const toggleLive = () => {
    if (live.live || live.starting) {
      void stopLive();
      setMuted(false);
      setLevels(SILENT);
      setHeard('');
      setLiveThinking(false);
      showMood(null);
    } else {
      void startLive();
    }
  };

  const onLoadError = useCallback((message: string) => setModelError(message), []);
  const moodShown = robotState === 'idle' && mood;
  // Shown only when there is something to say; resting idle shows no status at all.
  const statusText = modelError
    ? 'Buddy couldn’t load'
    : live.error ?? (chat.failed ? 'Couldn’t reply' : live.starting ? 'Connecting…' : live.live && !levels.buddyHere ? 'Buddy is joining…'
      : live.live && muted && robotState === 'idle' ? 'Muted' : moodShown ? MOOD_LOOKS[mood].label
        : robotState === 'idle' ? null : ROBOT_LOOKS[robotState].label);
  const statusTint = moodShown ? MOOD_LOOKS[mood].tint : ROBOT_LOOKS[robotState].tint;
  const micOn = live.live || live.starting;

  const tiltUsable = !reduceMotion && tiltAvailable !== false;

  return (
    // KeyboardAvoidingView sets its own bottom padding (0 while the keyboard is closed), so the
    // space kept for the floating tab bar goes on the inner View instead.
    <KeyboardAvoidingView behavior="padding" style={s.screen}>
      <View style={[s.page, { paddingTop: insets.top + 8, paddingBottom: navBarHeight(insets.bottom) + 8 }]}>
      {live.join ? (
        <BuddyLiveRoom join={live.join} muted={muted} onError={onLiveError} onLevels={onLevels} onCaption={onCaption} onExpression={onExpression} onHeard={onHeard} onMode={onMode} />
      ) : null}

      {/* Top bar: Buddy's status (only when there is one), the mode toggle, tilt and re-center. */}
      <View style={s.header}>
        <View accessibilityLiveRegion="polite" style={s.statusSlot}>
          {statusText ? (
            <View style={s.status}>
              <View style={[s.statusDot, { backgroundColor: statusTint }]} />
              <Text style={s.statusText} numberOfLines={1}>{statusText}</Text>
            </View>
          ) : null}
        </View>
        <View style={s.headerActions}>
          {/* Buddy (mode "chat"): just talks. Umbrella (mode "synth"): the full companion, can save, remind and keep lists. Each has its own history and memory. Saying "umbrella mode" / "buddy mode" switches too. */}
          <View style={s.modeToggle} accessibilityRole="radiogroup" accessibilityLabel="Buddy mode">
            {(['chat', 'synth'] as const).map((item) => (
              <Pressable
                key={item}
                accessibilityRole="radio"
                accessibilityState={{ checked: chat.mode === item }}
                accessibilityLabel={item === 'chat' ? 'Buddy mode: just talk' : 'Umbrella mode: save, reminders and lists'}
                onPress={() => chat.setMode(item)}
                style={[s.modeOption, chat.mode === item && s.modeOptionOn]}
              >
                <Text style={[s.modeText, chat.mode === item && s.modeTextOn]}>{item === 'chat' ? 'Buddy' : 'Umbrella'}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: tiltOn && tiltUsable, disabled: !tiltUsable }}
            accessibilityLabel={tiltAvailable === false ? 'No tilt sensor' : 'Tilt to move Buddy (long-press to re-center)'}
            disabled={!tiltUsable}
            onPress={() => setTiltOn((value) => !value)}
            onLongPress={recalibrate}
            style={[s.iconButton, tiltOn && tiltUsable && s.iconButtonOn, !tiltUsable && s.pillDisabled]}
          >
            <SymbolView name={{ ios: 'gyroscope', android: 'screen_rotation', web: 'screen_rotation' }} tintColor={tiltOn && tiltUsable ? t.onAccent : t.muted} size={18} />
          </Pressable>
          {/* Light / dark theme. (Re-center Buddy: long-press the tilt button.) */}
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: themeName === 'dark' }}
            accessibilityLabel="Dark theme"
            onPress={toggleBuddyTheme}
            style={s.iconButton}
          >
            <SymbolView
              name={themeName === 'dark' ? { ios: 'sun.max', android: 'light_mode', web: 'light_mode' } : { ios: 'moon', android: 'dark_mode', web: 'dark_mode' }}
              tintColor={t.muted}
              size={18}
            />
          </Pressable>
        </View>
      </View>


      {/* Buddy sits right under the top bar and takes a fixed share of the screen; the chat gets the rest. */}
      <View style={[s.stage, { height: Math.round(windowHeight * 0.46), marginTop: Math.round(windowHeight * 0.01) }]}>
        {modelError ? (
          <Text style={s.fallback}>The 3D model couldn’t be shown on this phone.</Text>
        ) : (
          <RobotCanvas signals={signals} tilt={tilt} active={active} reduceMotion={reduceMotion} onLoadError={onLoadError} scene={t.scene} halo={t.halo} haloStrength={t.haloStrength} />
        )}
      </View>

      {/* Live: what Buddy has heard you say so far, in small text right under the robot. */}
      {micOn ? (
        <Text style={s.heard} numberOfLines={2} accessibilityLiveRegion="polite">
          {heard || (robotState === 'listening' && levels.you > 0.05 ? 'Listening…' : ' ')}
        </Text>
      ) : null}

      <ChatPanel
        messages={chat.messages}
        busy={chat.busy}
        onSend={chat.send}
        voice={{ on: micOn, ready: live.live, muted, onToggle: toggleLive, onMute: () => setMuted((value) => !value) }}
      />
      </View>
    </KeyboardAvoidingView>
  );
}

type VoiceControls = { on: boolean; ready: boolean; muted: boolean; onToggle: () => void; onMute: () => void };

/**
 * The conversation (this visit only), the box to type in, and the voice buttons beside it:
 * mic starts a live voice chat; during it, Mute and End take its place. Typing is off during a voice chat.
 */
function ChatPanel({ messages, busy, onSend, voice }: { messages: ChatMessage[]; busy: boolean; onSend: (text: string) => Promise<void>; voice: VoiceControls }) {
  const live = voice.on;
  const { palette: t } = useBuddyTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { width } = useWindowDimensions();
  const [draft, setDraft] = useState('');
  const list = useRef<ScrollView>(null);
  const canSend = draft.trim() !== '' && !busy && !live;

  const send = () => {
    if (!canSend) return;
    void onSend(draft);
    setDraft('');
  };

  return (
    <View style={s.chat}>
      {messages.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>Type a message, or tap the mic to talk with Buddy.</Text>
        </View>
      ) : (
        <View style={s.messages}>
        <ScrollView
          ref={list}
          style={s.messages}
          contentContainerStyle={s.messagesContent}
          // Keep the newest message in view as the reply streams in.
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((message) => (
            <View key={message.id} style={[s.bubble, message.from === 'me' ? s.mine : s.theirs, message.failed && s.failedBubble]}>
              <Text style={[s.bubbleText, message.from === 'me' && s.mineText]}>{message.text || '…'}</Text>
            </View>
          ))}
        </ScrollView>
        {/* Messages fade out under the robot instead of being cut by a hard edge. */}
        <View pointerEvents="none" style={s.fade}>
          <Canvas style={s.fadeCanvas}>
            <Rect x={0} y={0} width={width} height={FADE_HEIGHT}>
              <LinearGradient start={vec(0, 0)} end={vec(0, FADE_HEIGHT)} colors={[t.background, transparent(t.background)]} />
            </Rect>
          </Canvas>
        </View>
        </View>
      )}
      <View style={s.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={live ? 'Voice chat is on' : 'Message Buddy'}
          placeholderTextColor={t.muted}
          editable={!live}
          style={[s.input, live && s.pillDisabled]}
          multiline
          maxLength={2000}
          accessibilityLabel="Message Buddy"
        />
        {live ? (
          <>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Mute my microphone"
              accessibilityState={{ checked: voice.muted, disabled: !voice.ready }}
              disabled={!voice.ready}
              onPress={voice.onMute}
              style={[s.roundLight, voice.muted && s.roundLightOn, !voice.ready && s.sendOff]}
            >
              <SymbolView
                name={voice.muted ? { ios: 'mic.slash.fill', android: 'mic_off', web: 'mic_off' } : { ios: 'mic.fill', android: 'mic', web: 'mic' }}
                tintColor={voice.muted ? t.onAccent : t.softBorder}
                size={20}
              />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="End voice chat with Buddy" onPress={voice.onToggle} style={[s.send, s.endCall]}>
              <SymbolView name={{ ios: 'phone.down.fill', android: 'call_end', web: 'call_end' }} tintColor="#FFFFFF" size={20} />
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start voice chat with Buddy"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={voice.onToggle}
              style={[s.roundLight, busy && s.sendOff]}
            >
              <SymbolView name={{ ios: 'mic.fill', android: 'mic', web: 'mic' }} tintColor={t.softBorder} size={20} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: !canSend }}
              disabled={!canSend}
              onPress={send}
              style={[s.send, !canSend && s.sendOff]}
            >
              <SymbolView name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} tintColor={t.onAccent} size={20} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setActive(next === 'active'));
    return () => subscription.remove();
  }, []);
  return active;
}

/** A made-up talking rhythm (syllables and pauses): moves the mouth while a text reply streams in. */
function useTalkRhythm(on: boolean): number {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!on) return;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const t = (Date.now() - startedAt) / 1000;
      const syllable = Math.max(0, Math.sin(t * 13)) * (0.55 + 0.45 * Math.sin(t * 2.3));
      const phrase = Math.sin(t * 0.9) > -0.6 ? 1 : 0; // short pauses between phrases
      setLevel(Math.max(0, syllable * phrase));
    }, 60);
    return () => {
      clearInterval(interval);
      setLevel(0);
    };
  }, [on]);
  return on ? level : 0;
}

/** How tall the fade above the messages is. */
const FADE_HEIGHT = 36;

/** The same colour, fully transparent (for gradients that fade into the background). */
function transparent(hex: string): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, 0)`;
}

function makeStyles(C: BuddyPalette) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  page: { flex: 1 },
  heard: { alignSelf: 'stretch', minHeight: 34, paddingHorizontal: 28, marginTop: -6, color: C.muted, fontFamily: 'PlusJakartaSans', fontSize: 12, lineHeight: 17, textAlign: 'center', fontStyle: 'italic' },
  stage: { alignSelf: 'stretch', justifyContent: 'center' },
  fallback: { textAlign: 'center', color: C.muted, fontFamily: 'PlusJakartaSans', fontSize: 14, paddingHorizontal: 32 },
  status: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeToggle: { flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  modeOption: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
  modeOptionOn: { backgroundColor: C.accent },
  modeText: { color: C.muted, fontFamily: 'PlusJakartaSans', fontSize: 12, fontWeight: '600' },
  modeTextOn: { color: C.onAccent },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  iconButtonOn: { backgroundColor: C.accent, borderColor: C.accent },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyText: { color: C.muted, fontFamily: 'PlusJakartaSans', fontSize: 13, textAlign: 'center' },
  statusSlot: { flex: 1, flexDirection: 'row' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: C.ink, fontFamily: 'PlusJakartaSans', fontSize: 13, fontWeight: '600' },
  pillDisabled: { opacity: 0.45 },
  chat: { flex: 1, alignSelf: 'stretch', paddingHorizontal: 16, paddingTop: 4, gap: 8 },
  messages: { flex: 1 },
  fade: { position: 'absolute', top: 0, left: 0, right: 0, height: FADE_HEIGHT },
  fadeCanvas: { flex: 1 },
  messagesContent: { gap: 6, paddingVertical: 4 },
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16 },
  mine: { alignSelf: 'flex-end', backgroundColor: C.mine, borderBottomRightRadius: 5 },
  theirs: { alignSelf: 'flex-start', backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, borderBottomLeftRadius: 5 },
  failedBubble: { borderColor: '#FF4D5E' },
  bubbleText: { color: C.ink, fontFamily: 'PlusJakartaSans', fontSize: 14, lineHeight: 20 },
  mineText: { color: '#FFFFFF' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 44, maxHeight: 110, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, color: C.ink, fontFamily: 'PlusJakartaSans', fontSize: 14 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent },
  sendOff: { opacity: 0.4 },
  roundLight: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.soft, borderWidth: 1, borderColor: C.softBorder },
  roundLightOn: { backgroundColor: C.accent },
  endCall: { backgroundColor: '#D9364A' },
});
}
