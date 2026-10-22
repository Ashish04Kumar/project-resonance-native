/**
 * Lets another screen ask the landing page to show the Buddy tab the next time it
 * comes into view (used by Edit Story / Public View: back from your profile always
 * lands on Buddy). Coming back from anything else keeps the tab you were on.
 */
let buddyNext = false;

export function showBuddyNext(): void {
  buddyNext = true;
}

export function takeShowBuddyNext(): boolean {
  const value = buddyNext;
  buddyNext = false;
  return value;
}
