'use client';

import { createMMKV } from 'react-native-mmkv';
import type { KeyValueStorage } from './storage.types';

const onboarding = createMMKV({ id: 'nyc-mon' });
const save = createMMKV({ id: 'nyc-mon-save' });

export const onboardingStorage: KeyValueStorage = {
  getString: (key) => onboarding.getString(key),
  set: (key, value) => onboarding.set(key, value),
  remove: (key) => onboarding.remove(key),
};

export const saveStorage: KeyValueStorage = {
  getString: (key) => save.getString(key),
  set: (key, value) => save.set(key, value),
  remove: (key) => save.remove(key),
};
