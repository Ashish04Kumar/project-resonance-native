/**
 * The landing page's bottom tab bar (Swipes, Buddy, Profile, Resonance) floats over the tab's
 * page. Its height lives here so the bar and the pages under it agree exactly:
 * 10 top padding + 58 for the icon and label + the phone's bottom inset (at least 12).
 */
export function navBarHeight(bottomInset: number): number {
  return 10 + 58 + Math.max(bottomInset, 12);
}
