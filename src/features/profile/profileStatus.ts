import AsyncStorage from '@react-native-async-storage/async-storage';

import { getProfile } from './profileApi';
import { missingRequired } from './profileModel';

/**
 * Whether the signed-in user has finished their profile (cover photo, name, age and
 * neighborhood). The answer is also remembered on the phone, so the app still opens on
 * the right page when the backend can't be reached.
 */
const key = (userId: string) => `project-synq.profile-complete.${userId}`;

export async function rememberProfileComplete(userId: string, complete: boolean): Promise<void> {
  await AsyncStorage.setItem(key(userId), complete ? 'true' : 'false').catch(() => undefined);
}

export async function isProfileComplete(userId: string): Promise<boolean> {
  try {
    const profile = await getProfile();
    const complete = profile !== null && missingRequired(profile).length === 0;
    await rememberProfileComplete(userId, complete);
    return complete;
  } catch {
    // Offline or the backend is down: use the last answer seen on this phone.
    return (await AsyncStorage.getItem(key(userId)).catch(() => null)) === 'true';
  }
}
