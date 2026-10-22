import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { BRAND, useBrandFonts } from '@/theme/brand';

import { isProfileComplete } from '@/features/profile/profileStatus';

import { InfinityLoader } from './InfinityLoader';
import { restoreSession } from './session';

/** Signed in with a finished profile: Buddy. Signed in without one: Edit Story. Otherwise: Welcome. */
async function firstScreen(): Promise<'/landing' | '/edit-profile' | '/welcome'> {
  const session = await restoreSession().catch(() => null);
  if (!session) return '/welcome';
  return (await isProfileComplete(session.user.id)) ? '/landing' : '/edit-profile';
}

/** Long enough for the loop to read as intentional, short enough not to feel slow. */
const MIN_VISIBLE_MS = 1400;

/** First screen on every launch: shows the loop while it checks the session and the profile. */
export function LoaderScreen() {
  const fontsLoaded = useBrandFonts();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const startedAt = Date.now();
    void firstScreen().then((route) => {
      if (cancelled) return;
      const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
      timer = setTimeout(() => router.replace(route), wait);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <View style={styles.screen}>
      <Animated.View entering={FadeIn.duration(420)} style={styles.center}>
        <InfinityLoader size={112} />
        {fontsLoaded ? (
          <Animated.View entering={FadeIn.duration(520).delay(160)} style={styles.brand}>
            <View style={styles.wordmark}>
              <Text style={styles.wordmarkText}>Resonance</Text>
            </View>
            <Text style={styles.tagline}>Where depth finds resonance.</Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 28,
  },
  brand: {
    alignItems: 'center',
    gap: 6,
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  wordmarkText: {
    color: BRAND.wine,
    fontFamily: 'CormorantGaramond',
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  tagline: {
    color: BRAND.quiet,
    fontFamily: 'CormorantGaramondItalic',
    fontSize: 17,
    lineHeight: 22,
  },
});
