import type { DeckProfile } from './deckApi';

/**
 * Shared between the swipe deck and the full profile page (/match/[id]):
 * - the profiles last loaded by the deck, so the profile page opens instantly;
 * - a Pass / Send Spark chosen on the profile page, which the deck plays as a swipe
 *   when it is shown again.
 */
const profiles = new Map<string, DeckProfile>();
let pending: { userId: string; direction: 'pass' | 'spark' } | null = null;

export function rememberDeck(items: DeckProfile[]): void {
  profiles.clear();
  for (const item of items) profiles.set(item.userId, item);
}

export function deckProfile(userId: string): DeckProfile | undefined {
  return profiles.get(userId);
}

export function chooseFromProfile(userId: string, direction: 'pass' | 'spark'): void {
  pending = { userId, direction };
}

/** The choice made on the profile page, once; null if there is none. */
export function takeProfileChoice(): { userId: string; direction: 'pass' | 'spark' } | null {
  const choice = pending;
  pending = null;
  return choice;
}
