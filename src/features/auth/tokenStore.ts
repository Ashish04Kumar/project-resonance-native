import AsyncStorage from '@react-native-async-storage/async-storage';

type KeyValueStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

/**
 * Login tokens live in the encrypted keychain/keystore (expo-secure-store).
 * expo-secure-store has native code, so a development build made before it was
 * added doesn't contain it; then we fall back to AsyncStorage until the next build.
 */
function loadSecureStore(): KeyValueStore | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
    return {
      get: (key) => SecureStore.getItemAsync(key),
      set: (key, value) => SecureStore.setItemAsync(key, value),
      remove: (key) => SecureStore.deleteItemAsync(key),
    };
  } catch {
    if (__DEV__) {
      console.warn('expo-secure-store is not in this build; using AsyncStorage for login tokens until you rebuild.');
    }
    return null;
  }
}

const fallbackStore: KeyValueStore = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
};

export const tokenStore: KeyValueStore = loadSecureStore() ?? fallbackStore;
