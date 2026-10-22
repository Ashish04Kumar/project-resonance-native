import { Canvas, Circle, LinearGradient, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/**
 * Swipe feedback for the intro deck.
 *
 * - SwipeVeil sits over the photo: a warm gold glow for Spark or a deep plum shade for
 *   Pass, with a glass badge and an italic line that grow in as the card is dragged.
 * - SparkButton / PassButton come alive while you drag toward them, and give a small
 *   burst when the swipe is sent.
 *
 * All motion is driven by Reanimated shared values on the UI thread:
 * `progress` is 0..1 (how far toward the swipe threshold), `burst` runs 0 -> 1 once
 * when a swipe is sent.
 */

type Kind = 'spark' | 'pass';

const COPY: Record<Kind, { line: string; hint: string }> = {
  spark: { line: 'Send a spark', hint: 'RELEASE TO SEND' },
  pass: { line: 'Not this time', hint: 'RELEASE TO PASS' },
};

/** The photo overlay for one direction. `drag` is the card's horizontal offset in px. */
export function SwipeVeil({ kind, drag, threshold }: { kind: Kind; drag: SharedValue<number>; threshold: number }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const sign = kind === 'spark' ? 1 : -1;
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  // Everything fades and scales in with the drag; the hint appears only past the threshold.
  const veilStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drag.value * sign, [0, threshold * 0.25, threshold], [0, 0.55, 1], Extrapolation.CLAMP),
  }));
  const badgeStyle = useAnimatedStyle(() => {
    const p = interpolate(drag.value * sign, [0, threshold], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(p, [0.08, 0.5], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: (1 - p) * 14 }, { scale: 0.86 + p * 0.14 }],
    };
  });
  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drag.value * sign, [threshold * 0.85, threshold], [0, 1], Extrapolation.CLAMP),
  }));

  const { width, height } = size;
  const warm = kind === 'spark';
  return (
    <Animated.View pointerEvents="none" onLayout={onLayout} style={[StyleSheet.absoluteFill, veilStyle]}>
      {width > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          {/* A wash from the side the card leaves from, so the photo stays visible. */}
          <Rect x={0} y={0} width={width} height={height}>
            <LinearGradient
              start={vec(warm ? 0 : width, 0)}
              end={vec(warm ? width : 0, 0)}
              colors={warm
                ? ['rgba(235,199,122,0.55)', 'rgba(214,120,120,0.22)', 'rgba(214,120,120,0)']
                : ['rgba(24,8,15,0.72)', 'rgba(52,20,33,0.32)', 'rgba(52,20,33,0)']}
            />
          </Rect>
          {/* Soft glow behind the badge. */}
          <Circle cx={width / 2} cy={height * 0.42} r={width * 0.42}>
            <RadialGradient
              c={vec(width / 2, height * 0.42)}
              r={width * 0.42}
              colors={warm ? ['rgba(255,226,160,0.42)', 'rgba(255,226,160,0)'] : ['rgba(20,6,12,0.45)', 'rgba(20,6,12,0)']}
            />
          </Circle>
        </Canvas>
      ) : null}

      <Animated.View style={[s.badgeWrap, badgeStyle]}>
        <View style={[s.badge, warm ? s.badgeWarm : s.badgeCool]}>
          <SymbolView
            name={warm ? { ios: 'sparkle', android: 'auto_awesome', web: 'auto_awesome' } : { ios: 'xmark', android: 'close', web: 'close' }}
            tintColor={warm ? '#FFE3A6' : '#FBEDEE'}
            size={warm ? 30 : 26}
          />
        </View>
        {warm ? <Sparkles drag={drag} threshold={threshold} /> : null}
        <Text style={[s.line, warm ? s.lineWarm : s.lineCool]}>{COPY[kind].line}</Text>
        <Animated.Text style={[s.hint, hintStyle]}>{COPY[kind].hint}</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

/** Three tiny sparkles that drift up and twinkle around the Spark badge. */
const SPARKLES = [
  { x: -54, y: -6, size: 12, delay: 0 },
  { x: 50, y: -22, size: 15, delay: 0.15 },
  { x: 40, y: 30, size: 10, delay: 0.3 },
];

function Sparkles({ drag, threshold }: { drag: SharedValue<number>; threshold: number }) {
  return (
    <>
      {SPARKLES.map((item) => <Sparkle key={`${item.x}`} {...item} drag={drag} threshold={threshold} />)}
    </>
  );
}

function Sparkle({ x, y, size, delay, drag, threshold }: { x: number; y: number; size: number; delay: number; drag: SharedValue<number>; threshold: number }) {
  const style = useAnimatedStyle(() => {
    const p = interpolate(drag.value, [threshold * (0.2 + delay), threshold * (0.8 + delay)], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: p * 0.9,
      transform: [{ translateX: x }, { translateY: y - p * 12 }, { rotate: `${p * 45}deg` }, { scale: 0.6 + p * 0.4 }],
    };
  });
  return (
    <Animated.View style={[s.sparkle, style]}>
      <SymbolView name={{ ios: 'sparkle', android: 'auto_awesome', web: 'auto_awesome' }} tintColor="#FFE7B3" size={size} />
    </Animated.View>
  );
}

type ButtonProps = { progress: SharedValue<number>; burst: SharedValue<number>; onPress: () => void };

/** Send Spark: a gold glow grows behind it and the sparkle turns as you drag right. */
export function SparkButton({ progress, burst, onPress }: ButtonProps) {
  const wrapStyle = useAnimatedStyle(() => {
    const pop = Math.sin(Math.PI * burst.value); // 0 -> 1 -> 0 during the burst
    return { transform: [{ scale: 1 + progress.value * 0.05 + pop * 0.06 }] };
  });
  const glowStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.55 + Math.sin(Math.PI * burst.value) * 0.4,
    transform: [{ scaleX: 1 + progress.value * 0.05 }, { scaleY: 1 + progress.value * 0.22 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 90 + burst.value * 180}deg` }, { scale: 1 + progress.value * 0.3 }],
  }));
  return (
    <Animated.View style={[s.buttonWrap, wrapStyle]}>
      <Animated.View pointerEvents="none" style={[s.sparkGlow, glowStyle]} />
      <BurstSparkles burst={burst} />
      <Pressable accessibilityRole="button" accessibilityLabel="Send a spark to this profile" onPress={onPress} style={({ pressed }) => [s.actionButton, s.sparkButton, pressed && s.pressed]}>
        <Animated.View style={iconStyle}>
          <SymbolView name={{ ios: 'sparkle', android: 'auto_awesome', web: 'auto_awesome' }} tintColor="#EBC77A" size={17} />
        </Animated.View>
        <Text style={s.sparkText}>Send Spark</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Pass: fills with a soft plum tint and the cross turns as you drag left; a ring ripples out when sent. */
export function PassButton({ progress, burst, onPress }: ButtonProps) {
  const wrapStyle = useAnimatedStyle(() => {
    const pop = Math.sin(Math.PI * burst.value);
    return { transform: [{ scale: 1 + progress.value * 0.04 + pop * 0.05 }] };
  });
  const fillStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.14 + Math.sin(Math.PI * burst.value) * 0.1 }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: burst.value > 0 && burst.value < 1 ? (1 - burst.value) * 0.45 : 0,
    transform: [{ scaleX: 1 + burst.value * 0.12 }, { scaleY: 1 + burst.value * 0.5 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-progress.value * 90}deg` }, { scale: 1 + progress.value * 0.2 }],
  }));
  const borderStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <Animated.View style={[s.buttonWrap, wrapStyle]}>
      <Animated.View pointerEvents="none" style={[s.passRing, ringStyle]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Pass on this profile" onPress={onPress} style={({ pressed }) => [s.actionButton, s.passButton, pressed && s.pressed]}>
        <Animated.View pointerEvents="none" style={[s.passFill, fillStyle]} />
        <Animated.View pointerEvents="none" style={[s.passBorder, borderStyle]} />
        <Animated.View style={iconStyle}>
          <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor="#542631" size={17} />
        </Animated.View>
        <Text style={s.passText}>Pass</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Four small sparkles that fly out from the Spark button when a spark is sent. */
const BURST = [
  { angle: -150, distance: 34 },
  { angle: -100, distance: 30 },
  { angle: -60, distance: 36 },
  { angle: -20, distance: 30 },
];

function BurstSparkles({ burst }: { burst: SharedValue<number> }) {
  return (
    <>
      {BURST.map((item) => <BurstSparkle key={item.angle} {...item} burst={burst} />)}
    </>
  );
}

function BurstSparkle({ angle, distance, burst }: { angle: number; distance: number; burst: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = burst.value;
    const radians = (angle * Math.PI) / 180;
    return {
      opacity: t > 0 && t < 1 ? Math.sin(Math.PI * t) : 0,
      transform: [
        { translateX: Math.cos(radians) * distance * t },
        { translateY: Math.sin(radians) * distance * t * 0.7 },
        { rotate: `${t * 120}deg` },
        { scale: 0.5 + t * 0.6 },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[s.burstSparkle, style]}>
      <SymbolView name={{ ios: 'sparkle', android: 'auto_awesome', web: 'auto_awesome' }} tintColor="#D9AE5C" size={11} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  badgeWrap: { position: 'absolute', left: 0, right: 0, top: '26%', alignItems: 'center' },
  badge: { width: 74, height: 74, alignItems: 'center', justifyContent: 'center', borderRadius: 37, borderWidth: 1 },
  badgeWarm: { backgroundColor: 'rgba(255,236,200,0.18)', borderColor: 'rgba(255,226,170,0.7)', shadowColor: '#F2C46B', shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  badgeCool: { backgroundColor: 'rgba(255,240,242,0.12)', borderColor: 'rgba(255,235,238,0.55)' },
  line: { marginTop: 14, fontFamily: 'CormorantGaramondItalic', fontSize: 32, lineHeight: 38, letterSpacing: 0.2, textShadowColor: 'rgba(30,8,16,0.55)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  lineWarm: { color: '#FFF4E2' },
  lineCool: { color: '#FBEDEE' },
  hint: { marginTop: 6, color: 'rgba(255,245,240,0.85)', fontFamily: 'PlusJakartaSans', fontSize: 9, fontWeight: '700', letterSpacing: 2.2 },
  sparkle: { position: 'absolute', top: 30 },
  buttonWrap: { flex: 1 },
  actionButton: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 99, overflow: 'hidden' },
  sparkButton: { backgroundColor: '#4E1524', shadowColor: '#68263B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  sparkGlow: { position: 'absolute', left: 4, right: 4, top: 2, bottom: 2, borderRadius: 99, backgroundColor: '#EBC77A', opacity: 0 },
  burstSparkle: { position: 'absolute', left: '50%', top: 18, marginLeft: -6 },
  passButton: { borderWidth: 1, borderColor: '#EBD8D8', backgroundColor: '#FFF8F6' },
  passFill: { ...StyleSheet.absoluteFill, backgroundColor: '#542631' },
  passBorder: { ...StyleSheet.absoluteFill, borderRadius: 99, borderWidth: 1.5, borderColor: '#8B4554' },
  passRing: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 99, borderWidth: 1.5, borderColor: '#8B4554' },
  pressed: { opacity: 0.8 },
  passText: { color: '#542631', fontFamily: 'PlusJakartaSans', fontSize: 12, fontWeight: '600' },
  sparkText: { color: '#FFF7F3', fontFamily: 'PlusJakartaSans', fontSize: 12, fontWeight: '600' },
});
