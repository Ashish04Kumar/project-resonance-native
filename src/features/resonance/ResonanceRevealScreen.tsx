import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

export function ResonanceRevealScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [fontsLoaded] = useFonts({
    CormorantGaramond: require('../../../assets/fonts/CormorantGaramond[wght].ttf'),
    CormorantGaramondItalic: require('../../../assets/fonts/CormorantGaramond-Italic[wght].ttf'),
    PlusJakartaSans: require('../../../assets/fonts/PlusJakartaSans[wght].ttf'),
  });

  if (!fontsLoaded) return <View style={s.loading} />;

  return (
    <View style={s.screen}>
      <Image source={require('../../../assets/images/screen.png')} style={s.background} contentFit="cover" transition={250} />
      <View pointerEvents="none" style={s.artTint} />

      <View style={s.safeContent}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to landing page" onPress={() => router.replace('/landing')} style={s.backButton}>
          <SymbolView name={{ ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="#F8DCE7" size={22} />
        </Pressable>
        <Animated.View entering={FadeInDown.duration(700).delay(240).easing(Easing.out(Easing.cubic))} style={[s.message, { marginBottom: Math.max(height * 0.13, insets.bottom + 56) }]}>
          <Text style={s.headline}>We heard your story.</Text>
          <Text style={s.headlineItalic}>Now let&apos;s find your person.</Text>
          <Text style={s.description}>
            Your words, your choices, and your dreams—we have them all. Now we are searching for people you will genuinely enjoy talking to.
          </Text>
        </Animated.View>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#1A0718' },
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#1A0718' },
  background: { ...StyleSheet.absoluteFill, opacity: 0.78 },
  artTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(31, 3, 24, 0.38)' },
  safeContent: { flex: 1, paddingHorizontal: 23, paddingTop: 8 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12, marginLeft: -10, zIndex: 1 },
  message: { marginTop: 'auto' },
  headline: { color: '#F8DCE7', fontFamily: 'CormorantGaramond', fontSize: 33, lineHeight: 38, fontWeight: '700', letterSpacing: -0.45 },
  headlineItalic: { marginTop: -2, color: '#F4A9BC', fontFamily: 'CormorantGaramondItalic', fontSize: 32, lineHeight: 39, letterSpacing: -0.35 },
  description: { marginTop: 14, color: '#D8C3D1', fontFamily: 'PlusJakartaSans', fontSize: 14, lineHeight: 24 },
});
