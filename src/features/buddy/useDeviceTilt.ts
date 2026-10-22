import { DeviceMotion } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';

import { tiltFromRotation, type PhoneRotation, type Tilt } from './robot/robotState';

const STILL: Tilt = { pitch: 0, yaw: 0 };

/**
 * Reads the phone's orientation and turns it into a small robot rotation.
 *
 * - The first reading after turning it on is the "resting" pose (calibration), so
 *   however you hold the phone, the robot starts facing you.
 * - Values go into a ref, not React state, so 30 readings a second never re-render
 *   the screen; the 3D scene reads the ref every frame and smooths it.
 */
export function useDeviceTilt(enabled: boolean, active: boolean) {
  const tilt = useRef<Tilt>(STILL);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [calibration, setCalibration] = useState(0);

  useEffect(() => {
    tilt.current = STILL;
    if (!enabled || !active) return;
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    let resting: PhoneRotation | null = null;

    void DeviceMotion.isAvailableAsync().then((ok) => {
      if (cancelled) return;
      setAvailable(ok);
      if (!ok) return;
      DeviceMotion.setUpdateInterval(33);
      subscription = DeviceMotion.addListener((measurement) => {
        const rotation = measurement.rotation;
        if (!rotation || !Number.isFinite(rotation.beta) || !Number.isFinite(rotation.gamma)) return;
        resting ??= { beta: rotation.beta, gamma: rotation.gamma };
        tilt.current = tiltFromRotation(rotation, resting);
      });
    }).catch(() => {
      if (!cancelled) setAvailable(false);
    });

    return () => {
      cancelled = true;
      subscription?.remove();
      tilt.current = STILL;
    };
  }, [enabled, active, calibration]);

  /** Use the current way the phone is held as the new resting pose. */
  const recalibrate = useCallback(() => setCalibration((value) => value + 1), []);

  return { tilt, available, recalibrate };
}
