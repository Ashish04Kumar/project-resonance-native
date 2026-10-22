import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { setCallLanguage, type CallLanguage } from '../call/callSession';

type Language = 'English' | 'Hinglish';
const OPTIONS: ReadonlyArray<{ language: Language; description: string }> = [
  { language: 'English', description: 'Natural & reflective' },
  { language: 'Hinglish', description: 'Conversational code-switching' },
];
const C = { background: '#FBF8F5', wine: '#541C24', title: '#2D1619', body: '#716463' };

export function LanguageCadenceScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [language, setLanguage] = useState<Language>('English');
  const [languageLoaded, setLanguageLoaded] = useState(false);
  const [fontsLoaded] = useFonts({
    CormorantGaramond: require('../../../assets/fonts/CormorantGaramond[wght].ttf'),
    PlusJakartaSans: require('../../../assets/fonts/PlusJakartaSans[wght].ttf'),
  });
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem('project-synq.call-language').then((saved) => {
      if (!active) return;
      if (saved === 'english' || saved === 'hinglish') setLanguage(saved === 'english' ? 'English' : 'Hinglish');
      setLanguageLoaded(true);
    }).catch(() => { if (active) setLanguageLoaded(true); });
    return () => { active = false; };
  }, []);

  if (!fontsLoaded) return <View style={styles.loading} />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView bounces={false} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.page, { minHeight: Math.max(height - insets.bottom, 720) }]}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.headerButton}>
            <Image source={require('../../../assets/icons/language-back.svg')} style={styles.headerIcon} contentFit="contain" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Close onboarding" hitSlop={8}
            onPress={() => router.replace('/')} style={styles.headerButton}>
            <Image source={require('../../../assets/icons/language-close.svg')} style={styles.headerIcon} contentFit="contain" />
          </Pressable>
        </Animated.View>

        <View style={styles.main}>
          <View style={styles.upper}>
            <Animated.View entering={FadeInDown.duration(460).delay(100).easing(Easing.out(Easing.cubic))} style={styles.intro}>
              <Text style={styles.heading}>Choose your cadence</Text>
              <Text style={styles.description}>Select the dialogue flow that feels most natural. Switch anytime.</Text>
            </Animated.View>
            <View style={styles.options}>
              {OPTIONS.map((option, index) => <LanguageOption key={option.language} {...option}
                selected={language === option.language} onPress={() => setLanguage(option.language)} delay={150 + index * 70} />)}
            </View>
            <Animated.View entering={FadeInDown.duration(480).delay(300).easing(Easing.out(Easing.cubic))} style={styles.listening}>
              <View style={styles.listeningInfo}>
                <View style={styles.audioCircle}>
                  <Image source={require('../../../assets/icons/language-audio.svg')} style={styles.audioIcon} contentFit="contain" />
                </View>
                <View style={styles.listeningCopy}>
                  <Text style={styles.listeningTitle}>Adaptive Listening Tuned</Text>
                  <Text style={styles.listeningDescription}>Reflects your pace, pauses &amp; nuances</Text>
                </View>
              </View>
              <View style={styles.wave} accessibilityLabel="Sound wave">
                {[12, 20, 8, 24, 16, 6].map((h, i) => <View key={i} style={[styles.waveBar, { height: h }]} />)}
              </View>
            </Animated.View>
          </View>
          <Animated.View entering={FadeInDown.duration(500).delay(360).easing(Easing.out(Easing.cubic))} style={styles.footer}>
            <ContinueButton language={language} languageLoaded={languageLoaded} />
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LanguageOption({ language, description, selected, onPress, delay }: {
  language: Language; description: string; selected: boolean; onPress: () => void; delay: number;
}) {
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View entering={FadeInDown.duration(440).delay(delay).easing(Easing.out(Easing.cubic))} style={[styles.optionMotion, motion]}>
      <Pressable accessibilityRole="radio" accessibilityLabel={language} accessibilityState={{ selected }} onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.99, { damping: 20, stiffness: 300, mass: 0.6 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 20, stiffness: 300, mass: 0.6 }); }}
        style={[styles.option, selected ? styles.optionSelected : styles.optionUnselected]}>
        <View style={styles.optionCopy}>
          <Text style={styles.optionTitle}>{language}</Text>
          <Text style={[styles.optionDescription, !selected && styles.optionDescriptionMuted]}>{description}</Text>
        </View>
        <View style={[styles.radio, selected ? styles.radioSelected : styles.radioUnselected]}>
          {selected ? <Image source={require('../../../assets/icons/language-check.svg')} style={styles.check} contentFit="contain" /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function ContinueButton({ language, languageLoaded }: { language: Language; languageLoaded: boolean }) {
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.continueMotion, motion]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Continue to Profile Setup"
        disabled={!languageLoaded}
        onPress={() => {
          const mode: CallLanguage = language.toLowerCase() as CallLanguage;
          setCallLanguage(mode);
          void AsyncStorage.setItem('project-synq.call-language', mode).finally(() => router.push('/edit-profile'));
        }}
        onPressIn={() => { scale.value = withSpring(0.985, { damping: 18, stiffness: 280, mass: 0.6 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 280, mass: 0.6 }); }}
        style={styles.continueButton}>
        <Text style={styles.continueText}>Continue to Profile Setup</Text>
        <Image source={require('../../../assets/icons/language-arrow.svg')} style={styles.arrow} contentFit="contain" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: C.background },
  safe: { flex: 1, backgroundColor: C.background },
  page: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32, backgroundColor: C.background },
  header: { width: '100%', minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { width: 20, height: 20 },
  main: { flex: 1, justifyContent: 'space-between', paddingTop: 20 },
  upper: { alignItems: 'stretch', gap: 20 },
  intro: { alignItems: 'center', gap: 10, paddingHorizontal: 4, paddingTop: 4 },
  heading: { color: C.title, fontFamily: 'CormorantGaramond', fontSize: 31, fontWeight: '500', letterSpacing: -0.775, lineHeight: 36, textAlign: 'center', includeFontPadding: false },
  description: { maxWidth: 270, color: C.body, fontFamily: 'PlusJakartaSans', fontSize: 13, lineHeight: 21.13, textAlign: 'center', includeFontPadding: false },
  options: { gap: 14, paddingTop: 8 },
  optionMotion: { width: '100%' },
  option: { width: '100%', minHeight: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderWidth: 1, borderRadius: 16 },
  optionSelected: { borderColor: '#DEB7B3', backgroundColor: '#F9F0EC', shadowColor: C.wine, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  optionUnselected: { borderColor: 'transparent', backgroundColor: '#FAF6F3' },
  optionCopy: { flex: 1, gap: 4 },
  optionTitle: { color: '#3B191E', fontFamily: 'CormorantGaramond', fontSize: 20, fontWeight: '600', lineHeight: 25, includeFontPadding: false },
  optionDescription: { color: '#7B6866', fontFamily: 'PlusJakartaSans', fontSize: 12, lineHeight: 16, includeFontPadding: false },
  optionDescriptionMuted: { color: '#8E807E' },
  radio: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 999, marginLeft: 12 },
  radioSelected: { backgroundColor: '#521C24', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1, elevation: 1 },
  radioUnselected: { backgroundColor: '#EADFD9' },
  check: { width: 14, height: 14 },
  listening: { minHeight: 68, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16, backgroundColor: '#F4EBE6' },
  listeningInfo: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  audioCircle: { width: 36, height: 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: C.wine },
  audioIcon: { width: 16, height: 16 },
  listeningCopy: { flex: 1, gap: 1 },
  listeningTitle: { color: '#301B1E', fontFamily: 'PlusJakartaSans', fontSize: 12, fontWeight: '700', letterSpacing: -0.3, lineHeight: 16 },
  listeningDescription: { color: '#866D6A', fontFamily: 'PlusJakartaSans', fontSize: 10, lineHeight: 15 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 4, paddingLeft: 8 },
  waveBar: { width: 2, borderRadius: 999, backgroundColor: '#75262E' },
  footer: { width: '100%', paddingTop: 16 },
  continueMotion: { width: '100%' },
  continueButton: { width: '100%', minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: '#521C24', shadowColor: C.wine, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  continueText: { color: '#FFF', fontFamily: 'PlusJakartaSans', fontSize: 12, letterSpacing: 0.3, lineHeight: 16 },
  arrow: { width: 14, height: 14 },
});
