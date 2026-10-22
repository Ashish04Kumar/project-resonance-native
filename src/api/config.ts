import Constants from 'expo-constants';

/** The laptop's address as Expo Metro sees it (the phone reaches the backend on the same network). */
export function expoHost(): string | null {
  return Constants.expoConfig?.hostUri?.split(':')[0] ?? null;
}

/** Backend base URL: EXPO_PUBLIC_API_URL if set, otherwise port 8000 on the Metro host. */
export function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, '');
  const host = expoHost();
  if (!host) throw new Error('Set EXPO_PUBLIC_API_URL to the computer IP reachable by this phone.');
  return `http://${host}:8000`;
}
