# Resonance voice call

## Purpose

A calm, intimate voice-call screen reached from the public match profile. From Edit Profile, tapping “Save and preview profile” opens Public View; sliding the control at the end of that profile starts this screen.

## Visual reference

Use the supplied `Main - PhoneFrame.png` reference: deep plum canvas, restrained berry glow, elapsed timer, companion name, central voice orb with concentric rings, listening status, and four bottom controls. The center uses a Skia-rendered rose gradient orb, one broad, bright center-out radial glow with no separate concentric circle bands; the glow should spread close to the available screen width and respond to voice by softly expanding and brightening, and a wider speech-reactive waveform. Slowly shift the glow between muted rose, coral, and berry tones, with a restrained voice-linked tint change; keep the transitions subtle and the orb integrated into the plum background. The UI is built without placeholder photography.

## Interaction

- Swipe the profile control to the right to open the call screen.
- The timer pauses when minimized and resumes from that exact elapsed time; the Resume Call button shows the paused time.
- The down chevron minimizes the active session and returns to Public View, where a Resume Call button replaces the swipe control. Ending the call clears the session and restores the swipe control.
- LiveKit requests microphone permission when the app joins the call room. Voice is streamed over WebRTC to the locally running Resonance backend for Whisper transcription, LangGraph response generation, and Piper speech; the prototype does not record audio or persist transcripts.
- Mute and Hold disable microphone publishing; Resume republishes it. Minimize disconnects the room while preserving the in-memory conversation; Resume Call rejoins that session. End disconnects, clears the backend session, and returns to the profile.
- The orb and waveform respond to real LiveKit microphone and AI audio levels. The background keeps its slow, low-contrast color shift.
- Speaker switches the native audio output route. Calls show a connection error if the backend, local AI model, or LiveKit server is unavailable.
- LiveKit requires a custom Expo development build; it cannot run in Expo Go. Android device verification is still pending.


## 2026-10-18 redesign (owner request: more modern, light animation, colour by speaker)

- **Backdrop** (`CallVisuals.tsx` → `CallBackdrop`): three large, slowly drifting radial colour fields on a deep twilight base (≈14 s loop).
- **Colour shows who is talking, subtly:** Aria speaking → warm coral / rose / magenta; you speaking → cool teal / sky / lavender; nobody → calm wine. The levels come from the real LiveKit track volumes (Aria's and your microphone), eased on the UI thread, and every colour blends between the three palettes.
- **Orb** (`VoiceOrb`): a glowing core and halo in the current speaker's colours that breathes with the voice, three thin ripple rings that grow outward while someone talks (invisible in silence), and the speech bars inside.
- **Status pill** with a dot in the speaker's colour; **live caption** of the last line (Aria or you) under the orb, fading in; **timer** in a glass pill with a live dot (grey while connecting); controls in a translucent **dock**; the active control glows.
- Behaviour, controls, labels, call log, safety card, consent and connection screens are unchanged. Skia + Reanimated only (no new libraries).

- 2026-10-19: The AI is called **Synthe** on the call screen (name, live caption, call log) and in Pod 4's prompts, so it introduces itself as Synthe. The speaking/listening labels ("ARIA IS SPEAKING", "LISTENING WITH YOU", "LISTENING SOFTLY") were removed; colour shows who is talking. The status pill appears only for hold, mute and connecting.
