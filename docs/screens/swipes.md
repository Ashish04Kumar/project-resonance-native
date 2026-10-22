# Swipes

The Swipes tab shows everyone else's finished profile from the backend as a deck of cards. The top bar has Reset on the left and the profile button on the right (no wordmark). It is reached from the Swipes item in the Buddy landing navigation; Buddy remains the default tab.

## Interaction

- Drag a card left to pass or right to send a spark. A short, fast flick also completes the action.
- The card follows the finger, tilts slightly, and reveals a matching action label. If released before the threshold, it springs back into place.
- The Pass and Send Spark buttons run the same exit animation as their matching gestures.
- While dragging, the photo shows the direction: right adds a warm gold glow with a glass sparkle badge, "Send a spark" and drifting sparkles; left adds a deep plum shade with a ✕ badge and "Not this time". Past the threshold a small "RELEASE TO SEND / PASS" hint appears. (`SwipeFeedback.tsx`)
- The matching button follows the drag: Send Spark gets a gold glow and a turning sparkle; Pass fills with a soft plum tint, a darker border and a turning ✕. When a swipe is sent, Send Spark bursts a few sparkles and Pass sends out one soft ring.
- Haptics (`src/services/haptics.ts`): on Android each pattern starts with a system effect, then short crisp taps (React Native `Vibration`, 9–18 ms each). Richer moments get a quick echo tap instead of one long buzz, which reads as premium rather than cheap. Crossing the send point: a crisp tick toward Spark, a softer one toward Pass (once per crossing). Sent: Spark a tap plus two light ticks (a twinkle); Pass a tap with a soft echo. Same when using the buttons. iOS uses impact taps.
- Three prototype profiles are shown per session, followed by an all-caught-up state.
- The profile shortcut opens Edit Profile.

## Prototype data

Profiles and voice excerpts are local sample content. Portraits load from Unsplash URLs. The voice button explains that playback is not wired until profile audio is available. Profile fetching, persisted decisions, and real audio playback are not connected yet.

## Data

- `GET /api/v1/discover`: every other user's finished profile (cover photo, age and neighborhood set), with whether I've already sparked them. Sparked people are left out of the deck.
- Send Spark (swipe right, the button, or on the full profile) records a row in `sparks` (`POST /api/v1/sparks`). Pass records nothing; a passed card comes back the next time the deck loads.
- Reset (top left, or Start over when the deck is empty) deletes my sparks (`POST /api/v1/sparks/reset`) and reloads, so the whole list shows again.
- Code: `../resonance-backend/app/discovery.py`, `src/features/swipes/deckApi.ts`.

## Full profile

- Tapping the photo opens the person's full Public View (`/match/[id]`), sliding up over the deck. It reuses `PublicMatchProfile` in "match" mode: a Close button instead of Edit Profile, and no Chemistry Call slider.
- A bar at the bottom has Pass and Send Spark. Choosing one closes the page, and the deck plays that swipe on the card (`deckStore.ts`).
- The card's voice card plays the person's real voice reflection.

## Dummy profiles

- `../resonance-backend/scripts/seed_dummy_profiles.py` creates 10 test accounts (`…@dummy.synq.test`, no password, so nobody can sign in as them) with every profile field filled. Running it again replaces them.
- Photos are Unsplash stock photos, stored as media rows with `external_url`; `/api/v1/media/{id}` redirects to them.
- Voice reflections are spoken by the laptop's Piper voice (en_US-amy-medium) and saved as M4A under `../resonance-backend/media/`. There's only one (female) voice, so the men's recordings are pitched down; they sound synthetic. Test data only; these people don't exist.
