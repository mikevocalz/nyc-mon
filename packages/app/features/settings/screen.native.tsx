'use client';
import type { ReactNode } from 'react';
import { ScreenPanes } from '../layout/ScreenPanes';
import { SettingsAccountCards, SettingsDeviceCards, SettingsHeader } from './settings-content';

/*
  One tree (ScreenPanes), switched by class only:

  - Phone: the old column in reading order.
  - Tablet portrait (md+): the same column, top-aligned and widened to 560.
  - Landscape (md+): two even columns of cards. The device settings
    (Preferences, Appearance, Graphics, Game) under the title on the left;
    the account cards (Caller name, Legal & credits, Session) on the right.

  Decision (2026-10-28): two columns, not SplitView Master/Detail. The kit
  SplitView's detail is a routed <Slot />, so a group list here would need a
  route per group, which is new navigation. The glass Settings already has
  Master/Detail (SettingsDetailPane); this is its 2D fallback.

  One tree means the Caller name draft survives a rotation: the earlier two
  mounted arrangements each held their own draft.

  `leading` sits above both panes: the Settings glass's 2D fallback puts its
  Back control there, since the (home) group has no stack header.
*/
export function SettingsScreen({ leading }: { leading?: ReactNode } = {}) {
  return (
    <ScreenPanes
      balance="even"
      leading={leading}
      primary={
        <>
          <SettingsHeader />
          <SettingsDeviceCards />
        </>
      }
      secondary={<SettingsAccountCards />}
    />
  );
}
