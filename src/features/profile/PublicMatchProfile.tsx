import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { getCallElapsedSeconds, getCallSessionMode, resumeCallSession, startCallSession, subscribeToCallSession } from '../call/callSession';
import { Image } from 'expo-image';
import { PhotoPlaceholder } from './PhotoPlaceholder';
import { formatSeconds, type Intent, type Vignette, type Visibility, type VoiceReflection } from './profileModel';

export function PublicMatchProfile({
  photos,
  name,
  age,
  neighborhood,
  craft,
  bio,
  intent,
  voice,
  vignettes,
  visibility,
  onEdit,
  mode = 'self',
  onClose,
  bottomInset = 0,
}: {
  photos: (string | null)[];
  name: string;
  age: string;
  neighborhood: string;
  craft: string;
  bio: string;
  intent: Intent;
  voice: VoiceReflection;
  vignettes: Vignette[];
  visibility: Visibility;
  onEdit?: () => void;
  /** 'self' = your own profile as matches see it (Edit + call); 'match' = someone else's, from the deck. */
  mode?: 'self' | 'match';
  /** Close button for 'match' mode. */
  onClose?: () => void;
  /** Extra space at the bottom, e.g. for a bar of buttons drawn over the page. */
  bottomInset?: number;
}) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const callMode = useSyncExternalStore(subscribeToCallSession, getCallSessionMode, getCallSessionMode);
  const horizontal = 18;
  const heroHeight = Math.min(370, Math.max(320, Math.round((width - horizontal * 2) * 0.98)));
  const showValuePillars = visibility[1];
  // Only what the user actually filled in is shown; empty parts are left out.
  const storyAt = (index: number): Vignette | null => {
    const story = vignettes[index];
    if (story && (story.title.trim() || story.body.trim())) return story;
    return photos[index + 1] ? { title: '', body: '' } : null;
  };
  const stories = [storyAt(0), storyAt(1)];
  const details = [neighborhood, craft].map((part) => part.trim()).filter(Boolean).join(' • ');

  return (
    <View style={s.screen}>
      {mode === 'self' ? (
        <View style={s.topBar}>
          <View style={s.previewLabel}><View style={s.liveDot} /><Text style={s.previewCopy}>Viewing as a match</Text></View>
          <Pressable accessibilityRole="button" onPress={onEdit} style={s.editButton}><Text style={s.editText}>Edit Profile</Text></Pressable>
        </View>
      ) : (
        <View style={s.topBar}>
          <View style={s.previewLabel}><View style={s.liveDot} /><Text style={s.previewCopy}>Today’s intro</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close profile" onPress={onClose} style={s.editButton}><Text style={s.editText}>Close</Text></Pressable>
        </View>
      )}

      <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingBottom: 24 + bottomInset }]} showsVerticalScrollIndicator={false}>
        <View style={[s.hero, { height: heroHeight }]}>
          {photos[0] ? <Image source={{ uri: photos[0] }} contentFit="cover" style={s.coverPhoto} transition={180} /> : (
            <PhotoPlaceholder title="Your cover photo" caption="ADD ONE FROM EDIT PROFILE" />
          )}
          <View style={s.heroShade} />
          <View style={s.verifiedBadge}><Text style={s.verifiedIcon}>✓</Text><Text style={s.verifiedText}>Resonance Verified Human</Text></View>
          <View style={s.heroInfo}>
            <Text style={s.name}>{name}{age ? ', ' + age : ''}</Text>
            {details ? <Text style={s.details}><Text style={s.pin}>⌖ </Text>{details}</Text> : null}
          </View>
        </View>

        {bio.trim() || showValuePillars ? (
          <View style={s.quoteCard}>
            {bio.trim() ? <><Text style={s.quoteGlyph}>“</Text><Text style={s.bio}>{bio}</Text></> : null}
            {showValuePillars ? <Text style={s.intent}>INTENT • {intent.toUpperCase()}</Text> : null}
          </View>
        ) : null}

        {mode === 'match' && !voice.uri ? null : <VoiceCard voice={voice} />}

        {stories[0] ? <StoryCard story={stories[0]} uri={photos[1]} /> : null}
        {stories[1] ? <StoryCard story={stories[1]} uri={photos[2]} /> : null}

        <View style={s.resonance}>
          <View style={s.starCircle}><Text style={s.star}>★</Text></View>
          <View style={s.resonanceCopy}><Text style={s.resonanceLabel}>SHARED RESONANCE</Text><Text style={s.resonanceText}>Slow Weekend Mornings • Deep Dialogue</Text></View>
        </View>

        <View style={s.sanctuary}><Text style={s.lock}>♙</Text><Text style={s.sanctuaryText}>Private Sanctuary: Chemistry Call reflections &amp; personal journals remain hidden.</Text></View>
        {mode === 'match' ? null : callMode === 'inactive' ? (
          <SwipeToCall width={width} onStart={() => { startCallSession(); router.push('/voice-call'); }} />
        ) : (
          <ResumeCallButton onPress={() => { resumeCallSession(); router.push('/voice-call'); }} />
        )}
      </ScrollView>
    </View>
  );
}


const WAVE = [7, 13, 7, 21, 12, 18, 9, 22, 13, 6, 18, 8, 12];

/** Plays the voice reflection recorded in Edit Story; the waveform fills as it plays. */
function VoiceCard({ voice }: { voice: VoiceReflection }) {
  const player = useAudioPlayer(voice.uri ? { uri: voice.uri } : null);
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;
  const total = status.duration || voice.durationSeconds;
  // Idle: the whole waveform stays dark, as before. Playing: it fills from the left.
  const started = playing || status.currentTime > 0.05;
  const progress = started && total > 0 ? Math.min(1, status.currentTime / total) : 1;

  function toggle() {
    if (!voice.uri) return;
    if (playing) {
      player.pause();
      return;
    }
    if (total > 0 && status.currentTime >= total - 0.05) void player.seekTo(0);
    player.play();
  }

  return (
    <View style={s.voiceCard}>
      <View style={s.voiceHead}>
        <View style={s.voiceLabel}><Text style={s.voiceIcon}>〽</Text><Text style={s.voiceCaption}>Voice Reflection</Text></View>
        <Text style={s.duration}>{voice.uri ? formatSeconds(playing ? status.currentTime : total) : ''}</Text>
      </View>
      <Text style={s.voiceTitle}>{voice.title || 'A voice reflection'}</Text>
      {voice.uri ? (
        <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause voice reflection' : 'Play voice reflection'} onPress={toggle} style={s.player}>
          <View style={s.playButton}><Text style={s.playGlyph}>{playing ? 'Ⅱ' : '▶'}</Text></View>
          <View style={s.wave}>{WAVE.map((height, index) => <View key={index} style={[s.waveBar, { height }, index / WAVE.length > progress && s.waveBarRest]} />)}</View>
        </Pressable>
      ) : (
        <View style={s.player}><Text style={s.voiceEmpty}>Add a voice reflection from Edit Profile</Text></View>
      )}
    </View>
  );
}

function ResumeCallButton({ onPress }: { onPress: () => void }) {
  const seconds = getCallElapsedSeconds();
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Resume call" onPress={onPress} style={s.resumeCall}>
      <View style={s.resumeDot} />
      <Text style={s.resumeText}>Resume Call</Text>
      <Text style={s.resumeTime}>{time}</Text>
      <Text style={s.resumeArrow}>→</Text>
    </Pressable>
  );
}

function SwipeToCall({ width, onStart }: { width: number; onStart: () => void }) {
  const sliderWidth = Math.max(240, width - 36);
  const maxTravel = sliderWidth - 66;
  const [dragX] = useState(() => new Animated.Value(0));
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => dragX.setValue(Math.max(0, Math.min(maxTravel, gesture.dx))),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx >= maxTravel * 0.72) {
        Animated.spring(dragX, { toValue: maxTravel, useNativeDriver: true, bounciness: 0 }).start(({ finished }) => {
          if (finished) onStart();
        });
      } else {
        Animated.spring(dragX, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 5 }).start();
      }
    },
    onPanResponderTerminate: () => Animated.spring(dragX, { toValue: 0, useNativeDriver: true }).start(),
    onPanResponderTerminationRequest: () => false,
  }), [dragX, maxTravel, onStart]);

  return (
    <View style={[s.callSlider, { width: sliderWidth }]}>
      <Text pointerEvents="none" style={s.sliderLabel}>Slide to begin voice call</Text>
      <Animated.View
        {...panResponder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Start voice call"
        accessibilityHint="Slide this control to the right to begin"
        accessibilityActions={[{ name: 'activate', label: 'Start voice call' }]}
        onAccessibilityAction={({ nativeEvent }) => { if (nativeEvent.actionName === 'activate') onStart(); }}
        style={[s.sliderThumb, { transform: [{ translateX: dragX }] }]}
      >
        <Text style={s.sliderArrow}>›</Text>
      </Animated.View>
    </View>
  );
}

function StoryCard({ story, uri }: { story: Vignette; uri?: string | null }) {
  return (
    <View style={s.story}>
      {uri ? <Image source={{ uri }} contentFit="cover" style={s.storyPhoto} transition={180} /> : (
        <View style={s.storyPhotoEmpty}><PhotoPlaceholder title="A moment from their story" size="small" /></View>
      )}
      {story.title || story.body ? (
        <View style={s.storyCopy}>
          {story.title ? <Text style={s.storyTitle}>{story.title}</Text> : null}
          {story.body ? <Text style={s.storyBody}>{story.body}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FCF8F7' },
  topBar: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 18, marginTop: 8, marginBottom: 12, paddingLeft: 13, paddingRight: 6, borderRadius: 99, backgroundColor: '#F4EBE7' },
  previewLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 6, height: 6, borderRadius: 6, backgroundColor: '#9B5A4C' },
  previewCopy: { color: '#745850', fontFamily: 'PlusJakartaSans', fontSize: 10 },
  editButton: { minHeight: 28, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 99, backgroundColor: '#FFF' },
  editText: { color: '#3B2021', fontFamily: 'PlusJakartaSans', fontSize: 10, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 5, paddingBottom: 24, gap: 16 },
  hero: { overflow: 'hidden', justifyContent: 'flex-end', borderRadius: 26, backgroundColor: '#EADFD9' },
  coverPhoto: { ...StyleSheet.absoluteFill, width: undefined, height: undefined },
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 148, backgroundColor: 'rgba(28,16,14,0.58)' },
  verifiedBadge: { position: 'absolute', left: 18, bottom: 86, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.95)' },
  verifiedIcon: { width: 14, height: 14, overflow: 'hidden', borderRadius: 7, color: '#FFF', backgroundColor: '#39211C', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  verifiedText: { color: '#352522', fontFamily: 'PlusJakartaSans', fontSize: 9, fontWeight: '600' },
  heroInfo: { position: 'absolute', left: 18, right: 12, bottom: 18, gap: 3 },
  name: { color: '#FFF', fontFamily: 'CormorantGaramond', fontSize: 32, lineHeight: 36, fontWeight: '600' },
  details: { color: 'rgba(255,255,255,0.94)', fontFamily: 'PlusJakartaSans', fontSize: 10 },
  pin: { fontSize: 13 },
  quoteCard: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 17, borderRadius: 24, backgroundColor: '#FAF0ED' },
  quoteGlyph: { height: 24, color: '#8E6259', fontFamily: 'CormorantGaramond', fontSize: 32, fontWeight: '700' },
  bio: { marginTop: 5, color: '#302525', fontFamily: 'PlusJakartaSans', fontSize: 14, lineHeight: 22 },
  intent: { marginTop: 17, color: '#8A6A61', fontFamily: 'PlusJakartaSans', fontSize: 8, fontWeight: '700', letterSpacing: 0.55, textAlign: 'right' },
  voiceCard: { padding: 17, borderRadius: 24, backgroundColor: '#FAF0ED' },
  voiceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  voiceLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  voiceIcon: { color: '#80564F', fontSize: 13 },
  voiceCaption: { color: '#74534C', fontFamily: 'PlusJakartaSans', fontSize: 10, fontWeight: '600' },
  duration: { color: '#9A827B', fontFamily: 'PlusJakartaSans', fontSize: 9 },
  voiceTitle: { marginTop: 12, marginBottom: 12, color: '#332321', fontFamily: 'CormorantGaramond', fontSize: 21, lineHeight: 25 },
  player: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 11, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.82)' },
  playButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#4D201A' },
  playGlyph: { color: '#FFF', fontSize: 11, marginLeft: 1 },
  wave: { flex: 1, height: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 6 },
  waveBar: { width: 3, borderRadius: 3, backgroundColor: '#58261F' },
  waveBarRest: { opacity: 0.35 },
  voiceEmpty: { flex: 1, color: '#8A7169', fontFamily: 'PlusJakartaSans', fontSize: 10, textAlign: 'center' },
  story: { overflow: 'hidden', borderRadius: 23, backgroundColor: '#FAF0ED' },
  storyPhoto: { width: '100%', height: 196, backgroundColor: '#E8DCD6' },
  storyPhotoEmpty: { height: 168 },
  storyCopy: { paddingHorizontal: 19, paddingVertical: 16 },
  storyTitle: { color: '#9E5548', fontFamily: 'CormorantGaramondItalic', fontSize: 17, lineHeight: 22 },
  storyBody: { marginTop: 3, color: '#322523', fontFamily: 'CormorantGaramond', fontSize: 21, lineHeight: 26 },
  resonance: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 18, paddingVertical: 15, borderRadius: 23, backgroundColor: '#F8DEC9' },
  starCircle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: '#35231D' },
  star: { color: '#FFE3C8', fontSize: 18 },
  resonanceCopy: { flex: 1, gap: 4 },
  resonanceLabel: { color: '#806050', fontFamily: 'PlusJakartaSans', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  resonanceText: { color: '#36231D', fontFamily: 'CormorantGaramond', fontSize: 18, lineHeight: 20, fontWeight: '700' },
  sanctuary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 22, paddingTop: 8, paddingBottom: 9 },
  lock: { color: '#9A8179', fontSize: 13 },
  sanctuaryText: { flex: 1, color: '#856D66', fontFamily: 'PlusJakartaSans', fontSize: 9, lineHeight: 14, textAlign: 'center' },
  resumeCall: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, alignSelf: 'center', marginTop: 4, marginBottom: 8, paddingHorizontal: 17, borderWidth: 1, borderColor: 'rgba(100, 43, 51, 0.18)', borderRadius: 30, backgroundColor: '#F4E8E5' },
  resumeDot: { width: 9, height: 9, borderRadius: 6, backgroundColor: '#9B4352' },
  resumeText: { flex: 1, color: '#4D242A', fontFamily: 'PlusJakartaSans', fontSize: 12, fontWeight: '600' },
  resumeTime: { color: '#876B66', fontFamily: 'PlusJakartaSans', fontSize: 10, letterSpacing: 1 },
  resumeArrow: { color: '#541C27', fontFamily: 'PlusJakartaSans', fontSize: 19 },
  callSlider: { height: 62, justifyContent: 'center', alignSelf: 'center', marginTop: 4, marginBottom: 8, paddingHorizontal: 7, borderWidth: 1, borderColor: 'rgba(100, 43, 51, 0.18)', borderRadius: 34, backgroundColor: '#F4E8E5' },
  sliderLabel: { position: 'absolute', left: 60, right: 18, color: '#76534D', fontFamily: 'PlusJakartaSans', fontSize: 11, textAlign: 'center' },
  sliderThumb: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: '#541C27', shadowColor: '#541C27', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 5, elevation: 3 },
  sliderArrow: { marginTop: -3, color: '#FFF', fontFamily: 'PlusJakartaSans', fontSize: 30, lineHeight: 34 },
});
