import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/**
 * The Buddy tab's theme: light (cream) or dark (true black for AMOLED screens, so only the
 * robot and the chat glow). The choice is shared with the bottom tab bar and remembered.
 */
export type BuddyThemeName = 'light' | 'dark';

export type BuddyPalette = {
  background: string;
  /** Pills, the message box, Buddy's bubbles. */
  card: string;
  line: string;
  ink: string;
  muted: string;
  /** Selected toggles, the send button. */
  accent: string;
  onAccent: string;
  /** My message bubbles. */
  mine: string;
  /** The soft mic button. */
  soft: string;
  softBorder: string;
  /** The robot's 3D scene. */
  scene: string;
  /** Halo glow behind the robot (r, g, b in 0..1) and how strong it is. */
  halo: [number, number, number];
  haloStrength: number;
  /** Bottom tab bar. */
  nav: string;
  navLine: string;
  navActive: string;
  navIdle: string;
};

export const BUDDY_THEMES: Record<BuddyThemeName, BuddyPalette> = {
  light: {
    background: '#FCF8F7',
    card: '#FFFFFF',
    line: '#EDE3E0',
    ink: '#251719',
    muted: '#8A7774',
    accent: '#521C26',
    onAccent: '#FFFFFF',
    mine: '#521C26',
    soft: '#FFE4DE',
    softBorder: '#521C26',
    scene: '#FCF8F7',
    halo: [0.97, 0.66, 0.66],
    haloStrength: 1,
    nav: '#FCF8F7',
    navLine: '#EDE3E0',
    navActive: '#7D293B',
    navIdle: '#93817F',
  },
  // True black (pixels off on AMOLED) with the app's wine and coral as the only colour.
  dark: {
    background: '#000000',
    card: '#110A0C',
    line: '#2A181D',
    ink: '#F6E8EA',
    muted: '#9B8287',
    accent: '#FF7A8A',
    onAccent: '#1B0610',
    mine: '#5C1A35',
    soft: '#2A0F1A',
    softBorder: '#FF7A8A',
    scene: '#000000',
    halo: [1.0, 0.42, 0.52],
    haloStrength: 0.7,
    nav: '#000000',
    navLine: '#1E1115',
    navActive: '#FF7A8A',
    navIdle: '#7A6267',
  },
};

const STORAGE_KEY = 'buddy.theme';
let current: BuddyThemeName = 'light';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

// Load the saved choice once; the light theme shows until it arrives.
void AsyncStorage.getItem(STORAGE_KEY)
  .then((saved) => {
    if (saved === 'dark' || saved === 'light') {
      current = saved;
      emit();
    }
  })
  .catch(() => undefined);

export function toggleBuddyTheme(): void {
  current = current === 'dark' ? 'light' : 'dark';
  emit();
  void AsyncStorage.setItem(STORAGE_KEY, current).catch(() => undefined);
}

/** The current theme name and palette; re-renders when it is toggled anywhere. */
export function useBuddyTheme(): { name: BuddyThemeName; palette: BuddyPalette } {
  const name = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
  return { name, palette: BUDDY_THEMES[name] };
}
