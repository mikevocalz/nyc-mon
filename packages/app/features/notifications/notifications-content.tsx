'use client';
// Notifications — mirrors the liquid-glass template (unread header + mark-all,
// Today/Earlier groups, icon-well rows, tap to read) with Legend Motion.
import { Section, View, Text as TWText, Pressable } from '@acme/ui/tw';
import { Button, EmptyState, Heading, StatusRow, Text, FadeIn } from '@acme/ui';
import { Bell } from '@acme/ui/icons';
import { WELL, INK } from '../home/home.data';
import { copy } from '../onboarding/copy';
import { useOnboarding } from '../onboarding/onboarding.store';
import { notifyOffStatusItem } from '../onboarding/notify-status';
import { useNotifyActions } from './notify-nav';
import { useNotifications, type Notification } from './notifications.store';

function NotificationRow({ item, index }: { item: Notification; index: number }) {
  const markRead = useNotifications((s) => s.markRead);
  return (
    <FadeIn delay={80 + index * 45}>
      <Pressable
        // The whole row is read out, with its state: the title alone left the
        // body, the time and "unread" (shown only as a dot) unheard.
        aria-label={[item.title, item.body, item.time, item.read ? undefined : copy('inbox.row.unread.a11y')].filter(Boolean).join('. ')}
        accessibilityHint={item.read ? undefined : copy('inbox.row.a11y.hint')}
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
            <TWText className={`flex-1 text-sm text-text md:text-base ${item.read ? 'font-medium' : 'font-bold'}`}>
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

function Group({ label, items, offset }: { label: string; items: Notification[]; offset: number }) {
  if (!items.length) return null;
  return (
    <Section className="gap-2">
      <Text variant="label" tone="muted">{label}</Text>
      <View className="overflow-hidden rounded-none border-2 border-border bg-surface-raised shadow-card">
        {items.map((item, i) => (
          <View key={item.id} className={i > 0 ? 'border-t-2 border-border' : ''}>
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
          <View className="flex-1 gap-0.5">
            <Heading level={1} size="display-sm">{copy('inbox.title')}</Heading>
            {/* Says where the count went after Mark all read, rather than going blank. */}
            {unread > 0 ? (
              <Text variant="caption" tone="muted">{copy('inbox.unread', { count: unread })}</Text>
            ) : items.length > 0 ? (
              <Text variant="caption" tone="muted">{copy('inbox.all_read')}</Text>
            ) : null}
          </View>
          {/* Default size: the sm face is under the 44 pt target. */}
          {unread > 0 ? (
            <Button title={copy('inbox.mark_all_read')} className="self-end" aria-label={copy('inbox.mark_all_read.a11y.label')} onPress={markAllRead} />
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

/** The Today and Earlier groups, or the empty state before the first notification. */
export function NotificationsList() {
  const items = useNotifications((s) => s.items);
  // One notification per egg, so the inbox is honestly empty before the first egg is ready.
  if (!items.length) {
    return <EmptyState icon={<Bell size={28} />} title={copy('inbox.empty.title')} description={copy('inbox.empty.body')} />;
  }
  const today = items.slice(0, 3);
  const earlier = items.slice(3);
  return (
    <>
      <Group label={copy('inbox.today')} items={today} offset={0} />
      <Group label={copy('inbox.earlier')} items={earlier} offset={3} />
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
