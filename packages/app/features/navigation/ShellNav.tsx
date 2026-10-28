'use client';
// The app's navigation shell, drawn by both the `(tabs)` group
// (apps/mobile/components/AppTabBar.tsx) and the `(home)` group
// (features/companion/HomeLayout.tsx), so the two read as one app:
// the canon's five primary tabs, a menu button, and a drawer for the rest.
// SOT: ./shell-destinations.ts · packages/ui/adaptive-navigation.ts (placement policy)
// SOT-KEYWORDS: shell rail drawer bottom bar menu physical right rtl tablet foldable
import { useEffect, type ReactNode } from 'react';
import { BackHandler, I18nManager } from 'react-native';
import { create } from 'zustand';
import { Pressable, Text, View } from '@acme/ui/tw';
import { Bell, Calendar, Compass, Home, Layers, Menu, Navigation, Settings, ShieldCheck, Smartphone, User, X } from '@acme/ui/icons';
import { haptics } from '@acme/ui/haptics';
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
function ShellNavItem({ name, label, raised, focused, layout, onPress }: ItemProps) {
  const Icon = ICONS[name];
  const rail = layout !== 'bottom';
  const wide = layout === 'rail-expanded';
  const on = focused || raised;
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
      <View
        style={rail ? { height: raised ? ITEM + 12 : ITEM } : undefined}
        className={`rounded-none border-2 ${
          wide ? 'flex-row items-center justify-start gap-3 px-4' : `items-center justify-center gap-0.5 ${rail ? 'px-1' : 'px-2 py-1.5'}`
        } ${raised && !rail ? '-mt-4 py-3' : ''} ${
          raised
            ? `border-border shadow-card ${focused ? 'bg-primary' : 'bg-accent'}`
            : focused
              ? 'border-border bg-primary shadow-card'
              : 'border-transparent'
        }`}
      >
        <Icon size={raised ? 28 : 24} className={on ? 'text-on-primary' : 'text-text-muted'} />
        <Text numberOfLines={1} className={`text-xs font-semibold md:text-sm ${on ? 'text-on-primary' : 'text-text-muted'}`}>
          {label}
        </Text>
      </View>
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
        className={`items-center justify-center rounded-none border-2 ${open ? 'border-border bg-primary shadow-card' : 'border-border bg-surface-raised'}`}
      >
        {open ? <X size={24} className="text-on-primary" /> : <Menu size={24} className="text-text" />}
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
export function ShellRail({ active, onSelect, expanded = false, insets }: ShellRailProps) {
  const layout = expanded ? 'rail-expanded' : 'rail';
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
  /** `rail`: anchored beside the right rail, 10pt above the menu button. `bar`: above the phone bar. */
  anchor: 'rail' | 'bar';
  railWidth: number;
  insets: { bottom: number; right: number };
  /** Height of the phone bar, for the `bar` anchor. */
  barHeight?: number;
  active: ShellDrawerItemName | null;
  onSelect: (href: string) => void;
  header?: ReactNode;
}

/**
 * The drawer: everything that is not a primary tab. It opens from the
 * physical RIGHT, beside the rail, its bottom edge 10pt above the menu
 * button. A tap outside, Android back, or choosing an item closes it.
 */
export function ShellDrawer({ anchor, railWidth, insets, barHeight = 0, active, onSelect, header }: ShellDrawerProps) {
  const open = useShellDrawer((s) => s.open);
  const setOpen = useShellDrawer((s) => s.setOpen);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [open, setOpen]);

  if (!open) return null;
  // The panel's bottom edge sits 10pt above the menu button's top edge.
  const panelBottom =
    anchor === 'rail'
      ? insets.bottom + SHELL_SPACING.menuFromBottom + MENU + SHELL_SPACING.drawerAboveMenu
      : barHeight + SHELL_SPACING.drawerAboveMenu;
  const side = anchor === 'rail' ? railWidth + insets.right + 8 : insets.right + 8;
  const edge = I18nManager.isRTL && I18nManager.doLeftAndRightSwapInRTL ? { left: side } : { right: side };

  return (
    <View className="absolute inset-0" style={{ zIndex: 50 }}>
      <Pressable aria-label="Close menu" onPress={() => setOpen(false)} className="absolute inset-0 bg-ink-950/50" />
      <View
        role={'menu' as never}
        testID="shell-drawer"
        style={{ position: 'absolute', bottom: panelBottom, width: DRAWER_WIDTH, ...edge }}
        className="gap-1 rounded-none border-2 border-border bg-surface py-2 shadow-card"
      >
        {header}
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
              className={`mx-2 min-h-12 flex-row items-center gap-3 rounded-none border-2 px-3 ${on ? 'border-border bg-primary' : 'border-transparent'}`}
            >
              <Icon size={22} className={on ? 'text-on-primary' : 'text-text-muted'} />
              <Text className={`flex-1 text-base md:text-lg ${on ? 'font-semibold text-on-primary' : 'text-text'}`}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
