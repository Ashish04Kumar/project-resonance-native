import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// A light rose of the theme's wine, so the moving line stays quiet.
const SNAKE = '#DDB4BC';

type Props = {
  /** Corner radius of the box it sits in. */
  radius: number;
  strokeWidth?: number;
  /** Share of the border the snake covers (0..1). */
  length?: number;
  /** Time for one full lap. */
  lapMs?: number;
};

/**
 * A short wine stroke that keeps travelling around a rounded border.
 * Fill its parent (which must clip, e.g. overflow hidden); it ignores touches.
 */
export function SnakeBorder({ radius, strokeWidth = 2, length = 0.16, lapMs = 3600 }: Props) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: lapMs, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(progress);
  }, [progress, lapMs]);

  // The rounded rectangle traced along the middle of the border line.
  const border = useMemo(() => {
    if (!size) return null;
    const inset = strokeWidth / 2;
    const rect = Skia.XYWHRect(inset, inset, size.width - strokeWidth, size.height - strokeWidth);
    return Skia.Path.Make().addRRect(Skia.RRectXY(rect, radius - inset, radius - inset));
  }, [size, strokeWidth, radius]);

  // Worklets on the UI thread. The snake runs from `progress` to `progress + length`;
  // when that passes the end of the path, the rest is drawn from the start, so it never breaks.
  const headEnd = useDerivedValue(() => Math.min(progress.value + length, 1));
  const wrapEnd = useDerivedValue(() => Math.max(progress.value + length - 1, 0));
  const wrapOpacity = useDerivedValue(() => (progress.value + length > 1 ? 1 : 0));

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
    >
      {border ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Path path={border} style="stroke" strokeWidth={strokeWidth} strokeCap="round" color={SNAKE} start={progress} end={headEnd} />
          <Path path={border} style="stroke" strokeWidth={strokeWidth} strokeCap="round" color={SNAKE} start={0} end={wrapEnd} opacity={wrapOpacity} />
        </Canvas>
      ) : null}
    </View>
  );
}
