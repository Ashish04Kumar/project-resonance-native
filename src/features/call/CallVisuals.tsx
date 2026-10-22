import { Canvas, Circle, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Reanimated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * Visuals for the voice call: a slow "aurora" backdrop and the central voice orb.
 *
 * Colour tells you who is talking, subtly:
 *   - Synthe speaking -> warm coral / rose / magenta
 *   - you speaking   -> cool teal / sky / lavender
 *   - nobody         -> the calm wine twilight
 * `ai` and `you` are 0..1 voice levels, eased on the UI thread (Reanimated shared values),
 * and every colour below blends between these three palettes. Skia draws the gradients.
 */

const IDLE = ['#5C1A35', '#3A0F24', '#7A2342'];
const AI = ['#FF7A8A', '#E0457B', '#9B4DFF'];
const YOU = ['#4FD1C5', '#5B8DEF', '#B39DFF'];

/** Mix idle -> Synthe -> you for palette slot `slot`, by how strongly each is speaking (worklet). */
function mood(slot: number, ai: number, you: number): string {
  'worklet';
  const aiWeight = Math.min(1, ai * 3.2);
  const youWeight = Math.min(1, you * 3.2) * (1 - aiWeight * 0.85);
  const warm = interpolateColor(aiWeight, [0, 1], [IDLE[slot], AI[slot]]);
  return interpolateColor(youWeight, [0, 1], [warm, YOU[slot]]);
}

function withAlpha(color: string, alpha: number): string {
  'worklet';
  // interpolateColor returns "rgba(r, g, b, a)"; swap in our alpha.
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return color;
  const [r, g, b] = match[1].split(',').map((part) => part.trim());
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type Levels = { ai: SharedValue<number>; you: SharedValue<number> };

/** Full-screen, slowly drifting colour fields behind everything. */
export function CallBackdrop({ ai, you }: Levels) {
  const { width, height } = useWindowDimensions();
  const drift = useSharedValue(0);
  useEffect(() => {
    // One slow back-and-forth loop moves the colour fields (about 14 s each way).
    drift.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [drift]);

  const topCenter = useDerivedValue(() => vec(width * (0.2 + drift.value * 0.25), height * (0.18 + drift.value * 0.06)));
  const midCenter = useDerivedValue(() => vec(width * (0.85 - drift.value * 0.2), height * (0.42 + drift.value * 0.05)));
  const lowCenter = useDerivedValue(() => vec(width * (0.35 + drift.value * 0.2), height * (0.82 - drift.value * 0.05)));
  const energy = useDerivedValue(() => Math.min(1, Math.max(ai.value, you.value) * 2.5));
  const topColors = useDerivedValue(() => [withAlpha(mood(0, ai.value, you.value), 0.30 + energy.value * 0.18), 'rgba(20, 5, 12, 0)']);
  const midColors = useDerivedValue(() => [withAlpha(mood(1, ai.value, you.value), 0.26 + energy.value * 0.16), 'rgba(20, 5, 12, 0)']);
  const lowColors = useDerivedValue(() => [withAlpha(mood(2, ai.value, you.value), 0.22 + energy.value * 0.14), 'rgba(20, 5, 12, 0)']);
  const big = Math.max(width, height);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height} color="#14050C" />
      <Circle c={topCenter} r={big * 0.62}>
        <RadialGradient c={topCenter} r={big * 0.62} colors={topColors} />
      </Circle>
      <Circle c={midCenter} r={big * 0.55}>
        <RadialGradient c={midCenter} r={big * 0.55} colors={midColors} />
      </Circle>
      <Circle c={lowCenter} r={big * 0.6}>
        <RadialGradient c={lowCenter} r={big * 0.6} colors={lowColors} />
      </Circle>
    </Canvas>
  );
}

const ORB = 300; // canvas size
const C = ORB / 2;
const BAR_SHAPE = [0.38, 0.55, 0.72, 0.9, 1, 0.84, 0.7, 0.92, 0.8, 0.96, 0.7, 0.52, 0.34];

/** The living orb: glows and breathes with the voice, ripples outward while someone talks. */
export function VoiceOrb({ ai, you, bars }: Levels & { bars: number[] }) {
  const ripple = useSharedValue(0);
  useEffect(() => {
    // A steady 2.4 s ripple cycle; it's only visible while someone is speaking.
    ripple.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false);
  }, [ripple]);

  const level = useDerivedValue(() => Math.min(1, Math.max(ai.value, you.value) * 2.2));
  const halo = useDerivedValue(() => [withAlpha(mood(0, ai.value, you.value), 0.55 + level.value * 0.3), withAlpha(mood(1, ai.value, you.value), 0.18), 'rgba(20, 5, 12, 0)']);
  const core = useDerivedValue(() => [mood(0, ai.value, you.value), mood(1, ai.value, you.value), '#2A0A18']);
  const haloRadius = useDerivedValue(() => 112 + level.value * 18);
  const coreRadius = useDerivedValue(() => 58 + level.value * 6);
  // Three ripples, a third of a cycle apart, growing outward and fading as they grow.
  const rippleColor = useDerivedValue(() => mood(0, ai.value, you.value));
  const r1 = useDerivedValue(() => 66 + (ripple.value % 1) * 78);
  const r2 = useDerivedValue(() => 66 + ((ripple.value + 1 / 3) % 1) * 78);
  const r3 = useDerivedValue(() => 66 + ((ripple.value + 2 / 3) % 1) * 78);
  const o1 = useDerivedValue(() => (1 - (ripple.value % 1)) * 0.45 * level.value);
  const o2 = useDerivedValue(() => (1 - ((ripple.value + 1 / 3) % 1)) * 0.45 * level.value);
  const o3 = useDerivedValue(() => (1 - ((ripple.value + 2 / 3) % 1)) * 0.45 * level.value);
  const breathe = useAnimatedStyle(() => ({ transform: [{ scale: 1 + level.value * 0.04 }] }));
  const barColor = useDerivedValue(() => withAlpha(interpolateColor(Math.min(1, Math.max(ai.value, you.value) * 3), [0, 1], ['#F3D6DE', '#FFFFFF']), 0.92));
  const barStyle = useAnimatedStyle(() => ({ backgroundColor: barColor.value }));

  return (
    <Reanimated.View style={[styles.orb, breathe]}>
      <Canvas style={styles.orbCanvas}>
        <Circle c={vec(C, C)} r={haloRadius}>
          <RadialGradient c={vec(C, C)} r={haloRadius} colors={halo} positions={[0, 0.55, 1]} />
        </Circle>
        <Circle c={vec(C, C)} r={r1} color={rippleColor} opacity={o1} style="stroke" strokeWidth={1.5} />
        <Circle c={vec(C, C)} r={r2} color={rippleColor} opacity={o2} style="stroke" strokeWidth={1.5} />
        <Circle c={vec(C, C)} r={r3} color={rippleColor} opacity={o3} style="stroke" strokeWidth={1.5} />
        <Circle c={vec(C, C)} r={coreRadius}>
          <RadialGradient c={vec(C - 18, C - 22)} r={96} colors={core} positions={[0, 0.55, 1]} />
        </Circle>
        <Circle c={vec(C - 16, C - 20)} r={34} opacity={0.6}>
          <RadialGradient c={vec(C - 16, C - 20)} r={34} colors={['rgba(255, 240, 245, 0.32)', 'rgba(255, 240, 245, 0)']} />
        </Circle>
      </Canvas>
      <View pointerEvents="none" style={styles.bars}>
        {bars.map((value, index) => (
          <Reanimated.View key={index} style={[styles.bar, barStyle, { height: Math.round(5 + value * 40 * BAR_SHAPE[index]) }]} />
        ))}
      </View>
    </Reanimated.View>
  );
}

/** Small coloured dot whose colour follows who is speaking. */
export function SpeakerDot({ ai, you }: Levels) {
  const style = useAnimatedStyle(() => ({ backgroundColor: mood(0, ai.value, you.value) }));
  return <Reanimated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  orb: { width: ORB, height: ORB, alignItems: 'center', justifyContent: 'center' },
  orbCanvas: { width: ORB, height: ORB },
  bars: { position: 'absolute', width: 84, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  bar: { width: 3.5, borderRadius: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
