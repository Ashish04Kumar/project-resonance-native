import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isProfileComplete } from '@/features/profile/profileStatus';
import { BRAND, useBrandFonts } from '@/theme/brand';

import { AuthError, signIn, signUp } from './authApi';
import { saveSession } from './session';

type Mode = 'signin' | 'signup';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validate(mode: Mode, name: string, email: string, password: string): string | null {
  if (mode === 'signup' && !name.trim()) return 'Enter your name.';
  if (!EMAIL.test(email.trim())) return 'Enter a valid email address.';
  if (mode === 'signup' && password.length < 8) return 'Use a password with at least 8 characters.';
  if (!password) return 'Enter your password.';
  return null;
}

export function AuthScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const fontsLoaded = useBrandFonts();
  const [mode, setMode] = useState<Mode>(params.mode === 'signup' ? 'signup' : 'signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  if (!fontsLoaded) return <View style={styles.blank} />;

  const switchMode = (next: Mode) => {
    if (busy) return;
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const submit = async () => {
    if (busy) return;
    const problem = validate(mode, name, email, password);
    setNotice(null);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const tokens =
        mode === 'signup'
          ? await signUp(name.trim(), email.trim(), password)
          : await signIn(email.trim(), password);
      await saveSession(tokens);
      // Someone who already finished their profile goes straight to Buddy; everyone else
      // continues onboarding (Language & Cadence, then Edit Story).
      router.replace((await isProfileComplete(tokens.user.id)) ? '/landing' : '/language-cadence');
    } catch (caught) {
      const message = caught instanceof AuthError ? caught.message : 'Something went wrong. Please try again.';
      setError(message);
      if (caught instanceof AuthError && caught.status === 409) setMode('signin');
    } finally {
      setBusy(false);
    }
  };

  const isSignUp = mode === 'signup';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View entering={FadeIn.duration(320)} style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={12}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
              style={styles.backButton}
            >
              <Image source={require('../../../assets/icons/language-back.svg')} style={styles.backIcon} contentFit="contain" />
            </Pressable>
            <Image
              source={require('../../../assets/icons/welcome-loop.svg')}
              style={styles.emblem}
              contentFit="contain"
              accessibilityLabel="Resonance emblem"
            />
            <View style={styles.backButton} />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(480).delay(60)} layout={LinearTransition.duration(220)}>
            <Text style={styles.title}>{isSignUp ? 'Create your account' : 'Welcome back'}</Text>
            <Text style={styles.subtitle}>
              {isSignUp ? 'A few details and you’re in.' : 'Sign in to pick up where you left off.'}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(480).delay(120)} style={styles.form} layout={LinearTransition.duration(220)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
              onPress={() => {
                setError(null);
                setNotice('Google sign-in is coming soon. For now, use your email below.');
              }}
              style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
            >
              <Image source={require('../../../assets/icons/google-g.svg')} style={styles.googleIcon} contentFit="contain" />
              <Text style={styles.googleText}>Continue with Google</Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.segment} accessibilityRole="tablist">
              {(['signin', 'signup'] as const).map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === option }}
                  onPress={() => switchMode(option)}
                  style={[styles.segmentItem, mode === option && styles.segmentItemActive]}
                >
                  <Text style={[styles.segmentText, mode === option && styles.segmentTextActive]}>
                    {option === 'signin' ? 'Sign in' : 'Create account'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {isSignUp ? (
              <Animated.View entering={FadeIn.duration(220)} style={styles.field}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="What should we call you?"
                  placeholderTextColor={BRAND.quiet}
                  style={styles.input}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="next"
                  maxLength={60}
                  onSubmitEditing={() => emailRef.current?.focus()}
                  editable={!busy}
                />
              </Animated.View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                ref={emailRef}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={BRAND.quiet}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
                maxLength={254}
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!busy}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
                  placeholderTextColor={BRAND.quiet}
                  style={[styles.input, styles.passwordInput]}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  textContentType={isSignUp ? 'newPassword' : 'password'}
                  returnKeyType="go"
                  maxLength={128}
                  onSubmitEditing={() => void submit()}
                  editable={!busy}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  hitSlop={8}
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.showButton}
                >
                  <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
            </View>

            {error ? (
              <Animated.View entering={FadeIn.duration(180)} style={styles.errorBox} accessibilityLiveRegion="polite">
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}
            {notice ? (
              <Animated.View entering={FadeIn.duration(180)} style={styles.noticeBox} accessibilityLiveRegion="polite">
                <Text style={styles.noticeText}>{notice}</Text>
              </Animated.View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isSignUp ? 'Create account' : 'Sign in'}
              accessibilityState={{ busy, disabled: busy }}
              disabled={busy}
              onPress={() => void submit()}
              style={({ pressed }) => [styles.primaryButton, (pressed || busy) && styles.pressed]}
            >
              {busy ? (
                <ActivityIndicator color={BRAND.surface} />
              ) : (
                <Text style={styles.primaryText}>{isSignUp ? 'Create account' : 'Sign in'}</Text>
              )}
            </Pressable>

            <Pressable onPress={() => switchMode(isSignUp ? 'signin' : 'signup')} hitSlop={8} style={styles.switchRow}>
              <Text style={styles.switchPrompt}>{isSignUp ? 'Already a member? ' : 'New here? '}</Text>
              <Text style={styles.switchLabel}>{isSignUp ? 'Sign in' : 'Create an account'}</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: BRAND.background },
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: BRAND.background },
  content: { flexGrow: 1, paddingHorizontal: 25, paddingTop: 12, paddingBottom: 32, gap: 28 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { width: 20, height: 20 },
  emblem: { width: 36, height: 24 },
  title: {
    color: BRAND.ink,
    fontFamily: 'CormorantGaramond',
    fontSize: 36,
    fontWeight: '600',
    lineHeight: 42,
    letterSpacing: -0.6,
  },
  subtitle: { color: BRAND.muted, fontFamily: 'PlusJakartaSans', fontSize: 15, lineHeight: 22, marginTop: 6 },
  form: { gap: 16 },
  googleButton: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.line,
    backgroundColor: BRAND.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleIcon: { width: 18, height: 18 },
  googleText: { color: BRAND.ink, fontFamily: 'PlusJakartaSans', fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: BRAND.line },
  dividerText: { color: BRAND.quiet, fontFamily: 'PlusJakartaSans', fontSize: 13 },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#F1EDE6',
    borderRadius: 14,
    padding: 4,
  },
  segmentItem: { flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentItemActive: {
    backgroundColor: BRAND.surface,
    shadowColor: BRAND.ink,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: { color: BRAND.quiet, fontFamily: 'PlusJakartaSans', fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: BRAND.wine },
  field: { gap: 6 },
  label: { color: BRAND.muted, fontFamily: 'PlusJakartaSans', fontSize: 13, fontWeight: '600' },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.line,
    backgroundColor: BRAND.surface,
    paddingHorizontal: 16,
    color: BRAND.ink,
    fontFamily: 'PlusJakartaSans',
    fontSize: 16,
  },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 64 },
  showButton: { position: 'absolute', right: 14, paddingVertical: 6 },
  showText: { color: BRAND.wine, fontFamily: 'PlusJakartaSans', fontSize: 13, fontWeight: '600' },
  errorBox: { backgroundColor: BRAND.errorSurface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  errorText: { color: BRAND.error, fontFamily: 'PlusJakartaSans', fontSize: 14, lineHeight: 20 },
  noticeBox: { backgroundColor: '#F1EDE6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  noticeText: { color: BRAND.muted, fontFamily: 'PlusJakartaSans', fontSize: 14, lineHeight: 20 },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: BRAND.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryText: { color: BRAND.surface, fontFamily: 'PlusJakartaSans', fontSize: 16, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 4 },
  switchPrompt: { color: BRAND.quiet, fontFamily: 'PlusJakartaSans', fontSize: 14 },
  switchLabel: { color: BRAND.wine, fontFamily: 'PlusJakartaSans', fontSize: 14, fontWeight: '600' },
});
