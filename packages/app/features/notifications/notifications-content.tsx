'use client';
// Notifications — mirrors the liquid-glass template (unread header + mark-all,
// Today/Earlier groups, icon-well rows, tap to read) with Legend Motion.
import { Section, View, Text as TWText, Pressable } from '@acme/ui/tw';
import { Button, Heading, StatusRow, Text, FadeIn } from '@acme/ui';
import { WELL, INK } from '../home/home.data';
import { useOnboarding } from '../onboarding/onboarding.store';
import { notifyOffStatusItem } from '../onboarding/notify-status';
import { useNotifyActions } from './notify-nav';
import { useNotifications, type Notification } from './notifications.store';

function NotificationRow({ item, index }: { item: Notification; index: number }) {
  const markRead = useNotifications((s) => s.markRead);
  return (
    <FadeIn delay={80 + index * 45}>
      <Pressable
        aria-label={item.title}
        onPress={() => markRead(item.id)}
        className={`flex-row items-start gap-3 px-4 py-3.5 transition-colors duration-fast hover:bg-surface-sunken ${
          item.read ? '' : 'bg-primary/5'
        }`}
      >
        <View className={`h-10 w-10 items-center justify-center rounded-none ${WELL[item.tone]}`}>
          <item.icon size={18} className={INK[item.tone]} />
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <TWText className={`flex-1 text-sm text-text ${item.read ? 'font-medium' : 'font-bold'}`}>
              {item.title}
            </TWText>
            {!item.read ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
          </View>
          <Text variant="caption" tone="muted">{item.body}</Text>
          <Text variant="caption" tone="muted" className="text-[11px]">{item.time}</Text>
        </View>
      </Pressable>
    </FadeIn>
  );
}

/**
 * Border for row `i` of a group. Stacked, every row after the first has a top
 * rule. With `grid`, from md up the rows pair into two columns: the first
 * pair has no top rule and each right-hand row gets a left rule instead.
 */
function rowBorder(i: number, grid: boolean): string {
  if (!grid) return i > 0 ? 'border-t-2 border-border' : '';
  const top = i === 0 ? '' : i === 1 ? 'border-t-2 md:border-t-0' : 'border-t-2';
  const left = i % 2 === 1 ? 'md:border-l-2' : '';
  return `md:w-1/2 border-border ${top} ${left}`;
}

function Group({ label, items, offset, grid }: { label: string; items: Notification[]; offset: number; grid: boolean }) {
  if (!items.length) return null;
  return (
    <Section className="gap-2">
      <Text variant="label" tone="muted">{label}</Text>
      <View
        className={`overflow-hidden rounded-none border-2 border-border bg-surface-raised shadow-card ${
          grid ? 'md:flex-row md:flex-wrap' : ''
        }`}
      >
        {items.map((item, i) => (
          <View key={item.id} className={rowBorder(i, grid)}>
            <NotificationRow item={item} index={offset + i} />
          </View>
        ))}
      </View>
    </Section>
  );
}

/**
 * The summary: title, unread count, Mark all read and the notifications-off
 * status. Rendered as siblings so it drops into any `gap-*` column.
 */
export function NotificationsSummary() {
  const items = useNotifications((s) => s.items);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const notifyOff = useOnboarding((s) => s.notifyOff);
  const { ask, openSettings } = useNotifyActions();
  const unread = items.filter((n) => !n.read).length;

  return (
    <>
      <FadeIn>
        <Section className="flex-row items-end justify-between gap-3">
          <View className="gap-0.5">
            <Heading level={1} size="display-sm">Notifications</Heading>
            {unread > 0 ? <Text variant="caption" tone="muted">{unread} unread</Text> : null}
          </View>
          {unread > 0 ? (
            <Button title="Mark all read" size="sm" className="self-end" aria-label="Mark all notifications read" onPress={markAllRead} />
          ) : null}
        </Section>
      </FadeIn>

      {/* M06 → M11 follow-up: when notifications are off the row says how to
          check on the egg and offers the way back (Turn on / Open Settings). */}
      {notifyOff !== undefined ? (
        <View testID="status-notify-off">
          <StatusRow
            items={[notifyOffStatusItem({ state: notifyOff, onAsk: ask, onOpenSettings: openSettings })]}
          />
        </View>
      ) : null}
    </>
  );
}

/**
 * The Today and Earlier groups. `grid` pairs each group's rows into two
 * columns from md up (the native tablet portrait column); below md, and
 * without it, the rows stack exactly as before.
 */
export function NotificationsList({ grid = false }: { grid?: boolean }) {
  const items = useNotifications((s) => s.items);
  const today = items.slice(0, 3);
  const earlier = items.slice(3);
  return (
    <>
      <Group label="Today" items={today} offset={0} grid={grid} />
      <Group label="Earlier" items={earlier} offset={3} grid={grid} />
    </>
  );
}

export function NotificationsContent() {
  return (
    <View className="gap-6 md:gap-10 lg:gap-12">
      <NotificationsSummary />
      <NotificationsList />
    </View>
  );
}
