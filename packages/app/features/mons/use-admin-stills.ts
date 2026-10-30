'use client';

import { useEffect } from 'react';
import { useStore } from 'zustand';
import { AUTH_BASE_URL } from '../onboarding/auth';
import { adminStillsStore, loadAdminStills, type AdminStillMap } from './admin-stills';

/**
 * The approved console stills, loading them on first mount (and again after
 * the TTL). Screens that draw a Mon still call this so they redraw when the
 * list lands; until then, and on any failure, the map is empty.
 */
export function useAdminStills(): AdminStillMap {
  useEffect(() => {
    void loadAdminStills(AUTH_BASE_URL);
  }, []);
  return useStore(adminStillsStore, (s) => s.stills);
}
