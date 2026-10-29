'use client';
// The app's navigation shell, drawn by both the `(tabs)` group
// (apps/mobile/components/AppTabBar.tsx) and the `(home)` group
// (features/companion/HomeLayout.tsx), so the two read as one app:
// the canon's five primary tabs, a menu button, and a drawer for the rest.
// SOT: ./shell-destinations.ts · packages/ui/adaptive-navigation.ts (placement policy)
// SOT-KEYWORDS: shell rail drawer bottom bar menu physical right rtl tablet foldable
import { useEffect } from 'react';
import { BackHandler, I18nManager } from 'react-native';
import { create } from 'zustand';
import { Pressable, Text, View } from '@acme/ui/tw';
import { Bell, Calendar, Compass, Home, Layers, Menu, Navigation, Settings, ShieldCheck, Smartphone, User, X } from '@acme/ui/icons';
import { haptics } from '@acme/ui/haptics';
import { Avatar } from '@acme/ui';
import { useProfile } from '../profile/profile.store';
import { navChrome } from '@acme/theme';
import {
  SHELL_DESTINATIONS,
  SHELL_DRAWER_ITEMS,
  SHELL_SPACING,
  type ShellDestinationName,
  type ShellDrawerItemName,
} from './shell-destinations';

/** Material 3 navigation rail: 80dp wide, 56dp items. */
export const RAIL_WIDTH = 80;
/** Material 3 expanded rail (labels beside icons), from the theme's navChrome token. */
export const RAIL_EXPANDED_WIDTH = Number.parseInt(navChrome.railExpanded, 10);
const ITEM = 56;
const MENU = 56;
const DRAWER_WIDTH = 288;

/** Open/closed state of the shell drawer, shared by every host. */
export const useShellDrawer = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

const ICONS: Record<ShellDestinationName, typeof Home> = {
  home: Home,
  game: Compass,
  hlynk: Smartphone,
  mons: Layers,
  caller: User,
};
const DRAWER_ICONS: Record<ShellDrawerItemName, typeof Home> = {
  alerts: Bell,
  journal: Calendar,
  settings: Settings,
  controls: Navigation,
  legal: ShieldCheck,
};

interface ItemProps {
  name: ShellDestinationName;
  label: string;
  raised: boolean;
  focused: boolean;
  layout: 'bottom' | 'rail' | 'rail-expanded';
  onPress: () => void;
}

/** One primary tab in the app's slab language. H-LYNK is the raised centre action. */
function ShellNavItem({ name, label, raised: raisedTab, focused, layout, onPress }: ItemProps) {
  const Icon = ICONS[name];
  const rail = layout !== 'bottom';
  // The raised centre action belongs to the phone bar; on the rail H-LYNK is a tab like the rest.
  const raised = raisedTab && !rail;
  const wide = layout === 'rail-expanded';
  return (
    <Pressable
      aria-label={label}
      aria-selected={focused}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      className={rail ? 'w-full' : 'flex-1'}
    >
      {/* Blue is the structure, orange the one hot colour: the selected tab
          gets a carolina edge bar and tint; H-LYNK, the raised action, is the
          only orange face. */}
      <View
        style={rail ? { minHeight: ITEM } : undefined}
        className={`relative ${wide ? 'flex-row items-center justify-start gap-3 px-3' : 'items-center justify-center gap-1'} ${rail ? 'py-2' : 'py-1.5'} ${
          focused && !raised ? 'bg-accent/10' : ''
        } ${raised && !rail ? '-mt-5' : ''}`}
      >
        {focused && !raised ? (
          <View aria-hidden className={rail ? 'absolute bottom-2 left-0 top-2 w-1 bg-accent' : 'absolute left-3 right-3 top-0 h-1 bg-accent'} />
        ) : null}
        <View
          className={raised ? `h-12 w-12 items-center justify-center bg-cta shadow-card ${focused ? 'border-2 border-accent' : ''}` : 'items-center justify-center'}
        >
          <Icon size={raised ? 26 : 22} className={raised ? 'text-on-cta' : focused ? 'text-accent' : 'text-text-muted'} />
        </View>
        <Text
          numberOfLines={1}
          className={`text-[10px] tracking-wider md:text-xs ${focused || raised ? 'font-bold text-text' : 'font-semibold text-text-muted'}`}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/** The Caller's avatar, above the menu button; opens CALLER. */
export function ShellAvatar({ onPress }: { onPress: () => void }) {
  const name = useProfile((s) => s.name);
  return (
    <Pressable aria-label={`${name || 'Caller'}, profile`} onPress={onPress} className="self-center">
      {/* Same 56pt box as the menu button under it. */}
      <Avatar name={name} size="rail" />
    </Pressable>
  );
}

/** The menu button: opens the shell drawer. */
export function ShellMenuButton() {
  const open = useShellDrawer((s) => s.open);
  const setOpen = useShellDrawer((s) => s.setOpen);
  return (
    <Pressable
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
      onPress={() => {
        haptics.selection();
        setOpen(!open);
      }}
      className="self-center"
    >
      <View
        style={{ width: MENU, height: MENU }}
        className={`items-center justify-center rounded-none border-2 ${open ? 'border-accent bg-accent/15' : 'border-border bg-surface-raised'}`}
      >
        {open ? <X size={24} className="text-accent" /> : <Menu size={24} className="text-text" />}
      </View>
    </Pressable>
  );
}

export interface ShellRailProps {
  active: ShellDestinationName | null;
  onSelect: (name: ShellDestinationName) => void;
  expanded?: boolean;
  /** Bottom and right safe-area insets. The top is the header's. */
  insets: { bottom: number; right: number };
}

/**
 * The rail on the PHYSICAL right: the five tabs from 20pt below the header,
 * and the menu button 30pt above the bottom edge. Yoga mirrors `row` under
 * RTL, so the row is reversed there to keep the inset spacer physically right.
 */
export function ShellRail({ active, onSelect, insets }: ShellRailProps) {
  // One width in every orientation and window size: the rail never widens.
  const expanded = false;
  const layout = 'rail';
  return (
    <View testID="shell-rail" className={`h-full bg-surface ${I18nManager.isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
      <View
        style={{
          width: expanded ? RAIL_EXPANDED_WIDTH : RAIL_WIDTH,
          paddingTop: SHELL_SPACING.itemsBelowHeader,
          paddingBottom: insets.bottom + SHELL_SPACING.menuFromBottom,
        }}
        className={`h-full gap-2 border-l-2 border-border bg-surface ${expanded ? 'items-stretch px-3' : 'items-center px-1.5'}`}
      >
        {SHELL_DESTINATIONS.map((d) => (
          <ShellNavItem
            key={d.name}
            name={d.name}
            label={d.label}
            raised={d.raised}
            focused={active === d.name}
            layout={layout}
            onPress={() => onSelect(d.name)}
          />
        ))}
        <View className="flex-1" />
        <View style={{ marginBottom: 10 }}>
          <ShellAvatar onPress={() => onSelect('caller')} />
        </View>
        <ShellMenuButton />
      </View>
      <View style={{ width: insets.right }} />
    </View>
  );
}

/** The phone bottom bar: the five tabs with H-LYNK raised, then the menu button. */
export function ShellBottomBar({ active, onSelect, bottomInset }: { active: ShellDestinationName | null; onSelect: (name: ShellDestinationName) => void; bottomInset: number }) {
  return (
    <View style={{ paddingBottom: bottomInset }} className="flex-row items-end gap-1 border-t-2 border-border bg-surface px-2 pt-1">
      {SHELL_DESTINATIONS.map((d) => (
        <ShellNavItem key={d.name} name={d.name} label={d.label} raised={d.raised} focused={active === d.name} layout="bottom" onPress={() => onSelect(d.name)} />
      ))}
      <View className="pb-1 pl-1">
        <ShellMenuButton />
      </View>
    </View>
  );
}

export interface ShellDrawerProps {
  insets: { top: number; bottom: number; left: number };
  active: ShellDrawerItemName | null;
  onSelect: (href: string) => void;
}

/**
 * The drawer: everything that is not a primary tab. It opens from the
 * LEFT edge at full height, with the Caller at its head. A tap outside,
 * Android back, or choosing an item closes it.
 */
export function ShellDrawer({ insets, active, onSelect }: ShellDrawerProps) {
  const open = useShellDrawer((s) => s.open);
  const setOpen = useShellDrawer((s) => s.setOpen);
  const name = useProfile((s) => s.name);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [open, setOpen]);

  if (!open) return null;
  return (
    <View className="absolute inset-0" style={{ zIndex: 50 }}>
      <Pressable aria-label="Close menu" onPress={() => setOpen(false)} className="absolute inset-0 bg-ink-950/60" />
      <View
        role={'menu' as never}
        testID="shell-drawer"
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: DRAWER_WIDTH + insets.left, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingLeft: insets.left }}
        className="gap-1 border-r-2 border-accent bg-surface"
      >
        <View className="mx-3 mb-4 flex-row items-center gap-3 border-b-2 border-border pb-4">
          <Avatar name={name} />
          <Text numberOfLines={1} className="flex-1 text-lg font-bold text-text">{name}</Text>
        </View>
        {SHELL_DRAWER_ITEMS.map((item) => {
          const Icon = DRAWER_ICONS[item.name];
          const on = active === item.name;
          return (
            <Pressable
              key={item.name}
              role={'menuitem' as never}
              aria-label={item.label}
              aria-selected={on}
              onPress={() => {
                haptics.selection();
                setOpen(false);
                onSelect(item.href);
              }}
              className={`relative mx-2 min-h-12 flex-row items-center gap-3 px-4 ${on ? 'bg-accent/10' : ''}`}
            >
              {on ? <View aria-hidden className="absolute bottom-2 left-0 top-2 w-1 bg-accent" /> : null}
              <Icon size={22} className={on ? 'text-accent' : 'text-text-muted'} />
              <Text className={`flex-1 text-base md:text-lg ${on ? 'font-bold text-text' : 'text-text'}`}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
