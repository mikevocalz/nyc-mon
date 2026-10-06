'use client';

import { createMMKV } from 'react-native-mmkv';
import type { ScheduleStorage } from './schedule-storage.types';

const mmkv = createMMKV({ id: 'nyc-mon-schedule' });

export const scheduleStorage: ScheduleStorage = {
  getString: (key) => mmkv.getString(key),
  set: (key, value) => mmkv.set(key, value),
  remove: (key) => mmkv.remove(key),
};
