/* eslint-disable react/no-unknown-property -- these are three.js props read by react-three-fiber, not DOM attributes. */
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { Color, Mesh, type BufferGeometry, type Group, type ShaderMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { RobotFace } from './RobotFace';
import { MODEL_CENTER, prepareRobotGeometry } from './robotModel';
import { MAX_FRAME_STEP, expressionFor, faceFor, frameIntervalMs, lookFor, smoothToward, type RobotSignals, type RobotState, type Tilt } from './robotState';

// Head only (screen, ears, antennae): cut from the optimised mobile copy, about 33k
// triangles. The original gg2.glb is kept untouched. See docs/screens/buddy.md.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro bundles the .glb as an asset.
const MODEL = require('@/assets/avatar-3d/gg2-head.glb') as number;

type Props = {
  signals: RefObject<RobotSignals>;
  tilt: RefObject<Tilt>;
  /** False when the page is hidden: the render loop stops to save battery. */
  active: boolean;
  /** Smaller idle motion when the phone's "reduce motion" setting is on. */
  reduceMotion: boolean;
  onLoadError: (message: string) => void;
  /** Theme: the scene's background colour, and the glow behind the head (r, g, b in 0..1) and its strength. */
  scene: string;
  halo: [number, number, number];
  haloStrength: number;
};

/** Loads the robot geometry once. three.js parses it on the JS thread (a short one-time cost). */
function useRobotGeometry(onLoadError: (message: string) => void): BufferGeometry | null {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
  const reportError = useRef(onLoadError);
  useEffect(() => {
    reportError.current = onLoadError;
  }, [onLoadError]);

  useEffect(() => {
    let cancelled = false;
    // react-three-fiber/native patches three's file loading so a bundled asset
    // (the number returned by require) can be passed where three expects a URL.
    new GLTFLoader()
      .loadAsync(MODEL as unknown as string)
      .then((gltf) => {
        let found: BufferGeometry | null = null;
        gltf.scene.traverse((child) => {
          if (!found && child instanceof Mesh) found = child.geometry as BufferGeometry;
        });
        if (cancelled) return;
        if (!found) throw new Error('The robot model has no mesh.');
        setGeometry(prepareRobotGeometry(found));
      })
      .catch((error: unknown) => {
        if (!cancelled) reportError.current(error instanceof Error ? error.message : 'The robot model could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
}

// Soft rose glow behind the robot: a plane with a radial fade.
const HALO_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const HALO_FRAGMENT = /* glsl */ `
  uniform float uStrength;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float glow = pow(clamp(1.0 - d, 0.0, 1.0), 2.2) * uStrength;
    // The theme's glow colour (rose on cream, coral on black), faded by alpha.
    gl_FragColor = vec4(uColor, glow);
  }
`;

function Robot({ geometry, signals, tilt, reduceMotion, halo: haloColor, haloStrength }: { geometry: BufferGeometry } & Pick<Props, 'signals' | 'tilt' | 'reduceMotion' | 'halo' | 'haloStrength'>) {
  const body = useRef<Group>(null);
  const halo = useRef<ShaderMaterial>(null);
  const haloUniforms = useMemo(() => ({ uStrength: { value: 0.35 }, uColor: { value: new Color(1, 1, 1) } }), []); // colour set every frame from the theme
  const motion = useRef({ pitch: 0, yaw: 0, roll: 0, headPitch: 0, followX: 0, followY: 0, nod: 0, speed: 1, halo: 0.35, phase: 0, state: 'idle' as RobotState, stateSince: 0 });
  // Where the eyes look (written by RobotFace); the head follows a little.
  const gaze = useRef({ x: 0, y: 0 });
  const onGaze = useCallback((x: number, y: number) => {
    gaze.current = { x, y };
  }, []);

  useFrame((frame, delta) => {
    const m = motion.current;
    const dt = Math.min(delta, MAX_FRAME_STEP);
    const time = frame.clock.elapsedTime;
    const { state: robotState, level } = signals.current;
    const faceKey = faceFor(signals.current);
    const look = lookFor(faceKey);
    const amount = reduceMotion ? 0.35 : 1;

    // Idle motion: float up and down, sway, and a slow breathing scale.
    m.speed = smoothToward(m.speed, look.motion, dt, 2);
    m.phase += dt * m.speed;
    const float = Math.sin(m.phase * 1.3) * 0.045 * amount;
    const sway = Math.sin(m.phase * 0.7) * 0.06 * amount;
    const breathe = 1 + Math.sin(m.phase * 2.1) * 0.008 * amount;

    // Phone tilt (already clamped) eased in so it never snaps.
    m.yaw = smoothToward(m.yaw, tilt.current.yaw, dt, 5);
    m.pitch = smoothToward(m.pitch, tilt.current.pitch, dt, 5);

    if (robotState !== m.state) {
      m.state = robotState;
      m.stateSince = time;
    }
    const inState = time - m.stateSince;
    const expression = expressionFor(faceKey);

    // Per-state head pose: thinking tilts and looks up, error looks down, listening leans in.
    m.roll = smoothToward(m.roll, expression.headRoll * amount, dt, 3);
    m.headPitch = smoothToward(m.headPitch, expression.headPitch * amount, dt, 3);
    const lean = robotState === 'listening' ? 0.04 + level * 0.04 : 0;
    // The head turns a little toward where the eyes look, a moment after them.
    m.followX = smoothToward(m.followX, gaze.current.x * 2.2 * amount, dt, 4);
    m.followY = smoothToward(m.followY, -gaze.current.y * 1.4 * amount, dt, 4);
    // Speaking: small nods that follow the voice. Error: one short "huh?" shake on entry.
    m.nod = smoothToward(m.nod, robotState === 'speaking' ? level * 0.05 : 0, dt, 10);
    const shake = robotState === 'error' && inState < 0.7 ? Math.sin(inState * 26) * 0.05 * (1 - inState / 0.7) * amount : 0;

    if (body.current) {
      body.current.position.y = float + m.nod * 0.3;
      body.current.rotation.set(
        m.pitch + lean + m.headPitch + m.followY + m.nod,
        m.yaw + sway + m.followX + shake,
        sway * 0.25 + m.roll,
      );
      body.current.scale.setScalar(breathe);
    }
    m.halo = smoothToward(m.halo, 0.25 + look.glow * 0.3 + level * 0.15, dt, 4);
    if (halo.current) {
      halo.current.uniforms.uStrength.value = m.halo * haloStrength;
      (halo.current.uniforms.uColor.value as Color).setRGB(...haloColor);
    }
  });

  return (
    <>
      <mesh position={[0, 0, -1.2]}>
        <planeGeometry args={[4.2, 4.2]} />
        <shaderMaterial ref={halo} uniforms={haloUniforms} vertexShader={HALO_VERTEX} fragmentShader={HALO_FRAGMENT} transparent depthWrite={false} />
      </mesh>
      <group ref={body}>
        {/* Shift the model so the head sits in the middle of the view. */}
        <group position={[-MODEL_CENTER.x, -MODEL_CENTER.y, -MODEL_CENTER.z]}>
          <mesh geometry={geometry}>
            <meshStandardMaterial vertexColors roughness={0.36} metalness={0.06} />
          </mesh>
          <RobotFace signals={signals} onGaze={onGaze} />
        </group>
      </group>
    </>
  );
}

/** How long the robot keeps drawing at full speed after something changes (state, mood, tilt). */
const SETTLE_MS = 1500;

/**
 * Draws the robot only as often as needed (the canvas runs in "demand" mode): asks for a new
 * frame 30 times a second while something is happening and 15 times a second while it rests.
 * A plain timer, not an every-frame loop, so the GPU sleeps between frames.
 */
function FramePacer({ signals, tilt }: Pick<Props, 'signals' | 'tilt'>) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let lastKey = '';
    let lastTilt = { yaw: 0, pitch: 0 };
    let settleUntil = 0;
    const tick = () => {
      const now = Date.now();
      const { state, mood } = signals.current;
      const key = `${state}|${mood ?? ''}`;
      const turned = Math.abs(tilt.current.yaw - lastTilt.yaw) + Math.abs(tilt.current.pitch - lastTilt.pitch) > 0.004;
      if (key !== lastKey || turned) settleUntil = now + SETTLE_MS;
      lastKey = key;
      lastTilt = { ...tilt.current };
      invalidate();
      timer = setTimeout(tick, frameIntervalMs(state, now < settleUntil));
    };
    tick();
    return () => clearTimeout(timer);
  }, [invalidate, signals, tilt]);
  return null;
}

/** Memoised: the parent re-renders often (mic level), but the canvas only needs to when its props change. */
export const RobotCanvas = memo(function RobotCanvas({ signals, tilt, active, reduceMotion, onLoadError, scene, halo, haloStrength }: Props) {
  const geometry = useRobotGeometry(onLoadError);
  return (
    <View style={s.fill} pointerEvents="none">
      <Canvas
        // `flat` turns off tone mapping so the brand colours stay exact.
        flat
        // Draw only when FramePacer asks (30 fps busy, 15 fps resting); nothing while the page is hidden.
        frameloop={active ? 'demand' : 'never'}
        camera={{ position: [0, 0.05, 3.9], fov: 30, near: 0.1, far: 20 }}
      >
        <color attach="background" args={[scene]} />
        <hemisphereLight args={['#FFF4EE', '#7A3A44', 0.9]} />
        <directionalLight position={[2.2, 3, 4]} intensity={2.1} color="#FFF1EA" />
        <directionalLight position={[-3, 1.5, -2.5]} intensity={1.4} color="#FF9C8E" />
        <directionalLight position={[-2.5, -1, 3]} intensity={0.5} color="#FFD6CC" />
        {active ? <FramePacer signals={signals} tilt={tilt} /> : null}
        {geometry ? <Robot geometry={geometry} signals={signals} tilt={tilt} reduceMotion={reduceMotion} halo={halo} haloStrength={haloStrength} /> : null}
      </Canvas>
    </View>
  );
});

const s = StyleSheet.create({
  fill: { flex: 1 },
});
