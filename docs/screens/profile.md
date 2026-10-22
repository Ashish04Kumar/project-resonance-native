# Edit Story and Public View

Edit Story collects what the Public View shows, in the same order: cover photo, name and age, neighborhood, calling and craft, introduction and intent, voice reflection, two vignettes (each shown with photo 2 or photo 3), and what matches can see.

## Saving

- The profile is saved per signed-in account in Postgres (`profiles`); photos and the voice recording go to `media`, with the files on disk under `../resonance-backend/media/` (`MEDIA_DIR`).
- Opening Edit Profile loads the saved profile. The first time, it starts empty with the account's name, and the Edit Story / Public View switch stays hidden until the first save.
- Save uploads new photos and a new recording (files already on the server are reused), then saves everything and opens Public View. The button reads "Save profile" the first time and "Save changes" after.
- Required: cover photo, name, age (18–99) and neighborhood. Everything else is optional. Save shows what's missing and marks those fields; the backend rejects a profile without them (422).
- Polish tone rewrites the introduction with the backend LLM (the Pod 4 provider chain) in the user's own voice, at about the same length; Undo restores the previous text.

## Where the app opens

- Signed in with a finished profile (the four required fields): Buddy (`/landing`).
- Signed in without one: Edit Story (`/edit-profile`), filled in with whatever was saved before.
- Not signed in: Welcome. After sign-in, a finished profile goes to Buddy; otherwise onboarding continues with Language & Cadence, then Edit Story.
- The answer is remembered on the phone per account, so the app opens on the right page even when the backend can't be reached.
- Back from Edit Story or Public View (the header arrow or the phone's back button) always returns to Buddy. Before the first save, back instead says which required fields are still missing, since a profile is required. Returning to the landing page always shows the Buddy tab.

## API (all need `Authorization: Bearer`, except reading a file)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/profile` | 404 before the first save |
| PUT | `/api/v1/profile` | Create or replace. Photos: 3 slots of media ids or null; voice: title, media id, duration |
| POST | `/api/v1/profile/media?kind=photo\|voice` | Raw file body. Photos: JPEG, PNG, WebP, HEIC/HEIF up to 12 MB. Voice: M4A/MP4/3GP up to 6 MB. The type is detected from the file's first bytes; the declared Content-Type is ignored, because Android pickers often send a generic or missing one. |
| GET | `/api/v1/media/{id}` | The file. Ids are random UUIDs (an unlisted link) |
| POST | `/api/v1/profile/polish-bio` | `{text}` → `{text}` |

Files replaced more than 10 minutes ago are deleted when the profile is saved again.

## Not yet

- Media links work without a token because they can't be guessed. Before launch, decide whether matches should get signed, expiring links instead.
- The "Vibe Deck Highlights" switch no longer controls anything since Lifestyle Anchors were removed.
- Shared Resonance is still fixed text; it should come from comparing two blueprints.
