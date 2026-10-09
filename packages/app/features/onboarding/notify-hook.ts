'use client';

/**
 * Entry for the root layout. The package's `exports` map has no extension
 * probing, so the route imports this file by its full name and the relative,
 * extensionless import below keeps the `.native` fork for Metro (same reason
 * `NotifyGate` lives in this package).
 */
export { useReadyNotificationRouting } from './notify-response';
