# Buddy tab: 3D robot

The Buddy tab (default tab on `/landing`) shows the 3D robot's head (screen, ears and antennae; no neck, torso or arms) from `assets/avatar-3d/gg2.glb` in the middle of the page, with a status label, a mic button and a tilt toggle (no page title). The voice call screen is not changed.

## Files

| File | What it does |
| --- | --- |
| `src/features/buddy/BuddyScreen.tsx` | Page layout, state controller, mic button, tilt toggle, dev-only state preview |
| `src/features/buddy/robot/RobotCanvas.tsx` | three.js canvas (react-three-fiber/native + expo-gl), model loading, lights, float/sway/tilt motion, glow behind the robot |
| `src/features/buddy/robot/RobotFace.tsx` | Face drawn over the model's screen: maroon panel with scan lines, blinking/looking eyes, blush, mouth |
| `src/features/buddy/robot/robotModel.ts` | Smooth normals and region colours for the model; face position and size |
| `src/features/buddy/robot/robotState.ts` | Pure rules: state choice, look per state, smoothing, tilt mapping, mic level |
| `src/features/buddy/useDeviceTilt.ts` | Phone orientation (expo-sensors DeviceMotion) to robot rotation |
| `src/features/buddy/buddyLive.ts`, `BuddyLiveBridge.tsx` | Live voice chat with Buddy (LiveKit room, voice levels, captions, mood) |
| `metro.config.js` | Lets Metro bundle `.glb` files, and always resolves `three` to its ES module build (its CommonJS entry calls `process.emitWarning`, which crashes React Native with "undefined is not a function") |

## The model

- `gg2.glb` (10 MB, 667k triangles) is kept unchanged. It has positions only: no colours, normals, UVs, materials, rig, animations or morph targets, and the eyes and mouth are not separate parts.
- `gg2-mobile.glb` (0.8 MB, 67k triangles, whole robot) was made with:
  `npx @gltf-transform/cli@4 weld gg2.glb weld.glb` then `npx @gltf-transform/cli@4 simplify weld.glb gg2-mobile.glb --ratio 0.1 --error 0.0008`.
- The app loads `gg2-head.glb` (0.4 MB, 33k triangles): the head cut from `gg2-mobile.glb` with `scripts/cut_robot_head.py gg2-mobile.glb gg2-head.glb -0.065`. It keeps everything above the bottom of the head (plus the ears and antennae) and drops small loose pieces, such as the top of the raised claw. To show the whole robot again, point `MODEL` in `RobotCanvas.tsx` back to `gg2-mobile.glb` and set `MODEL_CENTER.y` to -0.02.
- Colours are painted per vertex by position (peach shell, maroon screen, dark neck, rose ears, coral antenna tips). Seams cannot be found in the mesh, so they don't glow.
- The eyes, mouth, blush and screen glow sit on a panel placed just in front of the model's face screen (`FACE` in `robotModel.ts`). Its centre, size and corner radius are fitted to the outer edge of the groove around the screen, where the bezel starts (centre 0.150, 0.425; half size 0.42 × 0.385; radius 0.24), so it covers the groove and meets the bezel with no gap; it sits 0.0015 in front of the screen's highest point so it doesn't slide over the screen when the head turns. The model is painted maroon only 0.03 inside that edge, so colour blending never shows dark spikes in the groove. If the model is replaced, measure these again.

## States

| State | When | Look |
| --- | --- | --- |
| idle | default | gentle float and sway; relaxed glances that often return to centre; blinks every 2.5–5.5 s, sometimes a double blink; soft smile |
| listening | mic on | eyes fixed on you with tiny micro-movements, slightly larger pupils, leans in; lower lids rise a little while you talk |
| thinking | preview only for now | eyes jump between up-right and up-left with an occasional sideways glance; focused lids with one eye squinting more; head tilted and looking up; flat "hmm" mouth drifting to one side; fewer blinks |
| speaking | Buddy's voice level > 0.03 (preview only for now) | smiling eyes, glances near you with short looks aside, blinks at the ends of phrases, small nods; mouth opens fast with each sound and closes slower (rounder for loud sounds) |
| error | model failed to load, mic denied or failed | quick look left, right, then down; worried lids (inner corners up), smaller pupils, small frown, one short head shake; a brief screen glitch every few seconds |

Eyes move like real eyes: a fast jump (about a tenth of a second) to a new point, then they hold still, and the head turns slightly after them. Expressions live in `EXPRESSIONS` and where the eyes look in `nextGaze` (both in `robotState.ts`). Each eye is one shader (`EYE_FRAGMENT` in `RobotFace.tsx`) with two curved lids: the upper lid follows the eye's top curve and stays rounded while it closes, bending into a thin closed-eye line only at the end; the lower lid rises as a soft curve for smiling eyes. Outside the open part the eye is transparent, so there are no lid shapes on top of the screen.

Haptics (once per change, only while the page is visible; `src/services/haptics.ts`): thinking two light ticks ("hmm"), speaking a warm tap with a light echo, error three quick taps with the last a little firmer. On Android each starts with a system effect followed by short crisp taps.

The mouth follows loudness only. It is not lip-sync. Buddy has no voice connection yet. When it gets one, pass Buddy's loudness (0..1) as `buddyVoiceLevel` to `deriveRobotState` and as `level` while speaking.

The mic only measures loudness. expo-audio meters only while recording, so it records a small low-quality file to the cache and deletes it on stop. Nothing is uploaded. It stops on its own after 2 minutes and when you leave the tab or the app.

## Tilt

- The first reading after turning tilt on is the resting pose. **Re-center** (or a long press on the tilt pill) takes the current pose as the new resting pose.
- Left/right tilt turns the robot (at most about 18°). Forward/back nods it (at most about 11°). Small hand wobbles are ignored, and the motion is eased in.
- Tilt is off and idle motion is smaller when the phone's "reduce motion" setting is on.

## Performance

- The render loop stops when the tab is not visible (another screen pushed on top, or the app in the background).
- expo-gl always renders at the phone's full pixel density. If mid-range phones drop frames, first try simplifying the model further (`--ratio 0.05`).

## Needs a new development build

expo-gl, expo-sensors, expo-asset and expo-file-system have native code: run `npx expo run:android` (or an EAS development build) once before testing.

## Text chat (2026-10-20)

- Below the status pill: this visit's messages and a "Message Buddy" box. Replies come from `POST /api/v1/buddy/chat` (backend `app/buddy.py`, the embedded companion, conversation only) and stream in as they are written (`src/features/buddy/buddyChat.ts`, using `expo/fetch`).
- Robot: thinking while waiting, speaking (a made-up mouth rhythm) while text arrives, error if the reply fails, then the reply's mood for 8 seconds while idle.
- The status pill shows only when there is something to say (connecting, listening, thinking, speaking, muted, a mood, an error); resting idle shows none. The dev-only preview row was removed (21 Oct). Moods: happy, curious, concerned, playful, surprised, excited, sad (`MOOD_EXPRESSIONS` in `robot/robotState.ts`).
- The mic button sits beside the "Message Buddy" box (during a voice chat: Mute and End). The bottom tab bar floats over the page, so the page keeps space for it.
- Not yet: earlier messages are not loaded when the tab opens (the companion keeps them on the backend), no voice for Buddy here.

## Live voice (2026-10-20)

- The mic button starts a live voice chat (tap again to end; leaving the tab or app ends it). Typing is off while it runs.
- Backend: `POST /api/v1/buddy/live` starts `app/buddy_voice.py`, which is Pod 4's voice pipeline (same STT/TTS adapters and fallbacks, VAD tap, STT guard, voice cues, sentence streaming, barge-in, one silence nudge per turn) with the companion writing the replies. `POST /api/v1/buddy/live/end` stops it. One live chat per account, 30 minutes at most.
- Robot: listening while connected, thinking from the end of your turn until Buddy's voice starts, speaking follows Buddy's real voice level, then the reply's mood until your next turn. Captions of both sides go into the chat.
- Talking over Buddy stops it; use earphones so Buddy's own voice from the speaker doesn't trigger this.

## Chat and Synth modes (2026-10-21)

- A small Chat / Synth toggle in the top bar. Saying or typing "synth" switches to Synth; "chat mode" switches back. A message with only the keyword gets a short spoken/typed acknowledgement without the LLM; "synth, kal 9 baje yaad dilana" switches and then handles the rest.
- Chat (default): Buddy talks and can read memory (`find_saved`) and search the web. Asked to save, it says to switch to Synth.
- Synth: every companion tool (save, reminders, to-dos, lists, notes, clear).
- Backend: `app/buddy.py` keeps two companions (one tool list each) on the same database and conversation, and each account's mode in memory (back to Chat after a backend restart). `GET/POST /api/v1/buddy/mode`.
- Not yet: reminders saved in Synth mode are not delivered on the phone.

## Theme, layout and crisp replies (2026-10-21)

- Top bar: a theme button (moon / sun) where Re-center was; Re-center is a long-press on the tilt button. The choice is remembered (`src/features/buddy/buddyTheme.ts`, AsyncStorage).
- Dark theme: true black (#000) for AMOLED screens, the app's wine and coral as the only colours, a soft coral glow behind the robot. The bottom tab bar follows the theme while the Buddy tab shows.
- The robot takes 46% of the screen height, just under the top bar. Messages fade out at the top of the chat (a Skia gradient) instead of being cut by a hard edge.
- Chat mode typed replies use the companion's spoken style (1–3 short sentences, at most 70 words, no lists or markdown); Synth mode keeps full replies. Done in `../resonance-backend/app/buddy.py` only.

## Cooler rendering (2026-10-21)

- The robot canvas draws only on request (`frameloop="demand"`). `FramePacer` in `robot/RobotCanvas.tsx` asks for 30 fps while something is happening (listening, thinking, speaking, error, a mood change, the phone being tilted, and 1.5 s after any change) and 15 fps while the robot just rests. Nothing is drawn while the tab or app is hidden.
- Animations use a time step of up to 0.1 s (`MAX_FRAME_STEP`), so they keep their speed at 15 fps.
- Resolution is unchanged: expo-gl always renders at the phone's native pixel density.
