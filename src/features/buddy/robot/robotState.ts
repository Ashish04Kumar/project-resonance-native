/**
 * Pure rules for the Buddy robot: which state it is in, how each state looks,
 * and how phone tilt becomes a small, safe rotation. No React or three.js here,
 * so it is easy to test.
 */

export type RobotState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

/** A reply's mood (the companion's shared expression list). Shown on the face while idle. */
export type Mood = 'happy' | 'curious' | 'concerned' | 'playful' | 'surprised' | 'excited' | 'sad';

const MOODS: readonly Mood[] = ['happy', 'curious', 'concerned', 'playful', 'surprised', 'excited', 'sad'];

/** The companion's expression tag -> a mood, or null for "idle" and anything unknown. */
export function moodFromTag(tag: string | undefined): Mood | null {
  return MOODS.find((mood) => mood === tag) ?? null;
}

/** Live signals the screen writes every frame; the 3D scene only reads them. */
export type RobotSignals = {
  state: RobotState;
  /** 0..1 loudness that drives the face: the user's mic while listening, Buddy's voice while speaking. */
  level: number;
  /** The last reply's mood; the face shows it only while idle. */
  mood?: Mood | null;
};

/** Which face to draw: a state, or (while idle) the last reply's mood. */
export type FaceKey = RobotState | Mood;

export function faceFor(signals: RobotSignals): FaceKey {
  return signals.state === 'idle' && signals.mood ? signals.mood : signals.state;
}

export type RobotInputs = {
  error: boolean;
  /** Buddy's own voice level (0..1). Nothing produces this on the Buddy page yet. */
  buddyVoiceLevel: number;
  thinking: boolean;
  micOn: boolean;
};

/** Below this, Buddy's voice level counts as silence. */
const SPEAKING_THRESHOLD = 0.03;

export function deriveRobotState(inputs: RobotInputs): RobotState {
  if (inputs.error) return 'error';
  if (inputs.buddyVoiceLevel > SPEAKING_THRESHOLD) return 'speaking';
  if (inputs.thinking) return 'thinking';
  if (inputs.micOn) return 'listening';
  return 'idle';
}

export type RobotLook = {
  label: string;
  /** Face-screen accent colour (sRGB hex). */
  tint: string;
  /** Base screen glow, 0..1. */
  glow: number;
  /** Speed of the float/sway loop. */
  motion: number;
};

export const ROBOT_LOOKS: Record<RobotState, RobotLook> = {
  idle: { label: 'Here with you', tint: '#FF8A7A', glow: 0.45, motion: 1 },
  listening: { label: 'Listening', tint: '#FFB199', glow: 0.65, motion: 0.8 },
  thinking: { label: 'Thinking', tint: '#C9A7FF', glow: 0.6, motion: 0.6 },
  speaking: { label: 'Speaking', tint: '#FF7A8A', glow: 0.85, motion: 1.1 },
  error: { label: 'Something went wrong', tint: '#FF4D5E', glow: 0.4, motion: 0.5 },
};

/** How each mood looks (same fields as ROBOT_LOOKS). */
export const MOOD_LOOKS: Record<Mood, RobotLook> = {
  happy: { label: 'Happy', tint: '#FF9A7A', glow: 0.6, motion: 1.05 },
  curious: { label: 'Curious', tint: '#FFB36B', glow: 0.55, motion: 0.9 },
  concerned: { label: 'Concerned', tint: '#B9A3E8', glow: 0.4, motion: 0.6 },
  playful: { label: 'Playful', tint: '#FF8FB1', glow: 0.65, motion: 1.2 },
  surprised: { label: 'Surprised', tint: '#FFC46B', glow: 0.75, motion: 1 },
  excited: { label: 'Excited', tint: '#FF7A6B', glow: 0.85, motion: 1.35 },
  sad: { label: 'A little sad', tint: '#9AA8E0', glow: 0.32, motion: 0.5 },
};

export function lookFor(face: FaceKey): RobotLook {
  return face in ROBOT_LOOKS ? ROBOT_LOOKS[face as RobotState] : MOOD_LOOKS[face as Mood];
}

/**
 * The face's expression in each state. Lids are drawn over the eyes in the screen's own
 * colour, so covering part of an eye changes its shape:
 * - upperLid / lowerLid: how much of the eye each lid covers (0 = none, 1 = all).
 *   A raised lower lid gives "smiling" eyes; lowered upper lids give a focused squint.
 * - lidTilt: radians. Positive raises the inner corners (worried), negative lowers them (focused).
 * - squintSide: extra upper-lid cover on the right eye only, for a one-sided "hmm".
 * - mouthCurve: 1 = smile, 0 = flat line, negative = frown. mouthWidth scales the mouth,
 *   mouthShift moves it sideways (a thinking "hmm" sits off-centre).
 * - headRoll / headPitch: small extra head tilt (radians); pitch < 0 looks up.
 * - blink: seconds between blinks (min, max). gaze: seconds between glances (min, max).
 */
export type Expression = {
  upperLid: number;
  lowerLid: number;
  lidTilt: number;
  squintSide: number;
  pupil: number;
  mouthCurve: number;
  mouthWidth: number;
  mouthShift: number;
  headRoll: number;
  headPitch: number;
  blink: [number, number];
  gaze: [number, number];
};

export const EXPRESSIONS: Record<RobotState, Expression> = {
  idle: { upperLid: 0.02, lowerLid: 0, lidTilt: 0, squintSide: 0, pupil: 1, mouthCurve: 1, mouthWidth: 1, mouthShift: 0, headRoll: 0, headPitch: 0, blink: [2.6, 5.5], gaze: [1.2, 3.4] },
  listening: { upperLid: 0, lowerLid: 0.04, lidTilt: 0.04, squintSide: 0, pupil: 1.12, mouthCurve: 0.75, mouthWidth: 0.85, mouthShift: 0, headRoll: 0.03, headPitch: 0.02, blink: [3, 6], gaze: [0.5, 1.3] },
  thinking: { upperLid: 0.26, lowerLid: 0.12, lidTilt: -0.08, squintSide: 0.12, pupil: 0.95, mouthCurve: 0.1, mouthWidth: 0.62, mouthShift: 0.03, headRoll: 0.07, headPitch: -0.05, blink: [4, 7], gaze: [0.9, 2.1] },
  speaking: { upperLid: 0.04, lowerLid: 0.22, lidTilt: 0, squintSide: 0, pupil: 1.05, mouthCurve: 1, mouthWidth: 1, mouthShift: 0, headRoll: 0, headPitch: 0, blink: [2.8, 4.8], gaze: [0.5, 1.4] },
  error: { upperLid: 0.2, lowerLid: 0.04, lidTilt: 0.32, squintSide: 0, pupil: 0.85, mouthCurve: -0.7, mouthWidth: 0.7, mouthShift: 0, headRoll: -0.04, headPitch: 0.05, blink: [2, 3.6], gaze: [1.4, 2.6] },
};

/** The face for each mood (same fields as EXPRESSIONS). Gaze and blinks follow the idle pattern. */
export const MOOD_EXPRESSIONS: Record<Mood, Expression> = {
  // Smiling eyes (raised lower lids) and a wide smile.
  happy: { upperLid: 0.02, lowerLid: 0.3, lidTilt: 0, squintSide: 0, pupil: 1.05, mouthCurve: 1, mouthWidth: 1.12, mouthShift: 0, headRoll: 0.03, headPitch: 0, blink: [2.6, 5], gaze: [1, 2.6] },
  // Wide eyes, small off-centre mouth, head tilted to one side.
  curious: { upperLid: 0, lowerLid: 0.02, lidTilt: 0.06, squintSide: 0.1, pupil: 1.15, mouthCurve: 0.35, mouthWidth: 0.6, mouthShift: 0.04, headRoll: 0.1, headPitch: 0.02, blink: [3, 6], gaze: [0.8, 1.8] },
  // Inner corners raised (worried brows), small flat mouth, leaning in.
  concerned: { upperLid: 0.12, lowerLid: 0.04, lidTilt: 0.26, squintSide: 0, pupil: 1, mouthCurve: -0.2, mouthWidth: 0.7, mouthShift: 0, headRoll: -0.04, headPitch: 0.04, blink: [2.8, 5], gaze: [1.4, 3] },
  // A one-sided squint (half a wink) and a lopsided grin.
  playful: { upperLid: 0.04, lowerLid: 0.2, lidTilt: -0.04, squintSide: 0.4, pupil: 1.05, mouthCurve: 1, mouthWidth: 0.95, mouthShift: 0.05, headRoll: -0.09, headPitch: 0, blink: [2.4, 4.5], gaze: [0.8, 2] },
  // Eyes wide open, big pupils, small round-ish mouth, head back.
  surprised: { upperLid: 0, lowerLid: 0, lidTilt: 0.1, squintSide: 0, pupil: 1.3, mouthCurve: 0.15, mouthWidth: 0.5, mouthShift: 0, headRoll: 0, headPitch: -0.06, blink: [4, 7], gaze: [1.2, 2.5] },
  // Smiling eyes, big pupils, widest smile, quicker glances.
  excited: { upperLid: 0, lowerLid: 0.26, lidTilt: 0.04, squintSide: 0, pupil: 1.22, mouthCurve: 1, mouthWidth: 1.2, mouthShift: 0, headRoll: 0.04, headPitch: -0.03, blink: [2.2, 4], gaze: [0.5, 1.2] },
  // Droopy lids with raised inner corners, frown, head down.
  sad: { upperLid: 0.3, lowerLid: 0.02, lidTilt: 0.3, squintSide: 0, pupil: 0.92, mouthCurve: -0.6, mouthWidth: 0.75, mouthShift: 0, headRoll: 0.02, headPitch: 0.08, blink: [3.4, 6.5], gaze: [1.8, 3.6] },
};

export function expressionFor(face: FaceKey): Expression {
  return face in EXPRESSIONS ? EXPRESSIONS[face as RobotState] : MOOD_EXPRESSIONS[face as Mood];
}

/** Where the eyes look next (in face units; x right, y up). Pure so it can be tested. */
export function nextGaze(state: RobotState, secondsInState: number, step: number, random: () => number): { x: number; y: number } {
  const jitter = (size: number) => (random() - 0.5) * 2 * size;
  switch (state) {
    case 'listening':
      // Fixed on you, with tiny natural micro-movements.
      return { x: jitter(0.007), y: jitter(0.005) };
    case 'thinking': {
      // Searching upward: alternate up-right and up-left, sometimes a sideways glance.
      if (random() < 0.22) return { x: 0.032 * (step % 2 === 0 ? 1 : -1), y: 0.004 };
      return step % 2 === 0 ? { x: 0.03 + jitter(0.004), y: 0.03 + jitter(0.004) } : { x: -0.026 + jitter(0.004), y: 0.033 + jitter(0.004) };
    }
    case 'speaking':
      // Talking to you: mostly near centre, now and then a short look aside.
      return random() < 0.25 ? { x: 0.026 * (random() < 0.5 ? 1 : -1), y: jitter(0.01) } : { x: jitter(0.012), y: jitter(0.008) };
    case 'error':
      // A quick look left, right, then down; after that mostly down with an occasional check up.
      if (secondsInState < 1.4) return [{ x: -0.032, y: 0 }, { x: 0.032, y: 0 }, { x: 0, y: -0.022 }][Math.min(step, 2)];
      return random() < 0.3 ? { x: jitter(0.01), y: 0.01 } : { x: jitter(0.012), y: -0.02 };
    default:
      // Idle: relaxed glances, often back to centre.
      return random() < 0.3 ? { x: 0, y: 0 } : { x: jitter(0.03), y: jitter(0.02) };
  }
}

/**
 * How often the 3D robot is redrawn (it only draws when asked, to keep the phone cool):
 * 30 fps while something is happening (listening, thinking, speaking, error, a mood change,
 * the phone being tilted), 15 fps while it just rests. `settling` is true for a short while
 * after any change, so eases and blinks finish smoothly before it slows down.
 */
export const BUSY_FRAME_MS = 1000 / 30;
export const IDLE_FRAME_MS = 1000 / 15;

export function frameIntervalMs(state: RobotState, settling: boolean): number {
  return state === 'idle' && !settling ? IDLE_FRAME_MS : BUSY_FRAME_MS;
}

/** Longest time step the animations use, so a slow frame (15 fps) still moves at the right speed. */
export const MAX_FRAME_STEP = 0.1;

/** Frame-rate independent easing: move `current` toward `target`. Higher speed = snappier. */
export function smoothToward(current: number, target: number, deltaSeconds: number, speed: number): number {
  return current + (target - current) * (1 - Math.exp(-deltaSeconds * speed));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type Tilt = { pitch: number; yaw: number };
export type PhoneRotation = { beta: number; gamma: number };

/** Keeps an angle difference in -PI..PI so crossing the wrap point doesn't jump. */
function angleDelta(value: number, base: number): number {
  let delta = value - base;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return delta;
}

/** Tiny wobbles from a hand holding the phone are ignored. */
const DEAD_ZONE = 0.025;
export const MAX_YAW = 0.32;
export const MAX_PITCH = 0.2;

function withDeadZone(value: number): number {
  if (Math.abs(value) < DEAD_ZONE) return 0;
  return value - Math.sign(value) * DEAD_ZONE;
}

/**
 * Phone rotation (radians, from expo-sensors DeviceMotion) relative to the calibrated
 * resting pose -> robot rotation. Tilting the phone left/right turns the robot; tipping
 * it forward/back nods it. Always clamped so the face never turns away.
 */
export function tiltFromRotation(rotation: PhoneRotation, base: PhoneRotation): Tilt {
  const yaw = withDeadZone(angleDelta(rotation.gamma, base.gamma)) * 0.55;
  const pitch = withDeadZone(angleDelta(rotation.beta, base.beta)) * 0.35;
  return { yaw: clamp(yaw, -MAX_YAW, MAX_YAW), pitch: clamp(pitch, -MAX_PITCH, MAX_PITCH) };
}

/** expo-audio metering is in dBFS (about -160..0). Map normal speech to 0..1. */
export function levelFromMetering(metering: number | undefined): number {
  if (metering === undefined || !Number.isFinite(metering)) return 0;
  return clamp((metering + 50) / 42, 0, 1);
}
