import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { useFonts } from 'expo-font';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { formatSeconds, type VoiceReflection } from '@/features/profile/profileModel';
import { passSent, passThreshold, sparkSent, sparkThreshold } from '@/services/haptics';

import { DeckApiError, getDeck, resetSparks, sendSpark, type DeckProfile } from './deckApi';
import { deckProfile, rememberDeck, takeProfileChoice } from './deckStore';
import { PassButton, SparkButton, SwipeVeil } from './SwipeFeedback';

type Direction = 'pass' | 'spark';

const WAVE_HEIGHTS = [7, 13, 18, 10, 22, 15, 25, 12, 19, 8, 15, 23, 11, 18, 9, 14, 6];

/**
 * Today's intros: everyone else's finished profile from the backend.
 * Swipe right (or Send Spark) records a spark; swipe left (or Pass) only moves on.
 * Tap the photo to open the full profile. Reset (top left) forgets your sparks and
 * brings the whole list back.
 */
export function SwipeDeckScreen() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond: require('../../../assets/fonts/CormorantGaramond[wght].ttf'),
    CormorantGaramondItalic: require('../../../assets/fonts/CormorantGaramond-Italic[wght].ttf'),
    PlusJakartaSans: require('../../../assets/fonts/PlusJakartaSans[wght].ttf'),
  });
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // null while loading; the cards still to show, top card first.
  const [queue, setQueue] = useState<DeckProfile[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const queueRef = useRef<DeckProfile[] | null>(null);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const translateX = useSharedValue(0);
  // 0..1 toward each button while dragging, and a one-shot 0 -> 1 burst when a swipe is sent.
  const sparkProgress = useSharedValue(0);
  const passProgress = useSharedValue(0);
  const sparkBurst = useSharedValue(0);
  const passBurst = useSharedValue(0);
  const threshold = width * 0.28;
  // Whether the current drag is past the threshold, so the tick fires once per crossing.
  const pastThreshold = useSharedValue(false);

  const showDeck = useCallback((items: DeckProfile[]) => {
    rememberDeck(items);
    setTotal(items.length);
    setQueue(items.filter((item) => !item.sparked));
    setLoadError(null);
  }, []);
  const showLoadError = useCallback((error: unknown) => {
    setLoadError(error instanceof DeckApiError ? error.message : 'We couldn’t load today’s intros.');
    setQueue((current) => current ?? []);
  }, []);
  const load = useCallback(() => getDeck().then(showDeck, showLoadError), [showDeck, showLoadError]);

  useEffect(() => {
    let active = true;
    getDeck().then((items) => active && showDeck(items), (error: unknown) => active && showLoadError(error));
    return () => {
      active = false;
    };
  }, [showDeck, showLoadError]);

  const finishSwipe = useCallback((direction: Direction, userId: string) => {
    translateX.set(0);
    setQueue((current) => (current ? current.filter((item) => item.userId !== userId) : current));
    const name = deckProfile(userId)?.profile.name ?? 'them';
    if (direction === 'pass') {
      setFeedback(`Passed on ${name}`);
      return;
    }
    setFeedback(`A spark is on its way to ${name}`);
    sendSpark(userId).catch((error: unknown) => {
      setFeedback(error instanceof DeckApiError ? error.message : 'That spark didn’t send. Try again later.');
    });
  }, [translateX]);

  const swipeAway = useCallback((direction: Direction, userId: string, velocityX = 0) => {
    'worklet';
    if (direction === 'spark') runOnJS(sparkSent)();
    else runOnJS(passSent)();
    // The chosen button glows fully, bursts, then settles back.
    const progress = direction === 'spark' ? sparkProgress : passProgress;
    const other = direction === 'spark' ? passProgress : sparkProgress;
    const burst = direction === 'spark' ? sparkBurst : passBurst;
    progress.set(withSequence(withTiming(1, { duration: 110 }), withTiming(0, { duration: 520 })));
    other.set(withTiming(0, { duration: 160 }));
    burst.set(0);
    burst.set(withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) }));
    const destination = direction === 'spark' ? width * 1.35 : -width * 1.35;
    translateX.set(withSpring(destination, {
      velocity: velocityX,
      damping: 22,
      stiffness: 180,
      mass: 0.82,
    }, (finished) => {
      if (finished) runOnJS(finishSwipe)(direction, userId);
    }));
  }, [finishSwipe, translateX, width, sparkProgress, passProgress, sparkBurst, passBurst]);

  // Pass / Send Spark chosen on the full profile page: play it here as a swipe.
  useFocusEffect(useCallback(() => {
    const choice = takeProfileChoice();
    if (!choice || queueRef.current?.[0]?.userId !== choice.userId) return undefined;
    const timer = setTimeout(() => swipeAway(choice.direction, choice.userId), 260);
    return () => clearTimeout(timer);
  }, [swipeAway]));

  async function reset() {
    if (resetting) return;
    setResetting(true);
    try {
      await resetSparks();
      await load();
      setFeedback('Intros reset');
    } catch (error) {
      setFeedback(error instanceof DeckApiError ? error.message : 'Reset didn’t work. Try again.');
    } finally {
      setResetting(false);
    }
  }

  const top = queue?.[0];
  const topId = top?.userId ?? '';
  const panGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-18, 18])
    .onUpdate((event) => {
      translateX.set(event.translationX);
      sparkProgress.set(Math.min(1, Math.max(0, event.translationX / threshold)));
      passProgress.set(Math.min(1, Math.max(0, -event.translationX / threshold)));
      // A tick when the drag reaches the point where letting go sends it (different for each side).
      const past = Math.abs(event.translationX) > threshold;
      if (past && !pastThreshold.value) {
        if (event.translationX > 0) runOnJS(sparkThreshold)();
        else runOnJS(passThreshold)();
      }
      pastThreshold.set(past);
    })
    .onEnd((event) => {
      pastThreshold.set(false);
      const passedThreshold = Math.abs(event.translationX) > threshold;
      const fastFlick = Math.abs(event.velocityX) > 850;
      if (passedThreshold || fastFlick) {
        swipeAway(event.translationX >= 0 ? 'spark' : 'pass', topId, event.velocityX);
      } else {
        translateX.set(withSpring(0, { damping: 18, stiffness: 220 }));
        sparkProgress.set(withTiming(0, { duration: 220 }));
        passProgress.set(withTiming(0, { duration: 220 }));
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${interpolate(translateX.value, [-width, width], [-13, 13], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const bottomOffset = 82 + insets.bottom;

  if (!fontsLoaded) return <View style={s.screen} />;

  return (
    <View style={s.screen}>
      <View style={[s.content, { paddingTop: insets.top + 8, paddingBottom: bottomOffset + 8 }]}>
        <Animated.View entering={FadeIn.duration(280)} style={s.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset intros"
            accessibilityHint="Forgets your sparks and shows every intro again"
            disabled={resetting}
            onPress={() => void reset()}
            style={({ pressed }) => [s.resetButton, (pressed || resetting) && s.resetPressed]}
          >
            {resetting ? <ActivityIndicator size="small" color="#541827" /> : (
              <SymbolView name={{ ios: 'arrow.counterclockwise', android: 'restart_alt', web: 'restart_alt' }} tintColor="#541827" size={18} />
            )}
            <Text style={s.resetText}>Reset</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/edit-profile')} style={s.profileShortcut}>
            <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} tintColor="#FFF8F5" size={19} />
          </Pressable>
        </Animated.View>

        {queue === null ? (
          <View style={s.emptyState}><ActivityIndicator color="#7D293B" /></View>
        ) : top ? <>
          <View style={s.introPill}><View style={s.pillDot} /><Text style={s.introPillText}>Today · {queue.length} intros</Text></View>
          <View style={s.deck}>
            {queue.length > 1 ? <View pointerEvents="none" style={s.deckBackCard} /> : null}
            <GestureDetector gesture={panGesture}>
              <Animated.View key={top.userId} entering={FadeInDown.duration(360).easing(Easing.out(Easing.cubic))} style={[s.card, cardAnimatedStyle]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${top.profile.name}'s full profile`}
                  onPress={() => router.push({ pathname: '/match/[id]', params: { id: top.userId } })}
                  style={s.hero}
                >
                  {top.profile.photos[0] ? <Image source={{ uri: top.profile.photos[0] }} contentFit="cover" transition={280} style={s.heroImage} /> : null}
                  <View pointerEvents="none" style={s.photoTint} />
                  <View style={s.photoCounter}><Text style={s.photoCounterText}>{total - queue.length + 1} of {total}</Text></View>
                  <SwipeVeil kind="spark" drag={translateX} threshold={threshold} />
                  <SwipeVeil kind="pass" drag={translateX} threshold={threshold} />
                  <View style={s.profileCaption}>
                    <Text style={s.profileName}>{top.profile.name}{top.profile.age ? `, ${top.profile.age}` : ''}</Text>
                    <View style={s.metaLine}>
                      <SymbolView name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }} tintColor="#FFF5F2" size={15} />
                      <Text numberOfLines={1} style={s.metaText}>{[top.profile.neighborhood, top.profile.craft].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <View style={s.viewHint}>
                      <Text style={s.viewHintText}>Tap to view profile</Text>
                      <SymbolView name={{ ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }} tintColor="#FFE9E2" size={13} />
                    </View>
                  </View>
                </Pressable>

                <DeckVoice key={top.userId} voice={top.profile.voice} />
              </Animated.View>
            </GestureDetector>
          </View>

          <View style={s.actions}>
            <PassButton progress={passProgress} burst={passBurst} onPress={() => swipeAway('pass', top.userId)} />
            <SparkButton progress={sparkProgress} burst={sparkBurst} onPress={() => swipeAway('spark', top.userId)} />
          </View>
          <Text accessibilityLiveRegion="polite" numberOfLines={1} style={s.actionFeedback}>{feedback}</Text>
        </> : (
          <View style={s.emptyState}>
            <View style={s.emptyIcon}><SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} tintColor="#7D293B" size={24} /></View>
            <Text style={s.emptyTitle}>{loadError ? 'Intros didn’t load.' : 'You’re all caught up.'}</Text>
            <Text style={s.emptyCopy}>{loadError ?? 'We’ll bring more thoughtful introductions your way soon.'}</Text>
            <Pressable accessibilityRole="button" disabled={resetting} onPress={() => void (loadError ? load() : reset())} style={s.refreshButton}>
              <Text style={s.refreshText}>{loadError ? 'Try again' : 'Start over'}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

/** The card's voice reflection: plays the person's recording; the waveform fills as it plays. */
function DeckVoice({ voice }: { voice: VoiceReflection }) {
  const player = useAudioPlayer(voice.uri ? { uri: voice.uri } : null);
  const status = useAudioPlayerStatus(player);
  const total = status.duration || voice.durationSeconds;
  const started = status.playing || status.currentTime > 0.05;
  const progress = started && total > 0 ? Math.min(1, status.currentTime / total) : 1;

  function toggle() {
    if (!voice.uri) return;
    if (status.playing) {
      player.pause();
      return;
    }
    if (total > 0 && status.currentTime >= total - 0.05) void player.seekTo(0);
    player.play();
  }

  return (
    <View style={s.voiceCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice reflection' : 'Play voice reflection'}
        disabled={!voice.uri}
        onPress={toggle}
        style={[s.playButton, !voice.uri && s.playDisabled]}
      >
        <SymbolView
          name={status.playing ? { ios: 'pause.fill', android: 'pause', web: 'pause' } : { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
          tintColor="#FFF9F7"
          size={19}
        />
      </Pressable>
      <View style={s.voiceContent}>
        <Text numberOfLines={1} style={s.voiceQuote}>{voice.title ? `“${voice.title}”` : 'A voice reflection'}</Text>
        <View style={s.waveform}>
          {WAVE_HEIGHTS.map((bar, index) => (
            <View key={`${index}-${bar}`} style={[s.waveBar, { height: bar }, index / WAVE_HEIGHTS.length > progress && s.waveBarRest]} />
          ))}
        </View>
      </View>
      <Text style={s.voiceDuration}>{voice.uri ? formatSeconds(status.playing ? status.currentTime : total) : ''}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FCF8F7' },
  content: { flex: 1, paddingHorizontal: 20 },
  topBar: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resetButton: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, borderWidth: 1, borderColor: '#EBD8D8', borderRadius: 99, backgroundColor: '#FFF8F6' },
  resetPressed: { opacity: 0.6 },
  resetText: { color: '#541827', fontFamily: 'PlusJakartaSans', fontSize: 11, fontWeight: '600' },
  profileShortcut: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#541827' },
  introPill: { alignSelf: 'center', minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4, paddingHorizontal: 14, borderWidth: 1, borderColor: '#F0D5D9', borderRadius: 99, backgroundColor: '#FFF1F2' },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#A43D52' },
  introPillText: { color: '#75414A', fontFamily: 'PlusJakartaSans', fontSize: 11, fontWeight: '500' },
  deck: { flex: 1, minHeight: 320, marginTop: 14, marginBottom: 14, justifyContent: 'center' },
  deckBackCard: { position: 'absolute', left: 8, right: 8, top: 8, bottom: -3, borderRadius: 28, backgroundColor: '#F0E1DF', transform: [{ scale: 0.97 }] },
  card: { flex: 1, overflow: 'hidden', borderWidth: 1, borderColor: '#F0E4E1', borderRadius: 28, backgroundColor: '#FFFEFD', shadowColor: '#4C202B', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 7 },
  hero: { flex: 1, minHeight: 190, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: '#754E4A' },
  heroImage: { ...StyleSheet.absoluteFill },
  photoTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(43, 15, 27, 0.18)' },
  photoCounter: { position: 'absolute', top: 14, right: 14, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: 'rgba(36, 22, 24, 0.76)' },
  photoCounterText: { color: '#FFF8F5', fontFamily: 'PlusJakartaSans', fontSize: 10, fontWeight: '500' },
  profileCaption: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 70, backgroundColor: 'rgba(51, 17, 31, 0.58)' },
  profileName: { color: '#FFF8F5', fontFamily: 'CormorantGaramond', fontSize: 31, lineHeight: 37, fontWeight: '600' },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  metaText: { flex: 1, color: '#FFF0EB', fontFamily: 'PlusJakartaSans', fontSize: 10, lineHeight: 16 },
  viewHint: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,233,226,0.35)', backgroundColor: 'rgba(255,255,255,0.1)' },
  viewHintText: { color: '#FFE9E2', fontFamily: 'PlusJakartaSans', fontSize: 9, fontWeight: '600', letterSpacing: 0.4 },
  voiceCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 13, marginVertical: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#F1D7D8', borderRadius: 18, backgroundColor: '#FFF3F3' },
  playButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#541827' },
  playDisabled: { opacity: 0.4 },
  voiceContent: { flex: 1, gap: 7 },
  voiceQuote: { color: '#4A2A30', fontFamily: 'CormorantGaramondItalic', fontSize: 16, lineHeight: 20 },
  waveform: { height: 24, flexDirection: 'row', alignItems: 'center', gap: 3 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: '#8B4554' },
  waveBarRest: { backgroundColor: '#E2C5C9' },
  voiceDuration: { alignSelf: 'flex-end', marginBottom: 3, color: '#A28788', fontFamily: 'PlusJakartaSans', fontSize: 9 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  actionFeedback: { height: 17, marginTop: 4, color: '#956D71', fontFamily: 'PlusJakartaSans', fontSize: 9, textAlign: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  emptyIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#F7E8E6' },
  emptyTitle: { marginTop: 17, color: '#35191F', fontFamily: 'CormorantGaramond', fontSize: 28, fontWeight: '600' },
  emptyCopy: { marginTop: 6, color: '#78686A', fontFamily: 'PlusJakartaSans', fontSize: 12, lineHeight: 19, textAlign: 'center' },
  refreshButton: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 99, backgroundColor: '#541827' },
  refreshText: { color: '#FFF8F5', fontFamily: 'PlusJakartaSans', fontSize: 11, fontWeight: '600' },
});
