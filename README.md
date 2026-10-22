# Resonance Android app

The app opens on the Resonance Welcome and Prologue screen implemented from the supplied Figma design.

## Run the app and Chemistry Call

LiveKit includes native Android WebRTC code, so the voice call needs a custom development build rather than Expo Go. Start the backend and LiveKit server first as described in [../resonance-backend/README.md](../resonance-backend/README.md), then from this folder:

```bash
npx expo run:android
npx expo start --lan
```

If Android Studio/SDK is unavailable on the development machine, build an installable development APK with EAS after signing in to your Expo account:

```bash
npx eas-cli build --platform android --profile development
```

Open the newly installed Resonance development build, allow microphone access, and start the call from the public profile slider. Keep the phone and computer on the same Wi-Fi network.

The Figma source, screen copy, visual tokens, local assets, motion guidance, and manual review checklist are documented in docs/screens/welcome-prologue.md.

The backend controls conversation pods through `SYNQ_CONVERSATION_POD` in `../resonance-backend/.env`; the mobile app does not select a pod. See [conversation-pods.md](../resonance-backend/docs/conversation-pods.md).
