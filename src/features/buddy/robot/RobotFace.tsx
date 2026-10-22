/* eslint-disable react/no-unknown-property -- these are three.js props read by react-three-fiber, not DOM attributes. */
import { useFrame } from '@react-three/fiber/native';
import { useMemo, useRef, type RefObject } from 'react';
import { Color, Shape, Vector2, type Group, type Mesh, type MeshBasicMaterial, type ShaderMaterial } from 'three';

import { FACE } from './robotModel';
import { MAX_FRAME_STEP, ROBOT_LOOKS, expressionFor, faceFor, lookFor, clamp, nextGaze, smoothToward, type RobotSignals, type RobotState } from './robotState';

/**
 * The glowing face drawn over the model's flat screen: a dark maroon panel with moving
 * scan lines, two eyes with lids, blush, and a mouth.
 *
 * How the expressions work:
 * - Each eye is drawn by one shader (EYE_FRAGMENT): the eye, pupil and two curved lids.
 *   The lids are curves, not shapes laid on top, so the eye can smile, squint, look
 *   worried or blink with soft, natural edges.
 * - The eyes move like real eyes: a quick jump (saccade) to a new point, then they hold
 *   still. Where they look depends on the state (see nextGaze in robotState.ts).
 * - The mouth follows loudness only. It is not real lip-sync (no phonemes).
 */

// Screen panel. Colours are written straight out (the canvas uses `flat`, no tone
// mapping), which keeps the maroon exact.
const SCREEN_VERTEX = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SCREEN_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uGlow;
  uniform float uGlitch;
  uniform vec3 uTint;
  uniform vec2 uHalf;
  varying vec2 vPos;
  void main() {
    vec2 p = vPos / uHalf;                       // -1..1 across the screen
    float centre = 1.0 - clamp(length(p * vec2(0.9, 1.0)), 0.0, 1.0);
    vec3 base = mix(vec3(0.075, 0.012, 0.03), vec3(0.2, 0.04, 0.075), centre);
    // Fine horizontal scan lines drifting downward.
    float lines = 0.5 + 0.5 * sin(vPos.y * 260.0 + uTime * 4.0);
    base *= 0.9 + 0.1 * lines;
    // A soft bright band sweeping down the screen every few seconds.
    float sweepY = 1.2 - mod(uTime * 0.35, 2.6);
    float sweep = exp(-pow((p.y - sweepY) * 6.0, 2.0)) * 0.12;
    // Inner edge glow in the state colour.
    float edge = smoothstep(0.55, 1.0, max(abs(p.x), abs(p.y)));
    // Short glitch: bright horizontal bands, only while uGlitch > 0 (error state).
    float band = step(0.55, fract(vPos.y * 14.0 + uTime * 9.0));
    vec3 color = base + uTint * (sweep + edge * 0.35 * uGlow + centre * 0.12 * uGlow + band * uGlitch * 0.22);
    gl_FragColor = vec4(color, 1.0);
  }
`;

// One eye: white, pupil with a highlight, and curved lids. Everything outside the open
// part of the eye is transparent, so the screen shows through. Units are face units,
// with (0, 0) at the eye's centre.
const EYE_VERTEX = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const EYE_FRAGMENT = /* glsl */ `
  uniform float uR;       // half width of the eye
  uniform float uH;       // half height of the eye
  uniform float uUpper;   // upper lid: 0 = open, 1 = closed (meets the lower lid)
  uniform float uLower;   // lower lid raise: 0 = none, higher = smiling crescent
  uniform float uTilt;    // > 0 raises the inner corner of the upper lid (worried)
  uniform float uSide;    // -1 = left eye, +1 = right eye
  uniform vec2 uGaze;     // pupil offset
  uniform float uPupil;   // pupil size multiplier
  varying vec2 vPos;

  const float AA = 0.003; // edge softness, about one or two pixels on a phone

  void main() {
    float x = vPos.x;
    float y = vPos.y;
    float nx = x / uR;

    // Lower lid edge: rises from the bottom; its centre rises most, so a raised lid
    // makes a soft upward curve (a smiling eye).
    float lowerCentre = -uH + 2.0 * uH * uLower;
    float yLower = -uH + 2.0 * uH * uLower * (1.0 - 0.35 * nx * nx);

    // Upper lid edge: a curve that follows the top of the eye, stays rounded while it
    // comes down, and only at the very end bends the other way, like a real eyelid.
    float u = clamp(uUpper, 0.0, 1.0);
    float apex = mix(uH * 1.02, lowerCentre, u);
    float bend = uH * 0.35 * (1.0 - 1.6 * u * u);
    float yUpper = apex - bend * nx * nx + uTilt * (-uSide) * x;

    float shape = length(vec2(nx, y / uH));
    float inEye = 1.0 - smoothstep(1.0 - AA / uR, 1.0 + AA / uR, shape);
    float belowUpper = 1.0 - smoothstep(yUpper - AA, yUpper + AA, y);
    float aboveLower = smoothstep(yLower - AA, yLower + AA, y);
    // The last bit of white fades out as the lids meet, so a closed eye is just the line.
    float open = inEye * belowUpper * aboveLower * (1.0 - smoothstep(0.86, 0.99, u));

    // Eye colours: warm white, a soft shadow just under the upper lid, the pupil and its highlight.
    vec3 color = vec3(1.0, 0.969, 0.953);
    float underLid = max(yUpper - y, 0.0);
    color *= 1.0 - 0.16 * exp(-underLid / (0.16 * uH));
    float pupilR = 0.038 * uPupil;
    float pupil = 1.0 - smoothstep(pupilR - AA, pupilR + AA, length(vPos - uGaze));
    color = mix(color, vec3(0.227, 0.051, 0.094), pupil);
    float shineR = 0.011 * uPupil;
    float shine = 1.0 - smoothstep(shineR - AA, shineR + AA, length(vPos - uGaze - vec2(0.014, 0.016) * uPupil));
    color = mix(color, vec3(1.0), shine);

    // When the eye is nearly shut, a thin curved line marks the closed lid.
    float lineFade = smoothstep(0.72, 0.96, uUpper);
    float onLine = 1.0 - smoothstep(0.008 - AA, 0.008 + AA, abs(y - yUpper));
    float lineWidth = 1.0 - smoothstep(uR * 0.9 - AA, uR * 0.9 + AA, abs(x));
    float line = lineFade * onLine * lineWidth;

    float alpha = max(open, line);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(open >= line ? color : vec3(1.0, 0.93, 0.9), alpha);
  }
`;

// Eye halo: fades out from the eye's edge, so it reads as glow and never as a bigger eye.
const HALO_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  uniform float uStrength;
  uniform vec3 uTint;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;           // 0 at the centre, 1 at the rim
    float fade = 1.0 - smoothstep(0.62, 1.0, d);  // starts just outside the eye
    gl_FragColor = vec4(mix(vec3(1.0, 0.86, 0.82), uTint, 0.5), fade * uStrength);
  }
`;

/** Highest eye-halo strength (0..1); keeps loud input from washing the eyes out. */
const MAX_HALO = 0.32;

/** Rounded rectangle with true circular corners (matches how the screen's groove was fitted). */
function roundedRect(halfW: number, halfH: number, radius: number): Shape {
  const shape = new Shape();
  shape.moveTo(-halfW + radius, -halfH);
  shape.lineTo(halfW - radius, -halfH);
  shape.absarc(halfW - radius, -halfH + radius, radius, -Math.PI / 2, 0, false);
  shape.lineTo(halfW, halfH - radius);
  shape.absarc(halfW - radius, halfH - radius, radius, 0, Math.PI / 2, false);
  shape.lineTo(-halfW + radius, halfH);
  shape.absarc(-halfW + radius, halfH - radius, radius, Math.PI / 2, Math.PI, false);
  shape.lineTo(-halfW, -halfH + radius);
  shape.absarc(-halfW + radius, -halfH + radius, radius, Math.PI, Math.PI * 1.5, false);
  return shape;
}

// Face layout (face units, centre of the screen = 0,0).
const EYE_X = 0.15;
const EYE_Y = 0.07;
const EYE_R = 0.078;
/** Half height of the (slightly tall) eye. */
const EYE_H = EYE_R * 1.15;
const MOUTH_Y = -0.15;
/** Blush and mouth sit just above the eyes' layer. */
const TOP_Z = 0.016;

type Props = {
  signals: RefObject<RobotSignals>;
  /** Called every frame with where the eyes look, so the head can follow a little. */
  onGaze: (x: number, y: number) => void;
};

/** Blink shape over its 0..1 progress: closes fast, opens a little slower. */
function blinkAmount(progress: number): number {
  if (progress < 0 || progress >= 1) return 0;
  return progress < 0.4 ? progress / 0.4 : 1 - (progress - 0.4) / 0.6;
}

function between([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}

export function RobotFace({ signals, onGaze }: Props) {
  const screenShape = useMemo(() => roundedRect(FACE.halfWidth, FACE.halfHeight, FACE.radius), []);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uGlow: { value: 0.5 },
    uGlitch: { value: 0 },
    uTint: { value: new Color(ROBOT_LOOKS.idle.tint) },
    uHalf: { value: new Vector2(FACE.halfWidth, FACE.halfHeight) },
  }), []);
  const eyeUniforms = useMemo(() => [-1, 1].map((side) => ({
    uR: { value: EYE_R },
    uH: { value: EYE_H },
    uUpper: { value: 0.02 },
    uLower: { value: 0 },
    uTilt: { value: 0 },
    uSide: { value: side },
    uGaze: { value: new Vector2(0, 0) },
    uPupil: { value: 1 },
  })), []);
  const haloUniforms = useMemo(() => [0, 1].map(() => ({
    uStrength: { value: 0.2 },
    uTint: { value: new Color(ROBOT_LOOKS.idle.tint) },
  })), []);

  const face = useRef<Group>(null);
  const screenMaterial = useRef<ShaderMaterial>(null);
  // Index 0 = left eye, 1 = right eye.
  const eyes = useRef<ShaderMaterial[]>([]);
  const eyeGlow = useRef<ShaderMaterial[]>([]);
  const blush = useRef<MeshBasicMaterial[]>([]);
  const mouthArc = useRef<Mesh>(null);
  const mouthArcMaterial = useRef<MeshBasicMaterial>(null);
  const mouthLine = useRef<Mesh>(null);
  const mouthLineMaterial = useRef<MeshBasicMaterial>(null);
  const mouthOpen = useRef<Group>(null);
  const mouthGroup = useRef<Group>(null);

  // Animation memory kept between frames (refs, so changing them never re-renders React).
  const anim = useRef({
    state: 'idle' as RobotState,
    stateSince: 0,
    glow: 0.5,
    upper: 0.02,
    lower: 0,
    tilt: 0,
    squint: 0,
    pupil: 1,
    gazeX: 0,
    gazeY: 0,
    targetX: 0,
    targetY: 0,
    gazeStep: 0,
    nextGaze: 1,
    blinkStart: -10,
    nextBlink: 2.5,
    mouthOpen: 0,
    mouthCurve: 1,
    mouthWidth: 1,
    mouthShift: 0,
    wasLoud: false,
    loudSince: 0,
    nextGlitch: 0,
    glitchUntil: 0,
    tint: new Color(ROBOT_LOOKS.idle.tint),
    targetTint: new Color(),
  });

  // Runs every frame on the JS thread (react-three-fiber's render loop).
  useFrame((frame, delta) => {
    const a = anim.current;
    const time = frame.clock.elapsedTime;
    const dt = Math.min(delta, MAX_FRAME_STEP); // avoid big jumps after a pause
    const { state, level } = signals.current;
    // While idle after a reply, the face shows the reply's mood instead of plain idle.
    const faceKey = faceFor(signals.current);
    const look = lookFor(faceKey);
    const expression = expressionFor(faceKey);

    // React to a state change straight away instead of waiting for the next timer.
    if (state !== a.state) {
      a.state = state;
      a.stateSince = time;
      a.gazeStep = 0;
      a.nextGaze = time; // look somewhere new now
      if (state === 'speaking' || state === 'listening') a.nextBlink = time + 0.12; // a "hello" blink
      if (state === 'error') a.nextGlitch = time;
    }
    const inState = time - a.stateSince;

    // --- Screen glow and colour (capped and eased so loud sounds can't spike it) ---
    const boost = state === 'listening' || state === 'speaking' ? level * 0.3 : 0;
    a.glow = smoothToward(a.glow, clamp(look.glow + boost + Math.sin(time * 1.6) * 0.05, 0, 1), dt, 3);
    a.targetTint.set(look.tint);
    a.tint.lerp(a.targetTint, 1 - Math.exp(-dt * 4));

    // Error: a short glitch every few seconds instead of constant flicker.
    let glitch = 0;
    if (state === 'error') {
      if (time > a.nextGlitch) {
        a.glitchUntil = time + 0.16;
        a.nextGlitch = time + 2.6 + Math.random() * 1.8;
      }
      glitch = time < a.glitchUntil ? 1 : 0;
    }
    if (face.current) face.current.position.x = FACE.center.x + (glitch ? Math.sin(time * 90) * 0.006 : 0);
    if (screenMaterial.current) {
      const u = screenMaterial.current.uniforms;
      u.uTime.value = time;
      u.uGlow.value = a.glow;
      u.uGlitch.value = glitch;
      (u.uTint.value as Color).copy(a.tint);
    }

    // --- Gaze: quick jump to a new point, then hold still ---
    if (time > a.nextGaze) {
      const target = nextGaze(state, inState, a.gazeStep, Math.random);
      a.targetX = clamp(target.x, -0.032, 0.032);
      a.targetY = clamp(target.y, -0.03, 0.035);
      a.gazeStep += 1;
      // During the first second of an error the eyes scan quickly; otherwise use the state's pace.
      a.nextGaze = time + (state === 'error' && inState < 1.4 ? 0.42 : between(expression.gaze));
    }
    // Speed 26 makes the move take about a tenth of a second, like a real saccade.
    a.gazeX = smoothToward(a.gazeX, a.targetX, dt, 26);
    a.gazeY = smoothToward(a.gazeY, a.targetY, dt, 26);
    // While talking the eyes bob very slightly with the voice.
    const bob = state === 'speaking' ? level * 0.006 : 0;
    onGaze(a.gazeX, a.gazeY);

    // --- Blinks: natural timing per state; sometimes a double blink ---
    // When speaking, also blink at the end of a phrase (loud, then quiet).
    const loud = state === 'speaking' && level > 0.12;
    if (loud && !a.wasLoud) a.loudSince = time;
    if (!loud && a.wasLoud && time - a.loudSince > 0.8 && Math.random() < 0.5) a.nextBlink = Math.min(a.nextBlink, time + 0.05);
    a.wasLoud = loud;
    if (time > a.nextBlink) {
      a.blinkStart = time;
      a.nextBlink = Math.random() < 0.18 ? time + 0.28 : time + between(expression.blink);
    }
    const blink = blinkAmount((time - a.blinkStart) / 0.15);

    // --- Lids ease toward the state's expression ---
    const engaged = state === 'listening' ? level * 0.12 : state === 'speaking' ? level * 0.1 : 0;
    a.upper = smoothToward(a.upper, expression.upperLid, dt, 7);
    a.lower = smoothToward(a.lower, expression.lowerLid + engaged, dt, 7);
    a.tilt = smoothToward(a.tilt, expression.lidTilt, dt, 6);
    a.squint = smoothToward(a.squint, expression.squintSide, dt, 5);
    a.pupil = smoothToward(a.pupil, expression.pupil, dt, 5);

    for (let eye = 0; eye < 2; eye += 1) {
      const material = eyes.current[eye];
      if (!material) continue;
      const u = material.uniforms;
      const side = eye === 0 ? -1 : 1;
      u.uUpper.value = clamp(Math.max(a.upper + (side > 0 ? a.squint : 0), blink), 0, 1);
      u.uLower.value = clamp(a.lower + blink * 0.12, 0, 0.6);
      // Tilt in the shader is a slope; 0.8 turns the expression value into a gentle one.
      u.uTilt.value = a.tilt * 0.8;
      (u.uGaze.value as Vector2).set(a.gazeX, a.gazeY + bob);
      u.uPupil.value = a.pupil;
    }

    for (const material of eyeGlow.current) {
      material.uniforms.uStrength.value = Math.min(MAX_HALO, 0.12 + a.glow * 0.2) * (1 - blink * 0.6);
      (material.uniforms.uTint.value as Color).copy(a.tint);
    }
    for (const material of blush.current) material.opacity = state === 'error' ? 0.14 : 0.36 + a.glow * 0.14;

    // --- Mouth ---
    // Speaking: opens fast with each sound and closes a bit slower; a small wobble keeps a
    // steady voice from looking mechanical. Otherwise it settles into the state's shape.
    const wobble = Math.sin(time * 23) * Math.sin(time * 7.1) * 0.12;
    const openTarget = state === 'speaking' && level > 0.02 ? clamp(level * 1.5 + wobble, 0, 1) : 0;
    a.mouthOpen = smoothToward(a.mouthOpen, openTarget, dt, openTarget > a.mouthOpen ? 28 : 11);
    a.mouthCurve = smoothToward(a.mouthCurve, expression.mouthCurve, dt, 6);
    a.mouthWidth = smoothToward(a.mouthWidth, expression.mouthWidth, dt, 6);
    // Thinking: the mouth drifts a little from side to side, like "hmm".
    const hmm = state === 'thinking' ? Math.sin(time * 1.1) * 0.012 : 0;
    a.mouthShift = smoothToward(a.mouthShift, expression.mouthShift + hmm, dt, 4);
    if (mouthGroup.current) mouthGroup.current.position.x = a.mouthShift;
    // The curve is drawn by the arc (half a torus: positive y scale = smile, negative = frown).
    // A nearly flat mouth would make the arc paper-thin, so a separate straight line takes over.
    const flatness = clamp(1 - Math.abs(a.mouthCurve) / 0.35, 0, 1);
    const closed = clamp(1 - a.mouthOpen * 2.2, 0, 1);
    if (mouthArc.current) {
      const curve = Math.abs(a.mouthCurve) < 0.05 ? 0.05 : a.mouthCurve;
      mouthArc.current.scale.set(a.mouthWidth, curve, 1);
      mouthArc.current.position.y = a.mouthCurve < 0 ? -0.035 : 0;
    }
    if (mouthArcMaterial.current) mouthArcMaterial.current.opacity = closed * (1 - flatness);
    if (mouthLine.current) {
      mouthLine.current.visible = flatness > 0.01;
      mouthLine.current.scale.set(1, a.mouthWidth, 1); // the capsule lies on its side, so its length is y
    }
    if (mouthLineMaterial.current) mouthLineMaterial.current.opacity = closed * flatness;
    if (mouthOpen.current) {
      const open = a.mouthOpen;
      mouthOpen.current.visible = open > 0.02;
      // Bigger sounds make a rounder "o"; small ones a wider, flatter shape.
      mouthOpen.current.scale.set(1.15 - open * 0.3, 0.18 + open * 0.95, 1);
    }
  });

  return (
    <group ref={face} position={[FACE.center.x, FACE.center.y, FACE.center.z]}>
      <mesh>
        <shapeGeometry args={[screenShape, 16]} />
        <shaderMaterial ref={screenMaterial} uniforms={uniforms} vertexShader={SCREEN_VERTEX} fragmentShader={SCREEN_FRAGMENT} />
      </mesh>

      {[-EYE_X, EYE_X].map((x, index) => (
        <group key={`eye-${x}`} position={[x, EYE_Y, 0]}>
          <mesh position={[0, 0, 0.006]}>
            <planeGeometry args={[EYE_R * 2 + 0.03, EYE_H * 2 + 0.03]} />
            <shaderMaterial
              ref={(material) => { if (material) eyes.current[index] = material; }}
              uniforms={eyeUniforms[index]}
              vertexShader={EYE_VERTEX}
              fragmentShader={EYE_FRAGMENT}
              transparent
              depthWrite={false}
            />
          </mesh>

          {/* Soft halo around the eye. */}
          <mesh position={[0, 0, 0.014]} scale={[1, 1.15, 1]}>
            <circleGeometry args={[0.115, 32]} />
            <shaderMaterial
              ref={(material) => { if (material) eyeGlow.current[index] = material; }}
              uniforms={haloUniforms[index]}
              vertexShader={HALO_VERTEX}
              fragmentShader={HALO_FRAGMENT}
              transparent
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {[-0.255, 0.255].map((x, index) => (
        <mesh key={`blush-${x}`} position={[x, -0.095, TOP_Z]} scale={[1.3, 0.75, 1]}>
          <circleGeometry args={[0.042, 24]} />
          <meshBasicMaterial
            ref={(material) => { if (material) blush.current[index] = material; }}
            color="#FF8FA3"
            transparent
            opacity={0.45}
            depthWrite={false}
          />
        </mesh>
      ))}

      <group ref={mouthGroup} position={[0, MOUTH_Y, TOP_Z]}>
        {/* Half a torus, turned upside down, makes the smile line. */}
        <mesh ref={mouthArc} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.062, 0.011, 8, 28, Math.PI]} />
          <meshBasicMaterial ref={mouthArcMaterial} color="#FFE3DA" transparent />
        </mesh>
        {/* Flat "hmm" line: a capsule turned on its side. */}
        <mesh ref={mouthLine} position={[0, -0.03, 0]} rotation={[0, 0, Math.PI / 2]} visible={false}>
          <capsuleGeometry args={[0.009, 0.1, 4, 12]} />
          <meshBasicMaterial ref={mouthLineMaterial} color="#FFE3DA" transparent opacity={0} />
        </mesh>
        {/* Open mouth: coral lips with a darker inside. */}
        <group ref={mouthOpen} position={[0, -0.03, 0]} visible={false}>
          <mesh>
            <circleGeometry args={[0.05, 32]} />
            <meshBasicMaterial color="#FF8A7A" />
          </mesh>
          <mesh position={[0, -0.004, 0.001]} scale={[0.78, 0.7, 1]}>
            <circleGeometry args={[0.05, 32]} />
            <meshBasicMaterial color="#4A0E1C" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
