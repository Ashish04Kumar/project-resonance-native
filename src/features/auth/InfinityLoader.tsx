import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { View } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { BRAND, LOOP_PATH } from '@/theme/brand';

const LOOP = Skia.Path.MakeFromSVGString(LOOP_PATH)!;
const STROKE = 1.54286;
const CYCLE_MS = 2600;

type Props = { size?: number };

/**
 * The Resonance loop emblem as an endless loader: a wine stroke draws the loop,
 * then erases it from the start, over a faint track, forever.
 */
export function InfinityLoader({ size = 112 }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(progress);
  }, [progress]);

  // Worklets run on the UI thread. The first half of each cycle draws, the second half erases;
  // each half is eased on its own so the stroke glides in and out instead of moving at one speed.
  const end = useDerivedValue(() => {
    const t = Math.min(progress.value * 2, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  });
  const start = useDerivedValue(() => {
    const t = Math.max(progress.value * 2 - 1, 0);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  });

  const scale = size / 24;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Canvas style={{ width: size, height: (size * 16) / 24 }}>
        <Group transform={[{ scale }]}>
          <Path path={LOOP} style="stroke" strokeWidth={STROKE} color={BRAND.line} opacity={0.6} strokeCap="round" strokeJoin="round" />
          <Path
            path={LOOP}
            style="stroke"
            strokeWidth={STROKE}
            color={BRAND.wine}
            start={start}
            end={end}
            strokeCap="round"
            strokeJoin="round"
          />
        </Group>
      </Canvas>
    </View>
  );
}
