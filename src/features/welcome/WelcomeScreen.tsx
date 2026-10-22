import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const COLORS = {
  background: '#FAF7F2',
  wine: '#501C24',
  button: '#521C26',
  ink: '#1C1917',
  muted: '#57534E',
  quiet: '#78716C',
  line: '#D6D3D1',
  badge: '#FDFBF7',
};

export function WelcomeScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    CormorantGaramond: require('../../../assets/fonts/CormorantGaramond[wght].ttf'),
    CormorantGaramondItalic: require('../../../assets/fonts/CormorantGaramond-Italic[wght].ttf'),
    PlusJakartaSans: require('../../../assets/fonts/PlusJakartaSans[wght].ttf'),
  });
  const pressScale = useSharedValue(1);
  const animatedPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  if (!fontsLoaded) {
    return <View style={styles.loadingSurface} />;
  }

  const pressIn = () => {
    pressScale.value = withSpring(0.985, { damping: 18, stiffness: 280, mass: 0.6 });
  };
  const pressOut = () => {
    pressScale.value = withSpring(1, { damping: 18, stiffness: 280, mass: 0.6 });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar hidden />
      <ScrollView
        bounces={false}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.pageContent,
          { minHeight: Math.max(height - insets.bottom, 720) },
        ]}
      >
        <Animated.View entering={FadeIn.duration(380)} style={styles.header}>
          <View style={styles.brand}>
            <Image
              source={require('../../../assets/icons/welcome-loop.svg')}
              style={styles.brandEmblem}
              contentFit="contain"
              accessibilityLabel="Resonance emblem"
            />
            <View style={styles.wordmark}>
              <Text style={styles.wordmarkText}>Resonance</Text>
            </View>
          </View>

        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(560).delay(80).easing(Easing.out(Easing.cubic))}
          style={styles.featureSection}
        >
          <View style={styles.featureCard}>
            <Image
              source={require('../../../assets/images/resonance-welcome-couple.jpeg')}
              style={styles.couplePhoto}
              contentFit="cover"
              allowDownscaling={false}
              transition={180}
              accessibilityLabel="A couple laughing together over coffee"
            />

            <Image
              source={require('../../../assets/icons/welcome-flourish.svg')}
              style={styles.flourish}
              contentFit="contain"
              accessibilityElementsHidden
              importantForAccessibility="no"
            />

            <View style={styles.resonanceBadge}>
              <Image
                source={require('../../../assets/icons/welcome-heart.svg')}
                style={styles.heartIcon}
                contentFit="contain"
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <Text style={styles.resonanceText}>98% Resonance</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(560).delay(170).easing(Easing.out(Easing.cubic))}
          style={styles.footer}
        >
          <Text style={styles.headline}>
            Where depth finds <Text style={styles.headlineAccent}>resonance.</Text>
          </Text>

          <View style={styles.supportingCopy}>
            <Text style={styles.supportingText}>Curated encounters, cultivated with</Text>
            <Text style={styles.supportingText}>intention.</Text>
          </View>

          <Animated.View style={[styles.primaryActionMotion, animatedPressStyle]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get started"
              accessibilityHint="Begins the Resonance onboarding flow"
              onPressIn={pressIn}
              onPressOut={pressOut}
              onPress={() => router.push({ pathname: '/auth', params: { mode: 'signup' } })}
              style={styles.primaryAction}
            >
              <Text style={styles.primaryActionText}>Get started</Text>
              <Image
                source={require('../../../assets/icons/welcome-arrow.svg')}
                style={styles.arrowIcon}
                contentFit="contain"
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </Pressable>
          </Animated.View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            hitSlop={8}
            onPress={() => router.push({ pathname: '/auth', params: { mode: 'signin' } })}
            style={styles.signInAction}
          >
            <Text style={styles.signInPrompt}>Already a member? </Text>
            <Text style={styles.signInLabel}>Sign in</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingSurface: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pageContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    paddingTop: 41,
    paddingBottom: 33,
    paddingHorizontal: 25,
  },
  header: {
    alignItems: 'center',
    paddingTop: 4,
  },
  brand: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  brandEmblem: {
    width: 24,
    height: 16,
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  wordmarkText: {
    color: COLORS.wine,
    fontFamily: 'CormorantGaramond',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.6,
  },
  featureSection: {
    width: '100%',
    paddingVertical: 20,
  },
  featureCard: {
    width: '100%',
    height: 425,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(231, 229, 228, 0.6)',
    backgroundColor: '#E7E5E4',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  couplePhoto: {
    position: 'absolute',
    top: 0,
    left: '-64.83%',
    width: '229.66%',
    height: '100%',
  },
  flourish: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 34,
    height: 42,
    opacity: 0.6,
  },
  resonanceBadge: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'rgba(253, 251, 247, 0.9)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  heartIcon: {
    width: 14,
    height: 14,
  },
  resonanceText: {
    color: COLORS.ink,
    fontFamily: 'PlusJakartaSans',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: -0.275,
    lineHeight: 16.5,
  },
  footer: {
    alignItems: 'center',
    width: '100%',
  },
  headline: {
    color: COLORS.ink,
    fontFamily: 'CormorantGaramond',
    fontSize: 31,
    fontWeight: '600',
    lineHeight: 36.58,
    letterSpacing: -0.775,
    textAlign: 'center',
    includeFontPadding: false,
  },
  headlineAccent: {
    color: COLORS.wine,
    fontFamily: 'CormorantGaramondItalic',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  supportingCopy: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 270,
    minHeight: 69.5,
    marginTop: 0,
  },
  supportingText: {
    color: COLORS.muted,
    fontFamily: 'PlusJakartaSans',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22.75,
    textAlign: 'center',
  },
  primaryActionMotion: {
    width: '100%',
    marginTop: 0,
  },
  primaryAction: {
    width: '100%',
    minHeight: 51,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: COLORS.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  primaryActionText: {
    color: '#FAF6F0',
    fontFamily: 'PlusJakartaSans',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22.5,
  },
  arrowIcon: {
    width: 16,
    height: 16,
  },
  signInAction: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 19,
    minHeight: 20,
  },
  signInPrompt: {
    color: COLORS.quiet,
    fontFamily: 'PlusJakartaSans',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19.5,
  },
  signInLabel: {
    color: '#292524',
    fontFamily: 'PlusJakartaSans',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19.5,
  },
});
