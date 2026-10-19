'use client';

import * as Audio from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import { getNotifyPermission, requestNotifyPermission } from './notify-permission';
import type { PermissionAccess, PermissionId } from './permission-center-model';

interface PermissionResponse {
  granted: boolean;
  status: string;
  canAskAgain?: boolean;
}

function normalize(response: PermissionResponse): PermissionAccess {
  if (response.granted) return 'granted';
  if (response.status === 'denied') return response.canAskAgain === false ? 'blocked' : 'denied';
  return 'undetermined';
}

async function readOrRequest(
  get: () => Promise<PermissionResponse>,
  request?: () => Promise<PermissionResponse>,
): Promise<PermissionAccess> {
  try {
    const current = normalize(await get());
    if (!request || current === 'granted' || current === 'blocked') return current;
    return normalize(await request());
  } catch {
    return 'unavailable';
  }
}

async function notification(request: boolean): Promise<PermissionAccess> {
  const current = await getNotifyPermission();
  if (current === 'granted') return 'granted';
  // The existing M06 helper cannot distinguish a retryable OS denial.
  // Treat it as settings-only rather than spam the system permission prompt.
  if (current === 'denied') return 'blocked';
  if (current === 'unsupported') return 'unavailable';
  if (!request) return 'undetermined';
  const result = await requestNotifyPermission();
  return result === 'unsupported' ? 'unavailable' : result;
}

async function sensorAvailable(): Promise<boolean> {
  try {
    return await DeviceMotion.isAvailableAsync();
  } catch {
    return false;
  }
}

async function readPermission(id: PermissionId, request: boolean): Promise<PermissionAccess> {
  switch (id) {
    case 'notifications':
      return notification(request);
    case 'location':
      return readOrRequest(Location.getForegroundPermissionsAsync, request ? Location.requestForegroundPermissionsAsync : undefined);
    case 'camera':
      return readOrRequest(ImagePicker.getCameraPermissionsAsync, request ? ImagePicker.requestCameraPermissionsAsync : undefined);
    case 'microphone':
      return readOrRequest(Audio.getRecordingPermissionsAsync, request ? Audio.requestRecordingPermissionsAsync : undefined);
    case 'motion':
      if (!(await sensorAvailable())) return 'unavailable';
      return readOrRequest(DeviceMotion.getPermissionsAsync, request ? DeviceMotion.requestPermissionsAsync : undefined);
    case 'photos':
      // Save-only access; picking a photo does not require broad library permission.
      return readOrRequest(
        () => ImagePicker.getMediaLibraryPermissionsAsync(true),
        request ? () => ImagePicker.requestMediaLibraryPermissionsAsync(true) : undefined,
      );
  }
}

export function getDevicePermission(id: PermissionId): Promise<PermissionAccess> {
  return readPermission(id, false);
}

export function requestDevicePermission(id: PermissionId): Promise<PermissionAccess> {
  return readPermission(id, true);
}
