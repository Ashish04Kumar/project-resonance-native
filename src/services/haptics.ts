import { Platform, Vibration } from 'react-native';

/**
 * App-wide haptic patterns.
 *
 * Android: each pattern starts with one of the system's tuned effects (expo-haptics
 * performAndroidHapticsAsync: Confirm, Reject, Clock Tick, …) for a crisp start, then a
 * short pulse from React Native's Vibration at the phone's normal strength for body
 * (expo-haptics' own Android taps are very weak, at most about 27% strength).
 *
 * What makes it feel premium rather than buzzy: every pulse is a short, crisp tap
 * (9-18 ms). Where a moment should feel longer or richer, it gets a quick second or
 * third tap (an echo) instead of one long buzz. The VIBRATE permission comes with
 * expo-haptics.
 *
 * iOS: impact / notification taps from expo-haptics (Vibration can't do short taps there).
 *
 * expo-haptics has native code, so a development build made before it was added
 * doesn't contain it; then the system effects (and all iOS taps) are skipped instead of
 * crashing the screen.
 */
type HapticsModule = typeof import('expo-haptics');
type AndroidEffect = HapticsModule['AndroidHaptics'][keyof HapticsModule['AndroidHaptics']];

function loadHaptics(): HapticsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-haptics') as HapticsModule;
  } catch {
    if (__DEV__) console.warn('expo-haptics is not in this build; some haptics are off until you rebuild.');
    return null;
  }
}

const H = loadHaptics();
const isAndroid = Platform.OS === 'android';
const androidApi = isAndroid ? Number(Platform.Version) : 0;

type Pattern = {
  /** System effect for the crisp start, and the Android version it needs. */
  effect?: (h: HapticsModule) => { effect: AndroidEffect; minApi: number };
  /** Android pulse pattern in ms: [wait, on, wait, on, …]. */
  pulses: number[];
  /** iOS taps as [ms after the previous tap, tap] pairs. */
  ios: [number, (h: HapticsModule) => Promise<void>][];
};

function play(pattern: Pattern): void {
  if (isAndroid) {
    const start = H && pattern.effect ? pattern.effect(H) : null;
    if (H && start && androidApi >= start.minApi) {
      void H.performAndroidHapticsAsync(start.effect).catch(() => undefined);
      // A new vibration replaces the one before it, so let the short effect finish first.
      setTimeout(() => Vibration.vibrate(pattern.pulses), 12);
    } else {
      Vibration.vibrate(pattern.pulses);
    }
    return;
  }
  if (!H) return;
  let at = 0;
  for (const [gap, tap] of pattern.ios) {
    at += gap; // each delay counts from the tap before it
    const run = () => void tap(H).catch(() => undefined);
    if (at === 0) run();
    else setTimeout(run, at);
  }
}

const tap = (style: 'Light' | 'Medium' | 'Heavy' | 'Soft' | 'Rigid') => (h: HapticsModule) => h.impactAsync(h.ImpactFeedbackStyle[style]);

/** Swipe toward Spark reaches the point where letting go sends it: a crisp, bright tick. */
export function sparkThreshold(): void {
  play({ effect: (h) => ({ effect: h.AndroidHaptics.Toggle_On, minApi: 34 }), pulses: [0, 14], ios: [[0, tap('Rigid')]] });
}

/** Swipe toward Pass reaches the send point: a slightly softer tick. */
export function passThreshold(): void {
  play({ effect: (h) => ({ effect: h.AndroidHaptics.Toggle_Off, minApi: 34 }), pulses: [0, 11], ios: [[0, tap('Medium')]] });
}

/** A spark is sent: a full tap, then two quick light ticks, like a twinkle. */
export function sparkSent(): void {
  play({
    effect: (h) => ({ effect: h.AndroidHaptics.Confirm, minApi: 30 }),
    pulses: [0, 18, 65, 10, 55, 9],
    ios: [[0, tap('Heavy')], [110, tap('Rigid')], [80, tap('Light')]],
  });
}

/** A profile is passed: a tap with a soft echo, like settling down. */
export function passSent(): void {
  play({ effect: (h) => ({ effect: h.AndroidHaptics.Gesture_End, minApi: 30 }), pulses: [0, 16, 50, 9], ios: [[0, tap('Medium')], [70, tap('Soft')]] });
}

/** Buddy starts thinking: two light ticks, like "hmm…". */
export function buddyThinking(): void {
  play({
    effect: (h) => ({ effect: h.AndroidHaptics.Clock_Tick, minApi: 21 }),
    pulses: [0, 12, 150, 12],
    ios: [[0, tap('Medium')], [150, tap('Medium')]],
  });
}

/** Buddy starts speaking: a warm tap with a light echo. */
export function buddySpeaking(): void {
  play({ effect: (h) => ({ effect: h.AndroidHaptics.Confirm, minApi: 30 }), pulses: [0, 18, 70, 9], ios: [[0, tap('Heavy')], [80, tap('Light')]] });
}

/** Buddy hits an error: three quick taps, the last a little firmer. */
export function buddyError(): void {
  play({
    effect: (h) => ({ effect: h.AndroidHaptics.Reject, minApi: 30 }),
    pulses: [0, 14, 70, 14, 70, 18],
    ios: [[0, (h) => h.notificationAsync(h.NotificationFeedbackType.Error)]],
  });
}
