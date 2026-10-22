# Resonance app (resonance-native)

This file is the source of truth for the Resonance Android app (Expo, React Native, TypeScript). It is a living file: the owner keeps adding to it as the project grows. When this file and any other document disagree, follow this file, and ask the owner if it is still unclear.

The backend (Synthe call, accounts, profiles, swipes, Buddy chat) is a separate project in `../resonance-backend`; see its `AGENTS.md` and `README.md`. Screen specs are in `docs/screens/`, the product overview in `docs/PRODUCT_OVERVIEW.md`. The full product and technical documentation is `docs/Frontend-Documentation.pdf` (not added yet). Read both before starting a new milestone.

## About the owner and how to work with them

The owner is new to React Native and relies on you for most of the code. Therefore:

- Before any large change, say in one or two plain sentences what you are about to do and why.
- Prefer simple, readable code over clever code. Add short comments where a beginner would be confused (Reanimated worklets, gesture handlers, Skia drawing).
- Work in small steps. Finish one milestone, verify it, summarise, then stop and wait. Do not start the next milestone on your own.
- After each milestone give a short note: how to run it, what to look at, what is still fake or missing.
- Never silently add a library that is not listed in the tech stack below; ask first.
- If something is unclear or the docs conflict with this file, ask the owner. Do not guess.

## Verification loop (important)

You cannot judge animation quality from code alone. For every milestone:

1. Run `npx tsc --noEmit`, lint, and the test suite. All must pass.
2. Run the app on an Android emulator or the owner's real phone (development build) and exercise the screens you changed. If you have a device or emulator automation tool available, use it to tap through the flow, read the screen and check logs. If you do not, say so clearly and give the owner exact steps to check by hand.
3. For anything animated, tell the owner exactly what motion to look for and what would look wrong, so they can judge it on a real device. Never claim an animation "looks smooth" unless you actually watched it run.
4. Report honestly what you verified and what you could not verify.

## What we are building

An Android app for Resonance's Chemistry Call, a 15-18 minute Hinglish journey:

consent -> mic permission -> voice call (Part 1, 8 questions) -> transition -> Chemistry Lab (4 games) -> resume -> voice call (Part 2) -> Connection Blueprint review and save.

The look is warm, intimate and modern: deep twilight backgrounds, glowing coral accent, glass cards, a living voice orb, smooth 60 fps motion. It must never feel like a form.

## Design source (Figma)

The Figma file is the visual source of truth for layout, colours, fonts, spacing and components. Use the Figma MCP server to read it; do not guess from memory.

- If Figma and this file disagree on how something looks, follow Figma and tell the owner which token or value changed.
- If they disagree on behaviour or rules, follow this file and ask the owner.
- Build one screen at a time from the Figma link the owner gives you.
- Icons and illustrations are exported by the owner into `assets/`. Until they exist, use simple placeholders named exactly like the final asset so they can be swapped without code changes.
- Figma does not describe motion. Use sensible spring and fade animations, keep them short, and tell the owner what to check on the phone.

## Tech stack

| Need | Choice |
| --- | --- |
| Language | TypeScript, strict mode, no `any` |
| Framework | Expo with development builds (not Expo Go; live voice needs native code) |
| Navigation | Expo Router (file-based) |
| Animation | React Native Reanimated, Gesture Handler |
| Graphics | React Native Skia (voice orb, glow, particles) |
| Illustration motion | lottie-react-native |
| Haptics | expo-haptics |
| Server data | TanStack Query |
| App state | Zustand |
| Local storage | MMKV (drafts, outbox, resume) |
| Secrets | expo-secure-store |
| Validation | Zod |
| Voice | WebRTC via a provider SDK behind a `VoiceClient` interface (provider not decided yet) |
| Errors | Sentry |
| Tests | Jest, React Native Testing Library, Maestro for end-to-end |
| Build and release | EAS Build and EAS Submit |

Do not pin library versions from memory. Create the project with the current stable Expo SDK and use `npx expo install` so versions match. If a library needs native config, use Expo config plugins and tell the owner what changed.

## Project structure

```
resonance-native/
  src/app/                 # Expo Router: each file is a screen
    _layout.tsx            # providers, fonts, splash control
    index.tsx              # splash and routing decision
    consent.tsx
    permissions.tsx
    call.tsx
    lab/
      index.tsx            # hub
      scenario.tsx         # Game A
      spectrum.tsx         # Game B
      priorities.tsx       # Game C
      decision.tsx         # Game D
    resume.tsx
    blueprint.tsx
    settings.tsx
  src/
    theme/                 # tokens, typography, motion, useTheme
    components/            # shared UI components
    features/
      call/                # voice client, call store, captions
      lab/                 # game logic, schemas, hooks
      blueprint/           # grouping, edit logic
    api/                   # typed client, endpoints, Zod schemas
    state/                 # Zustand stores, persistence
    services/              # haptics, audio session, analytics, sentry
    i18n/                  # hinglish.ts, english.ts
    utils/
  assets/
    lottie/ illustrations/ fonts/ icons/
  __tests__/
  maestro/
```

Rules: screens in `app/` only compose components and call hooks. No business logic and no raw network calls in screens. Game rules and blueprint logic are pure functions in `src/features` so they are easy to test.

## Current focus

- Milestones 2 and 3 are implemented: Resonance Welcome and Prologue (Figma node `1:468`) and Language & Cadence Selection (node `1:520`). Android device visual QA is still pending.
- Continue one screen at a time from the Figma file and the relevant Markdown screen specification. The referenced `docs/Frontend-Documentation.pdf` has not yet been added.
- The app talks to the backend over HTTP and LiveKit; the call's voice pipeline (Pod 4, Synthe) and Buddy's brain live in `../resonance-backend` (`docs/pod4-architecture.md` there).

## Decisions log

Add a dated line here whenever the owner decides something, so it is never asked twice. App-related decisions only; backend decisions are in `../resonance-backend/AGENTS.md`.

- 2026-10-14: Use Project Synq as the temporary project/app name; do not use the earlier working name. The first screen is Figma's BondAI Welcome & Prologue frame, node 1:468.
- 2026-10-17: The owner selected Gemini Live for native real-time audio conversation and explicitly approved streaming live call audio to Google. Gemini Live is the primary voice path; preserve local Whisper/Ollama/Piper as a startup fallback, disclose cloud audio processing on the consent screen, keep the API key server-side, and retain captions only in temporary in-memory sessions.
- 2026-10-17: App start flow: a theme-matched infinite loader on launch; signed-in users go straight to Language & Cadence, everyone else sees Welcome, whose Get started and Sign in open the auth screen (Continue with Google as UI only for now, email sign-up and sign-in stored in Postgres), then Language & Cadence. Language & Cadence stays untouched. Backend uses asyncpg and argon2-cffi (with PyJWT); tokens on the phone use expo-secure-store (needs a new development build). See `docs/screens/auth.md`.
- 2026-10-18: The 3D robot (`assets/avatar-3d/gg2.glb`) goes in the centre of the Buddy tab; the voice call screen stays untouched. The owner approved expo-gl, expo-asset, expo-file-system, expo-sensors, three and @react-three/fiber (plus gltf-transform as a dev-only tool) for it. See `docs/screens/buddy.md`.
- 2026-10-18: A profile needs a cover photo, name, age and neighborhood (everything else optional), checked in the app and the backend. On launch, a signed-in user with a finished profile opens Buddy; one without opens Edit Story, prefilled with anything saved. See `docs/screens/profile.md`.
- 2026-10-18: The Swipes deck shows real profiles from the database (everyone else's finished profile). Send Spark records a spark; Pass records nothing. Reset (top left) clears my sparks so the whole list shows again. Tapping a card opens that person's full Public View. 10 dummy test profiles are seeded by `../resonance-backend/scripts/seed_dummy_profiles.py`. See `docs/screens/swipes.md`.
- 2026-10-19: The call companion is named Synthe (not Aria) on the call screen and in Pod 4, which introduces itself as Synthe. Pods 5 and 6 keep their own prompts unchanged. The call screen no longer shows who-is-speaking text; colour shows it.
- 2026-10-20: The Buddy tab chats with the companion embedded in the Resonance backend (`../resonance-backend/app/buddy.py`, `POST /api/v1/buddy/chat`, login required, streamed JSON lines). The companion is installed as a fixed version (`pip install ../companion-umbrella`, reinstall to update) and its code is never changed from Resonance. Conversation only: the adapter keeps just `web_search` and `find_saved` and turns its "where should I save?" offers into "I can't save here yet". It uses `companion-umbrella/.env` (path `BUDDY_COMPANION_ENV`) without changing the backend's own keys; each account is companion user `resonance:<id>`. The robot thinks while waiting, talks while text streams, then shows the reply's mood for 8 s.
- 2026-10-20: Buddy's live voice (mic button on the Buddy tab) runs on Pod 4's own voice pipeline: Pod 4's STT/TTS adapters and fallbacks, VAD tap, STT guard, voice cues, sentence streaming and barge-in, with the embedded companion writing the replies (`../resonance-backend/app/buddy_voice.py`, `POST /api/v1/buddy/live`). Not the companion's own voice stack. Pod 4 itself is unchanged.
- 2026-10-21: Buddy has two modes, chosen with a Chat / Synth toggle on the Buddy tab or by saying "synth" / "chat mode". Chat (default) keeps only memory reading and web search; Synth gets every companion tool (save, reminders, to-dos, lists, notes, clear). Both are done in `../resonance-backend/app/buddy.py` as two companions on the same database and conversation; companion-umbrella is not changed (its saving rules stay in the chat-mode prompt for now). Reminders are not yet delivered on the phone. Today Groq goes first for Pod 4 (`SYNQ_POD4_LLM=groq`, fallback `groq_backup,gemini,ollama`, so a per-minute 429 on the main Groq model goes to the second Groq model before slow Gemini or laptop Ollama) and Buddy (`BUDDY_COMPANION_LLM=groq_backup`, then `gemini_lite,groq,gemini`, so a slow Gemini 3.7 Flash comes last), because Gemini was timing out or returning 503.
- 2026-10-21: Buddy's two modes are shown as "Buddy" (internally `chat`) and "Umbrella" (internally `synth`, the full companion). Each runs on its own companion thread with fully separate history and saved data: `buddy` and `umbrella` for user `resonance:<id>`; the older `main` thread is left as it is. Both threads show in companion-umbrella's playground (same database); its live Trace panel does not, because Resonance runs in another process. Keywords: "umbrella mode" / "synth" and "buddy mode" / "chat mode".
- 2026-10-22: The app and project are now called Resonance everywhere people see a name (app label, screens, docs, backend titles); BondAI and Project Synq are retired. The voice call bot stays Synthe, Buddy stays Buddy. Internal names were kept so nothing breaks: the `SYNQ_*` settings, the `synq` / `synq_test` databases (Umbrella uses `synq` too), the Android app id `com.anonymous.projectsynq`, the Expo slug/scheme `project-synq` and the `project-synq.*` saved keys on the phone. Each Buddy caller is `resonance:<id>`. The app label change shows after the next Android dev build.
- 2026-10-22: The project was split into two sibling folders: `/home/bs/projects/resonance-native` (this Expo app) and `/home/bs/projects/resonance-backend` (the FastAPI backend: Synthe call, accounts, profiles, swipes and the embedded Buddy companion). Each has its own `AGENTS.md`, `README.md` and `docs/`. Decisions that touch both are written in both files.

## Owner's notes (add anything new below)

## Current screen implementation

- The first screen uses the Figma Resonance Welcome & Prologue frame (node 1:468).
- App launch shows the loop loader, then Welcome (or Language & Cadence when already signed in). Welcome's Get started and Sign in open the auth screen, which leads to Language & Cadence Selection (Figma node 1:520, docs/screens/language-cadence.md). See docs/screens/auth.md.
- Project/app name: Resonance (earlier Project Synq and BondAI). The Welcome wordmark reads Resonance; the rest of the Figma copy is kept.
- Screen notes: docs/screens/welcome-prologue.md.

## Expo guidance

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
