# Resonance welcome and prologue

## Purpose

This is the first in-app screen for Resonance. It introduces the Resonance experience and leads into onboarding.

## Figma source

- File key: CSlmQXMias4ybx4duMt0dW
- Frame: Resonance — Welcome & Prologue
- Node: 1:468
- Reference size: 390 × 884.5
- The Figma frame is the source of truth for layout, copy, typography, colors, imagery, and icons.

## Screen content

- Centered Resonance wordmark with the infinity emblem.
- Editorial subtitle: “A journal of mutual resonance”.
- Feature photo card with the issue label, decorative flourish, and resonance badge.
- Headline: “Where depth finds resonance.”
- Supporting copy: “Curated encounters, cultivated with intention.”
- Primary action: “Get started”.
- Sign-in link: “Already a member? Sign in”.

The layout and copy follow the supplied Figma design; the wordmark now reads Resonance (the design said BondAI). Resonance is the app/project name.

## Visual tokens

- Canvas: #FAF7F2
- Wine accent: #501C24 / CTA #521C26
- Main text: #1C1917
- Secondary text: #57534E
- Heading/wordmark: Cormorant Garamond
- Interface copy: Plus Jakarta Sans
- Card: 32 px corner radius, 425 px high at the reference width, 16 px inset badges

## Assets

Figma exports are stored locally under assets/images, assets/icons, and assets/fonts. Do not reference temporary Figma URLs from app code. Both font families are distributed under the SIL Open Font License; license files are stored beside them.

## Motion and interaction

Figma does not specify motion. The screen uses short fade/vertical entrance transitions and a restrained spring press state on the primary action. Keep the motion subtle and avoid continuous effects that shift the supplied layout.

The Get started action opens the Language & Cadence Selection screen. Sign-in remains a placeholder until its flow is implemented.

## Manual review

Run npm start from this folder and open Android. Compare the welcome screen with the Figma frame at 390 px wide: verify card crop, top and bottom spacing, badge/icon alignment, typography, and the button dimensions. The card and text should enter smoothly once; the primary button should compress slightly while pressed and return without bounce or lingering movement.
