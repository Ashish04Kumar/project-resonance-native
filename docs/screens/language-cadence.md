# Resonance Language & Cadence Selection

## Purpose

Let a new user choose the language style for the Chemistry Call and explain that Resonance adapts to their pace, pauses, and conversational nuances.

## Figma source

- File key: CSlmQXMias4ybx4duMt0dW
- Frame: Resonance — Language & Cadence Selection
- Node: 1:520
- Reference size: 393 × 844
- Figma remains the source of truth for layout, copy, color, and icon placement.

## Flow

1. The Welcome and Prologue screen's Get started action opens this screen.
2. English is selected by default. The user can switch between English and Hinglish.
3. Back and close return to the welcome screen.
4. Continue to Profile Setup will connect when that screen is implemented.

## Interaction and motion

- Language cards are accessible radio choices and update selected styling immediately.
- Content enters with short fades and upward transitions. Cards and the primary action use a restrained spring press response.
- Selection is held in screen state; persistence and localization are future work.

## Implementation notes

- Use the project's Cormorant Garamond and Plus Jakarta Sans as the closest available Figma font matches.
- Keep the Figma SVG icons in assets/icons/.
- The welcome photo is the supplied 512 × 279 JPEG. Keep its cover crop and source aspect ratio; the source resolution limits sharpness on high-density phones.

## Acceptance checks

- Get started opens Language Selection.
- English starts selected; choosing Hinglish moves the selected radio state.
- Back and close return to Welcome.
- The selection screen fits common Android heights and scrolls on smaller devices.
- The welcome photograph fills its card without stretching or a changed crop.
