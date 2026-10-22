import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Reanimated, { FadeIn, FadeOut, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AudioSession, LiveKitRoom, useConnectionState, useLocalParticipant, useRemoteParticipants, useRoomContext, useTrackVolume } from '@livekit/react-native';
import { ConnectionState, RoomEvent, Track } from 'livekit-client';
import type { LocalAudioTrack, RemoteAudioTrack, RemoteParticipant } from 'livekit-client';
import { closeVoiceCall, joinVoiceCall, type VoiceJoin } from './voiceApi';
import { endCallSession, getCallConsent, getCallElapsedSeconds, getCallLanguage, minimizeCallSession, setCallConsent } from './callSession';
import { CallBackdrop, SpeakerDot, VoiceOrb } from './CallVisuals';

const BAND_COUNT = 13;
const COLORS = { background: '#1B0610' };

export function VoiceCallScreen() {
  const [join, setJoin] = useState<VoiceJoin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [consented, setConsented] = useState(getCallConsent());
  const [audioReady, setAudioReady] = useState(false);
  useEffect(() => {
    if (!consented) return;
    let active = true;
    void (async () => {
      try {
        await AudioSession.startAudioSession();
        await AudioSession.selectAudioOutput(Platform.OS === 'ios' ? 'force_speaker' : 'speaker').catch(() => undefined);
        if (active) setAudioReady(true);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not start the call audio session.');
      }
    })();
    return () => {
      active = false;
      void AudioSession.stopAudioSession();
    };
  }, [consented]);

  useEffect(() => {
    if (!consented || !audioReady) return;
    let active = true;
    void joinVoiceCall(getCallLanguage()).then((voiceJoin) => {
      if (active) setJoin(voiceJoin);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'The call could not connect.');
    });
    return () => { active = false; };
  }, [attempt, audioReady, consented]);

  if (!consented) {
    return <CallConsent onContinue={() => { setCallConsent(true); setConsented(true); }} />;
  }

  if (error) {
    return <ConnectionError message={error} assistantText={join?.assistant_text} onRetry={() => { setJoin(null); setError(null); setAttempt((value) => value + 1); }} />;
  }
  if (!join) return <ConnectionLoading />;

  return (
    <LiveKitRoom
      serverUrl={join.livekit_url}
      token={join.livekit_token}
      connect
      audio
      video={false}
      onError={(reason) => setError(`Voice connection failed: ${reason.message}`)}
    >
      <ConnectedCallScreen />
    </LiveKitRoom>
  );
}

function ConnectionLoading() {
  return <SafeAreaView style={[s.safe, s.connectionState]}><Text style={s.connectionTitle}>Finding your voice space…</Text><Text style={s.connectionMessage}>Connecting your call securely.</Text></SafeAreaView>;
}

function CallConsent({ onContinue }: { onContinue: () => void }) {
  return (
    <SafeAreaView style={[s.safe, s.consentState]}>
      <Text style={s.consentEyebrow}>YOUR CHEMISTRY CALL</Text>
      <Text style={s.connectionTitle}>A little space to be heard.</Text>
      <Text style={s.connectionMessage}>Your microphone audio is streamed to Google Gemini Live for real-time listening and spoken replies. Gemini also returns live transcripts, which appear in the call log and stay in this prototype’s temporary backend memory. This app does not save call audio or transcripts to disk. If Gemini Live is unavailable, the call falls back to local Whisper, Ollama and Piper. Google handles data according to your API billing tier; avoid sensitive details on the free tier. You can end the call anytime.</Text>
      <Pressable accessibilityRole="button" onPress={onContinue} style={s.retryButton}><Text style={s.retryText}>I understand · Begin call</Text></Pressable>
    </SafeAreaView>
  );
}

function ConnectionError({ message, assistantText, onRetry }: { message: string; assistantText?: string; onRetry: () => void }) {
  return <SafeAreaView style={[s.safe, s.connectionState]}><Text style={s.connectionTitle}>Your call couldn’t connect</Text><Text style={s.connectionMessage}>{message}</Text>{assistantText ? <View style={s.errorLog}><Text style={s.transcriptRole}>AI GENERATED · TEXT ONLY</Text><Text style={s.transcriptCopy}>{assistantText}</Text></View> : null}<Pressable onPress={onRetry} style={s.retryButton}><Text style={s.retryText}>Try again</Text></Pressable></SafeAreaView>;
}

function ConnectedCallScreen() {
  const router = useRouter();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const connectionState = useConnectionState();
  const remoteAgent = remoteParticipants.find((participant) => participant.identity.startsWith('aria-'));
  const localMic = localParticipant.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined;
  const remoteMic = remoteAgent?.getTrackPublication(Track.Source.Microphone)?.track as RemoteAudioTrack | undefined;
  const localVolume = useTrackVolume(localMic);
  const agentVolume = useTrackVolume(remoteMic);
  const [seconds, setSeconds] = useState(getCallElapsedSeconds());
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [onHold, setOnHold] = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);
  const endingCall = useRef(false);
  const [captions, setCaptions] = useState<{ id: number; role: 'user' | 'assistant'; text: string }[]>([]);
  // Support contacts sent by the backend when the safety path starts (SAFE-2).
  const [supportResources, setSupportResources] = useState<string[]>([]);
  const voiceLevel = muted || onHold ? 0 : Math.min(1, Math.max(localVolume, agentVolume));
  const waveform = useMemo(() => Array.from({ length: BAND_COUNT }, (_, index) => {
    const articulation = 0.2 + (0.8 * Math.abs(Math.sin(index * 1.73 + voiceLevel * 11)));
    return voiceLevel * articulation;
  }), [voiceLevel]);
  // Who is talking, as 0..1 levels eased on the UI thread: Synthe's voice and yours drive different colours.
  const aiLevel = useSharedValue(0);
  const youLevel = useSharedValue(0);

  useEffect(() => {
    void localParticipant.setMicrophoneEnabled(!muted && !onHold);
  }, [localParticipant, muted, onHold]);

  useEffect(() => {
    aiLevel.value = withTiming(onHold ? 0 : agentVolume, { duration: 220 });
    youLevel.value = withTiming(muted || onHold ? 0 : localVolume, { duration: 220 });
  }, [agentVolume, localVolume, muted, onHold, aiLevel, youLevel]);

  useEffect(() => {
    const interval = setInterval(() => setSeconds(getCallElapsedSeconds()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onDataReceived = (payload: Uint8Array, participant?: RemoteParticipant) => {
      if (!participant?.identity.startsWith('aria-')) return;
      try {
        const message = JSON.parse(new TextDecoder().decode(payload)) as { type?: string; role?: string; text?: string; resources?: unknown };
        if (message.type === 'safety_resources' && Array.isArray(message.resources)) {
          setSupportResources(message.resources.filter((item): item is string => typeof item === 'string'));
          return;
        }
        if (message.type !== 'call_caption' || !message.text || (message.role !== 'user' && message.role !== 'assistant')) return;
        setCaptions((current) => [...current, { id: Date.now(), role: message.role as 'user' | 'assistant', text: message.text as string }].slice(-30));
      } catch {
        // Ignore non-caption LiveKit messages.
      }
    };
    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => { room.off(RoomEvent.DataReceived, onDataReceived); };
  }, [room]);

  const toggleMute = () => setMuted((value) => !value);
  const toggleHold = () => setOnHold((value) => !value);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const lastCaption = captions[captions.length - 1];

  // Only states you need to know about; who is talking is shown by colour, not words.
  const statusLabel = onHold ? 'PAUSED WITH YOU'
    : muted ? 'MICROPHONE MUTED'
      : connectionState !== ConnectionState.Connected ? 'CONNECTING TO YOUR VOICE SPACE'
        : null;

  return (
    <View style={s.safe}>
      <CallBackdrop ai={aiLevel} you={youLevel} />
      <SafeAreaView style={s.screen} edges={['top', 'bottom']}>

        <View style={s.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Minimize call" onPress={async () => { await room.disconnect(); minimizeCallSession(); router.back(); }} style={s.topAction}>
            <View style={s.chevronIcon}><View style={s.chevronLeft} /><View style={s.chevronRight} /></View>
          </Pressable>
          <View style={s.timerPill}>
            <View style={[s.liveDot, connectionState !== ConnectionState.Connected && s.liveDotWaiting]} />
            <Text style={s.timer}>{time}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="More call options" style={s.topAction}>
            <Text style={s.moreGlyph}>•••</Text>
          </Pressable>
        </View>

        <View style={s.identity}><Text style={s.name}>Synthe</Text></View>

        <View style={s.callStage}>
          <VoiceOrb ai={aiLevel} you={youLevel} bars={waveform} />
          {lastCaption ? (
            <Reanimated.View key={lastCaption.id} entering={FadeIn.duration(320)} exiting={FadeOut.duration(200)} style={s.livePreview}>
              <Text style={s.livePreviewRole}>{lastCaption.role === 'assistant' ? 'SYNTHE' : 'YOU'}</Text>
              <Text numberOfLines={2} style={s.livePreviewText}>{lastCaption.text}</Text>
            </Reanimated.View>
          ) : null}
        </View>

        {supportResources.length > 0 ? (
          <View accessibilityRole="summary" style={s.supportCard}>
            <Text style={s.supportTitle}>You don’t have to handle this alone</Text>
            <Text style={s.supportBody}>Talking to someone can help right now. These lines are free:</Text>
            {supportResources.map((item) => <Text key={item} style={s.supportItem}>{item}</Text>)}
          </View>
        ) : null}
        {statusLabel ? (
          <View style={s.statusPill}>
            <SpeakerDot ai={aiLevel} you={youLevel} />
            <Text style={s.listening}>{statusLabel}</Text>
          </View>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => setShowCaptions(true)} style={s.transcriptButton}>
          <Text style={s.transcriptButtonText}>CALL LOG · {captions.length}</Text>
        </Pressable>

        <View style={s.bottom}>
          <View style={[s.controls, s.dock]}>
            <CallControl label={muted ? 'Unmute' : 'Mute'} active={muted} onPress={toggleMute} icon="mic" />
            <CallControl label="Speaker" active={speaker} onPress={() => {
              const enabled = !speaker;
              setSpeaker(enabled);
              const output = Platform.OS === 'ios'
                ? enabled ? 'force_speaker' : 'default'
                : enabled ? 'speaker' : 'earpiece';
              void AudioSession.selectAudioOutput(output).catch(() => undefined);
            }} icon="speaker" />
            <CallControl label={onHold ? 'Resume' : 'Hold'} active={onHold} onPress={toggleHold} icon="hold" />
            <CallControl label="End" end onPress={async () => {
              if (endingCall.current) return;
              endingCall.current = true;
              await room.disconnect();
              await closeVoiceCall().catch(() => undefined);
              endCallSession();
              router.replace('/resonance-reveal');
            }} icon="end" />
          </View>
          <View style={s.homeIndicator} />
        </View>
      </SafeAreaView>
      <Modal visible={showCaptions} transparent animationType="fade" onRequestClose={() => setShowCaptions(false)}>
        <View style={s.transcriptBackdrop}>
          <View style={s.transcriptSheet}>
            <View style={s.transcriptHeader}>
              <View><Text style={s.transcriptTitle}>Call log</Text><Text style={s.transcriptSubtitle}>Live speech recognition and Synthe’s replies</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close call log" onPress={() => setShowCaptions(false)} style={s.transcriptClose}><Text style={s.transcriptCloseText}>×</Text></Pressable>
            </View>
            <ScrollView contentContainerStyle={s.transcriptList}>
              {captions.length === 0 ? <Text style={s.transcriptEmpty}>Your conversation will appear here as you speak.</Text> : captions.map((item) => (
                <View key={item.id} style={s.transcriptEntry}>
                  <Text style={s.transcriptRole}>{item.role === 'assistant' ? 'SYNTHE · GENERATED' : 'YOU · TRANSCRIBED'}</Text>
                  <Text style={s.transcriptCopy}>{item.text}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CallControl({ label, active, end, onPress, icon }: {
  label: string;
  active?: boolean;
  end?: boolean;
  onPress: () => void;
  icon: 'mic' | 'speaker' | 'hold' | 'end';
}) {
  return (
    <View style={s.controlItem}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress}
        style={[s.controlButton, active && s.controlActive, end && s.endButton]}>
        {icon === 'mic' ? <MicIcon muted={active} /> : null}
        {icon === 'speaker' ? <Image source={require('../../../assets/icons/call-speaker.svg')} style={s.icon} contentFit="contain" /> : null}
        {icon === 'hold' ? <Image source={require('../../../assets/icons/call-hold.svg')} style={s.icon} contentFit="contain" /> : null}
        {icon === 'end' ? <Image source={require('../../../assets/icons/call-end.svg')} style={s.icon} contentFit="contain" /> : null}
      </Pressable>
      <Text style={s.controlLabel}>{label}</Text>
    </View>
  );
}

function MicIcon({ muted }: { muted?: boolean }) {
  return (
    <View style={s.micIcon}>
      <View style={s.micCapsule} /><View style={s.micArc} /><View style={s.micStem} />
      {muted ? <View style={s.micSlash} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  connectionState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  consentState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, backgroundColor: '#1B0610' },
  consentEyebrow: { color: '#D0A3B1', fontFamily: 'PlusJakartaSans', fontSize: 10, letterSpacing: 2.2, marginBottom: 20 },
  connectionTitle: { color: '#FFF2F4', fontFamily: 'CormorantGaramond', fontSize: 31, textAlign: 'center' },
  connectionMessage: { color: '#D0A3B1', fontFamily: 'PlusJakartaSans', fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 12 },
  retryButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24, backgroundColor: '#E52252', marginTop: 22 },
  retryText: { color: '#FFF', fontFamily: 'PlusJakartaSans', fontSize: 13, fontWeight: '600' },
  errorLog: { alignSelf: 'stretch', marginTop: 18, padding: 16, borderRadius: 16, backgroundColor: 'rgba(255, 224, 233, 0.08)', borderWidth: 1, borderColor: 'rgba(242, 207, 218, 0.15)', gap: 7 },
  screen: { flex: 1, overflow: 'hidden', paddingHorizontal: 22 },
  topRow: { height: 49, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topAction: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  chevronIcon: { width: 18, height: 12, alignItems: 'center', justifyContent: 'center' },
  chevronLeft: { position: 'absolute', left: 1, top: 2, width: 10, height: 2, borderRadius: 2, backgroundColor: '#E7C9D2', transform: [{ rotate: '42deg' }] },
  chevronRight: { position: 'absolute', right: 1, top: 2, width: 10, height: 2, borderRadius: 2, backgroundColor: '#E7C9D2', transform: [{ rotate: '-42deg' }] },
  timerPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: 'rgba(255, 236, 242, 0.08)', borderWidth: 1, borderColor: 'rgba(255, 220, 230, 0.14)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF6B8A' },
  liveDotWaiting: { backgroundColor: '#9C7A85' },
  timer: { color: '#F7E4EA', fontFamily: 'PlusJakartaSans', fontSize: 11, letterSpacing: 1.6, fontVariant: ['tabular-nums'] },
  moreGlyph: { color: '#E7C9D2', fontSize: 15, letterSpacing: 2 },
  identity: { alignItems: 'center', marginTop: 28 },
  name: { color: '#FFF4F7', fontFamily: 'CormorantGaramond', fontSize: 46, lineHeight: 52, fontWeight: '500', letterSpacing: 0.5 },
  callStage: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  livePreview: { position: 'absolute', bottom: 4, left: 8, right: 8, alignItems: 'center', gap: 4 },
  livePreviewRole: { color: 'rgba(255, 226, 234, 0.55)', fontFamily: 'PlusJakartaSans', fontSize: 9, letterSpacing: 2 },
  livePreviewText: { color: 'rgba(255, 242, 246, 0.86)', fontFamily: 'CormorantGaramondItalic', fontSize: 18, lineHeight: 23, textAlign: 'center' },
  supportCard: { marginHorizontal: 24, marginBottom: 14, padding: 16, borderRadius: 16, backgroundColor: 'rgba(255, 224, 233, 0.1)', borderWidth: 1, borderColor: 'rgba(242, 207, 218, 0.22)', gap: 6 },
  supportTitle: { color: '#FFF2F4', fontFamily: 'PlusJakartaSans', fontSize: 15, fontWeight: '600' },
  supportBody: { color: '#E8C5CF', fontFamily: 'PlusJakartaSans', fontSize: 13, lineHeight: 19 },
  supportItem: { color: '#FFF2F4', fontFamily: 'PlusJakartaSans', fontSize: 14, lineHeight: 21 },
  statusPill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(255, 236, 242, 0.07)', borderWidth: 1, borderColor: 'rgba(255, 220, 230, 0.12)' },
  listening: { color: '#EBCBD5', fontFamily: 'PlusJakartaSans', fontSize: 9, letterSpacing: 2.2 },
  transcriptButton: { alignSelf: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 20, backgroundColor: 'rgba(255, 224, 233, 0.08)', borderWidth: 1, borderColor: 'rgba(242, 207, 218, 0.16)' },
  transcriptButtonText: { color: '#D0A3B1', fontFamily: 'PlusJakartaSans', fontSize: 9, letterSpacing: 1.2 },
  transcriptBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8, 2, 5, 0.72)' },
  transcriptSheet: { maxHeight: '70%', minHeight: '38%', backgroundColor: '#2A0C18', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 28 },
  transcriptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(242, 207, 218, 0.13)' },
  transcriptTitle: { color: '#FFF2F4', fontFamily: 'CormorantGaramond', fontSize: 27 },
  transcriptSubtitle: { color: '#B98F9D', fontFamily: 'PlusJakartaSans', fontSize: 11, marginTop: 2 },
  transcriptClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 224, 233, 0.1)' },
  transcriptCloseText: { color: '#F0D8DF', fontSize: 24, lineHeight: 27 },
  transcriptList: { paddingTop: 15, gap: 18 },
  transcriptEntry: { gap: 5 },
  transcriptRole: { color: '#D99BAE', fontFamily: 'PlusJakartaSans', fontSize: 9, letterSpacing: 1.15 },
  transcriptCopy: { color: '#FFF2F4', fontFamily: 'PlusJakartaSans', fontSize: 14, lineHeight: 21 },
  transcriptEmpty: { color: '#D0A3B1', fontFamily: 'PlusJakartaSans', fontSize: 13, lineHeight: 20, paddingTop: 12 },
  bottom: { paddingTop: 24, paddingBottom: 4 },
  controls: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  dock: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12, borderRadius: 30, backgroundColor: 'rgba(255, 236, 242, 0.06)', borderWidth: 1, borderColor: 'rgba(255, 220, 230, 0.12)' },
  controlItem: { width: 62, alignItems: 'center', gap: 8 },
  controlButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255, 220, 230, 0.16)', backgroundColor: 'rgba(255, 236, 242, 0.09)' },
  controlActive: { backgroundColor: 'rgba(255, 122, 150, 0.28)', borderColor: 'rgba(255, 160, 182, 0.7)', shadowColor: '#FF7A96', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  endButton: { backgroundColor: '#E52252', borderColor: 'rgba(255, 183, 198, 0.58)', shadowColor: '#FF2255', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 9, elevation: 7 },
  controlLabel: { color: '#B98F9D', fontFamily: 'PlusJakartaSans', fontSize: 10 },
  icon: { width: 21, height: 21 },
  micIcon: { width: 21, height: 27, alignItems: 'center', justifyContent: 'flex-start' },
  micCapsule: { width: 8, height: 15, borderWidth: 1.7, borderColor: '#EED8DE', borderRadius: 6 },
  micArc: { position: 'absolute', top: 7, width: 16, height: 13, borderWidth: 1.6, borderTopWidth: 0, borderColor: '#EED8DE', borderBottomLeftRadius: 9, borderBottomRightRadius: 9 },
  micStem: { position: 'absolute', bottom: 3, width: 2, height: 5, backgroundColor: '#EED8DE' },
  micSlash: { position: 'absolute', top: 12, left: 1, width: 22, height: 1.5, backgroundColor: '#FFE9EE', transform: [{ rotate: '-46deg' }] },
  homeIndicator: { alignSelf: 'center', width: 98, height: 4, marginTop: 24, borderRadius: 99, backgroundColor: 'rgba(234, 212, 219, 0.28)' },
});
