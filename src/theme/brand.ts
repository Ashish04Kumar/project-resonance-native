import { useFonts } from 'expo-font';

/** Resonance palette from the Welcome & Prologue Figma frame (node 1:468). */
export const BRAND = {
  background: '#FAF7F2',
  surface: '#FDFBF7',
  wine: '#501C24',
  button: '#521C26',
  ink: '#1C1917',
  muted: '#57534E',
  quiet: '#78716C',
  line: '#D6D3D1',
  error: '#9F1D2C',
  errorSurface: '#FBEDEE',
} as const;

/** The loop emblem (assets/icons/welcome-loop.svg), drawn on a 24 x 16 box. */
export const LOOP_PATH =
  'M6.42857 13.1429C3.35143 13.1429 0.857143 10.6486 0.857143 7.57143C0.857143 4.49429 3.35143 2 6.42857 2' +
  'C9.08571 2 11.0571 4.4 12 7.57143C12.9429 4.4 14.9143 2 17.5714 2C20.6486 2 23.1429 4.49429 23.1429 7.57143' +
  'C23.1429 10.6486 20.6486 13.1429 17.5714 13.1429C14.9143 13.1429 12.9429 10.7429 12 7.57143' +
  'C11.0571 10.7429 9.08571 13.1429 6.42857 13.1429Z';

export function useBrandFonts() {
  const [loaded] = useFonts({
    CormorantGaramond: require('../../assets/fonts/CormorantGaramond[wght].ttf'),
    CormorantGaramondItalic: require('../../assets/fonts/CormorantGaramond-Italic[wght].ttf'),
    PlusJakartaSans: require('../../assets/fonts/PlusJakartaSans[wght].ttf'),
  });
  return loaded;
}
