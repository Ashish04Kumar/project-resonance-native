import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_VIGNETTES } from '@/features/profile/profileModel';
import { PublicMatchProfile } from '@/features/profile/PublicMatchProfile';
import { useBrandFonts } from '@/theme/brand';

import { chooseFromProfile, deckProfile } from './deckStore';
import { PassButton, SparkButton } from './SwipeFeedback';

const BAR_HEIGHT = 86;

/**
 * Someone's full profile, opened by tapping their card in the deck. It slides up over
 * the deck; Pass or Send Spark closes it and the deck plays the same swipe.
 */
export function MatchProfileScreen() {
  const fontsLoaded = useBrandFonts();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = id ? deckProfile(id) : undefined;
  const sparkProgress = useSharedValue(0);
  const passProgress = useSharedValue(0);
  const sparkBurst = useSharedValue(0);
  const passBurst = useSharedValue(0);

  function choose(direction: 'pass' | 'spark') {
    if (!id) return;
    const burst = direction === 'spark' ? sparkBurst : passBurst;
    (direction === 'spark' ? sparkProgress : passProgress).set(withTiming(1, { duration: 140 }));
    burst.set(withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }));
    // Let the button's little burst play, then close; the deck swipes the card away.
    setTimeout(() => {
      chooseFromProfile(id, direction);
      router.back();
    }, 300);
  }

  const options = <Stack.Screen options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />;

  if (!fontsLoaded) return <View style={s.screen}>{options}</View>;

  if (!item) {
    return (
      <SafeAreaView style={[s.screen, s.missing]}>
        {options}
        <Text style={s.missingText}>This profile isn’t available any more.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={s.missingButton}><Text style={s.missingButtonText}>Back to intros</Text></Pressable>
      </SafeAreaView>
    );
  }

  const { profile } = item;
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {options}
      <PublicMatchProfile
        mode="match"
        onClose={() => router.back()}
        bottomInset={BAR_HEIGHT}
        photos={profile.photos}
        name={profile.name}
        age={profile.age}
        neighborhood={profile.neighborhood}
        craft={profile.craft}
        bio={profile.bio}
        intent={profile.intent}
        voice={profile.voice}
        vignettes={profile.vignettes.slice(0, MAX_VIGNETTES)}
        visibility={profile.visibility}
      />
      <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <PassButton progress={passProgress} burst={passBurst} onPress={() => choose('pass')} />
        <SparkButton progress={sparkProgress} burst={sparkBurst} onPress={() => choose('spark')} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FCF8F7' },
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', gap: 12, paddingHorizontal: 18, paddingTop: 12,
    backgroundColor: 'rgba(252,248,247,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDE3E0',
  },
  missing: { alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  missingText: { color: '#5D4A4C', fontFamily: 'PlusJakartaSans', fontSize: 14, textAlign: 'center' },
  missingButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 99, backgroundColor: '#541827' },
  missingButtonText: { color: '#FFF8F5', fontFamily: 'PlusJakartaSans', fontSize: 12, fontWeight: '600' },
});
