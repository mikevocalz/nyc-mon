'use client';

import { View, Text, Pressable } from '@acme/ui/tw';
import { Section } from '@acme/ui/primitives';
import { Avatar, Button, Container, notify, useAppForm, useFormStore } from '@acme/ui';
import { buildDemoDay, DEMO_RESOURCES } from './fixtures.ts';
import { slotsForResource } from './slots.ts';
import { formatTime } from './format.ts';
import { useScheduleStore } from './store.ts';
import { NotesEditor } from './NotesEditor.tsx';
import { pickNoteImage } from './pick-note-image';
import {
  MON_SCHEDULE_EVENT_KINDS,
  defaultScheduleEventTitle,
  isMealKind,
  scheduleKindLabel,
  type ScheduleEvent,
  type ScheduleEventKind,
} from './model.ts';
import { syncEventIntegrations } from './event-integrations';

export interface BookingFormProps {
  onOpenEditorSettings?: () => void;
  onDone: () => void;
}

const SLOT_GROUPS = ['Morning', 'Afternoon', 'Evening'] as const;

function partOfDay(instant: Date, timeZone: string): (typeof SLOT_GROUPS)[number] {
  const hour = Number.parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(
      instant,
    ),
    10,
  );
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

function preferredMinutes(kind: ScheduleEventKind): number {
  switch (kind) {
    case 'breakfast':
      return 8 * 60;
    case 'lunch':
      return 12 * 60 + 30;
    case 'dinner':
      return 18 * 60 + 30;
    case 'play-date':
      return 16 * 60;
    case 'battle':
      return 19 * 60;
    default:
      return 10 * 60;
  }
}

function eventDurationMinutes(kind: ScheduleEventKind): number {
  if (kind === 'play-date' || kind === 'battle') return 60;
  return 30;
}

function reminderLeadMinutes(kind: ScheduleEventKind): number {
  if (kind === 'battle') return 30;
  if (kind === 'play-date') return 15;
  return 0;
}

function idForEvent() {
  return `mon-event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function BookingForm({ onDone, onOpenEditorSettings }: BookingFormProps) {
  const selectedDate = useScheduleStore((state) => state.selectedDate);
  const selectedEventId = useScheduleStore((state) => state.selectedEventId);
  const createdEvents = useScheduleStore((state) => state.createdEvents);
  const deletedEventIds = useScheduleStore((state) => state.deletedEventIds);
  const createEvent = useScheduleStore((state) => state.createEvent);
  const selectEvent = useScheduleStore((state) => state.selectEvent);
  const syncPersonalCalendar = useScheduleStore((state) => state.syncPersonalCalendar);
  const setSyncPersonalCalendar = useScheduleStore((state) => state.setSyncPersonalCalendar);
  const remindersEnabled = useScheduleStore((state) => state.remindersEnabled);
  const setRemindersEnabled = useScheduleStore((state) => state.setRemindersEnabled);
  const setCalendarEventId = useScheduleStore((state) => state.setCalendarEventId);
  const setNotificationId = useScheduleStore((state) => state.setNotificationId);

  const reference = selectedDate ? new Date(selectedDate) : new Date();
  const day = buildDemoDay(reference, Object.values(createdEvents), deletedEventIds);
  const firstMon = DEMO_RESOURCES[0];
  const firstKind: ScheduleEventKind = 'breakfast';
  const selectedSlotTime =
    selectedEventId && !Number.isNaN(Date.parse(selectedEventId))
      ? new Date(selectedEventId)
      : undefined;
  const firstSlot = selectedSlotTime ?? new Date(day.dayStart);
  if (!selectedSlotTime) firstSlot.setHours(8, 0, 0, 0);

  const form = useAppForm({
    defaultValues: {
      title: '',
      resourceId: firstMon?.id ?? '',
      kind: firstKind as ScheduleEventKind,
      slot: firstSlot.toISOString(),
      notes: '',
    },
    onSubmit: async ({ value }) => {
      const mon = DEMO_RESOURCES.find((candidate) => candidate.id === value.resourceId);
      if (!mon || !value.slot) return;

      const kind = value.kind as ScheduleEventKind;
      const start = new Date(value.slot);
      const title = value.title.trim() || defaultScheduleEventTitle(kind, mon.name);
      const event: ScheduleEvent = {
        id: idForEvent(),
        resourceId: mon.id,
        title,
        start,
        end: new Date(start.getTime() + eventDurationMinutes(kind) * 60_000),
        kind,
        recurrence: isMealKind(kind) ? 'daily' : 'none',
        reminderEnabled: remindersEnabled,
        reminderMinutesBefore: reminderLeadMinutes(kind),
        syncToPersonalCalendar: syncPersonalCalendar,
        notes: value.notes,
      };

      createEvent(event);
      selectEvent(event.id);

      const integration = await syncEventIntegrations(event, {
        monName: mon.name,
        timeZone: day.timeZone,
      });

      if (integration.calendarEventId) setCalendarEventId(event.id, integration.calendarEventId);
      if (integration.notificationId) setNotificationId(event.id, integration.notificationId);

      const parts = [`${scheduleKindLabel(kind)} · ${formatTime(start, day.timeZone)}`];
      if (isMealKind(kind)) parts.push('repeats daily');
      if (integration.calendarStatus === 'synced') parts.push('personal calendar synced');
      if (integration.calendarStatus === 'denied') parts.push('calendar permission not granted');
      if (integration.reminderStatus === 'scheduled') parts.push('reminder set');

      notify.success('Mon event scheduled', { description: parts.join(' · ') });
      onDone();
    },
  });

  const resourceId = useFormStore(form.store, (state) => state.values.resourceId);
  const selectedSlot = useFormStore(form.store, (state) => state.values.slot);
  const selectedKind = useFormStore(form.store, (state) => state.values.kind) as ScheduleEventKind;

  const slots = slotsForResource({
    dayStart: day.dayStart,
    startHour: day.startHour,
    endHour: day.endHour,
    events: day.events,
    resourceId,
  });

  const pickKind = (kind: ScheduleEventKind) => {
    form.setFieldValue('kind', kind);
    const minutes = preferredMinutes(kind);
    const next = new Date(day.dayStart);
    next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    form.setFieldValue('slot', next.toISOString());
  };

  return (
    <Container width="detail" className="flex-1 px-6 pb-10 pt-3">
      <View className="gap-7">
        <Section className="gap-1">
          <Text className="font-display text-xl text-text">Add to Mon Calendar</Text>
          <Text className="text-sm text-text-muted">
            Meals can repeat every day. Play dates and battles stay one-time unless you add another.
          </Text>
        </Section>

        <Section className="gap-2">
          <Text className="text-sm font-medium text-text">Mon</Text>
          <View className="flex-row flex-wrap gap-2">
            {DEMO_RESOURCES.map((mon) => {
              const active = mon.id === resourceId;
              return (
                <Pressable
                  key={mon.id}
                  onPress={() => form.setFieldValue('resourceId', mon.id)}
                  accessibilityState={{ selected: active }}
                  className={`flex-row items-center gap-2 border-2 border-border px-3 py-2 ${
                    active ? 'bg-primary' : 'bg-surface'
                  }`}
                >
                  <Avatar size="sm" name={mon.name} imageUri={mon.avatarUrl} />
                  <Text className={`text-sm font-medium ${active ? 'text-on-primary' : 'text-text'}`}>
                    {mon.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section className="gap-2">
          <Text className="text-sm font-medium text-text">What are you scheduling?</Text>
          <View className="flex-row flex-wrap gap-2">
            {MON_SCHEDULE_EVENT_KINDS.filter((kind) => kind !== 'care').map((kind) => {
              const active = kind === selectedKind;
              return (
                <Pressable
                  key={kind}
                  onPress={() => pickKind(kind)}
                  accessibilityState={{ selected: active }}
                  className={`border-2 border-border px-3 py-2.5 ${active ? 'bg-primary' : 'bg-surface'}`}
                >
                  <Text className={`text-sm font-semibold ${active ? 'text-on-primary' : 'text-text'}`}>
                    {scheduleKindLabel(kind)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <form.AppField name="title">
          {(field) => (
            <field.TextField
              label="Name (optional)"
              placeholder={defaultScheduleEventTitle(
                selectedKind,
                DEMO_RESOURCES.find((mon) => mon.id === resourceId)?.name ?? 'Mon',
              )}
            />
          )}
        </form.AppField>

        <Section className="gap-3">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-sm font-medium text-text">Time</Text>
            <Text className="text-xs text-text-muted">
              {eventDurationMinutes(selectedKind)} min
            </Text>
          </View>

          {SLOT_GROUPS.map((group) => {
            const inGroup = slots.filter((slot) => partOfDay(slot.start, day.timeZone) === group);
            if (inGroup.length === 0) return null;
            return (
              <View key={group} className="gap-2">
                <Text className="text-sm font-semibold text-text-muted">{group}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {inGroup.map((slot) => {
                    const iso = slot.start.toISOString();
                    const active = iso === selectedSlot;
                    return (
                      <Pressable
                        key={iso}
                        onPress={() => form.setFieldValue('slot', iso)}
                        accessibilityLabel={formatTime(slot.start, day.timeZone)}
                        accessibilityState={{ selected: active }}
                        className={`w-28 items-center border-2 border-border py-3 ${
                          active ? 'bg-primary' : 'bg-surface'
                        }`}
                      >
                        <Text className={`text-base font-semibold ${active ? 'text-on-primary' : 'text-text'}`}>
                          {formatTime(slot.start, day.timeZone)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </Section>

        <Section className="gap-2">
          <Text className="text-sm font-medium text-text">Reminders & sync</Text>
          <View className="flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => setRemindersEnabled(!remindersEnabled)}
              accessibilityState={{ selected: remindersEnabled }}
              className={`border-2 border-border px-3 py-2.5 ${remindersEnabled ? 'bg-primary' : 'bg-surface'}`}
            >
              <Text className={`text-sm font-semibold ${remindersEnabled ? 'text-on-primary' : 'text-text'}`}>
                Reminders {remindersEnabled ? 'On' : 'Off'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSyncPersonalCalendar(!syncPersonalCalendar)}
              accessibilityState={{ selected: syncPersonalCalendar }}
              className={`border-2 border-border px-3 py-2.5 ${syncPersonalCalendar ? 'bg-primary' : 'bg-surface'}`}
            >
              <Text className={`text-sm font-semibold ${syncPersonalCalendar ? 'text-on-primary' : 'text-text'}`}>
                Personal calendar {syncPersonalCalendar ? 'On' : 'Off'}
              </Text>
            </Pressable>
          </View>
        </Section>

        <form.AppField name="notes">
          {(field) => (
            <NotesEditor
              label="Notes"
              placeholder={selectedKind === 'battle' ? 'Opponent, location, rules…' : 'Anything to remember?'}
              onChangeHtml={field.handleChange}
              onPickImage={pickNoteImage}
              onOpenSettings={onOpenEditorSettings}
            />
          )}
        </form.AppField>

        <View className="flex-row gap-3 border-t-2 border-border/20 pt-5">
          <Button variant="outline" title="Cancel" onPress={onDone} className="flex-1" />
          <form.AppForm>
            <form.SubmitButton title="Add to calendar" className="flex-[2]" />
          </form.AppForm>
        </View>
      </View>
    </Container>
  );
}
