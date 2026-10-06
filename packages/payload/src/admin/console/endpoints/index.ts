import type { Endpoint } from 'payload';
import { exportAuditLog } from './audit.ts';
import { cancelCallerDeletion, scheduleCallerDeletion, signOutCallerEverywhere } from './callers.ts';
import { decideConsent, deleteConsentRecord, resendConsentEmail } from './consents.ts';
import { handleReveal } from './reveal.ts';
import { runIntegrityCheck } from './integrity.ts';
import { createStaff, removeStaff, updateStaff } from './staff.ts';

export const consoleEndpoints: Endpoint[] = [
  { path: '/console/reveal', method: 'post', handler: handleReveal },
  { path: '/console/callers/:id/deletion', method: 'post', handler: scheduleCallerDeletion },
  { path: '/console/callers/:id/deletion', method: 'delete', handler: cancelCallerDeletion },
  { path: '/console/callers/:id/sign-out-everywhere', method: 'post', handler: signOutCallerEverywhere },
  { path: '/console/consents/:id/resend', method: 'post', handler: resendConsentEmail },
  { path: '/console/consents/:id', method: 'delete', handler: deleteConsentRecord },
  { path: '/console/consents/:id/decision', method: 'post', handler: decideConsent },
  { path: '/console/integrity/run', method: 'post', handler: runIntegrityCheck },
  { path: '/console/staff', method: 'post', handler: createStaff },
  { path: '/console/staff/:id', method: 'patch', handler: updateStaff },
  { path: '/console/staff/:id', method: 'delete', handler: removeStaff },
  { path: '/console/audit/export', method: 'get', handler: exportAuditLog },
];
