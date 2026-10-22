/** What Edit Story collects and Public View shows, in the order the public profile reads. */

export type Photo = string | null;
export type Vignette = { title: string; body: string };

export const INTENT_OPTIONS = ['Lasting intimacy', 'Long-term partner', 'Open to see'] as const;
export type Intent = (typeof INTENT_OPTIONS)[number];

export type VoiceReflection = {
  title: string;
  /** Local file of the recording; null until they record one. */
  uri: string | null;
  durationSeconds: number;
};

/** The public view shows two story cards, so Edit Story keeps two vignettes. */
export const MAX_VIGNETTES = 2;
export const MAX_VOICE_SECONDS = 30;

/** "What Matches Can See" switches, in the order Edit Story lists them. */
export type Visibility = [vibeDeckHighlights: boolean, valuePillars: boolean, callReflections: boolean];

export function formatSeconds(total: number): string {
  const seconds = Math.max(0, Math.round(total));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** What a profile must have before it can be saved; everything else is optional. */
export type RequiredField = 'cover' | 'name' | 'age' | 'neighborhood';

export const REQUIRED_LABELS: Record<RequiredField, string> = {
  cover: 'a cover photo',
  name: 'your name',
  age: 'your age (18 or older)',
  neighborhood: 'your neighborhood',
};

/** The required fields still missing (or invalid, for age), in the order Edit Story shows them. */
export function missingRequired(profile: { photos: Photo[]; name: string; age: string; neighborhood: string }): RequiredField[] {
  const missing: RequiredField[] = [];
  if (!profile.photos[0]) missing.push('cover');
  if (!profile.name.trim()) missing.push('name');
  const age = Number(profile.age.trim());
  if (!profile.age.trim() || !Number.isInteger(age) || age < 18 || age > 99) missing.push('age');
  if (!profile.neighborhood.trim()) missing.push('neighborhood');
  return missing;
}
