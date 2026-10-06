'use client';
import type React from 'react';
import { Time } from './primitives';

/**
 * One timestamp everywhere the console prints a date (04-components.md G17):
 * a semantic <time> with an ISO `dateTime`. `relative` reads "2 min ago" with
 * the absolute value in the accessible name; `absolute` and `both` print the
 * formatted value. Intl only — no date library (same rule as the split-view
 * schedule calendar).
 */
export interface TimestampProps {
  at: Date | number;
  format: 'relative' | 'absolute' | 'both';
  /** IANA zone; default the device's. */
  timeZone?: string;
  /** Absolute date style. Default 'medium' date + 'short' time. */
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
  className?: string;
  style?: React.ComponentProps<typeof Time>['style'];
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function relativeText(ms: number): { value: number; unit: Intl.RelativeTimeFormatUnit } {
  const diff = Date.now() - ms;
  const abs = Math.abs(diff);
  const past = diff >= 0 ? -1 : 1; // RelativeTimeFormat: negative = ago
  if (abs < MINUTE) return { value: past * Math.round(abs / 1000), unit: 'second' };
  if (abs < HOUR) return { value: past * Math.round(abs / MINUTE), unit: 'minute' };
  if (abs < DAY) return { value: past * Math.round(abs / HOUR), unit: 'hour' };
  if (abs < 30 * DAY) return { value: past * Math.round(abs / DAY), unit: 'day' };
  if (abs < 365 * DAY) return { value: past * Math.round(abs / (30 * DAY)), unit: 'month' };
  return { value: past * Math.round(abs / (365 * DAY)), unit: 'year' };
}

export function Timestamp({ at, format, timeZone, dateStyle = 'medium', className, style }: TimestampProps) {
  const ms = at instanceof Date ? at.getTime() : at;
  const date = new Date(ms);
  const absolute = new Intl.DateTimeFormat(undefined, { dateStyle, timeStyle: 'short', timeZone }).format(date);
  let text = absolute;
  let label: string | undefined;
  if (format !== 'absolute') {
    const { value, unit } = relativeText(ms);
    const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(value, unit);
    text = format === 'both' ? `${relative} (${absolute})` : relative;
    // The absolute value is in the accessible name of relative output.
    label = `${text}, ${absolute}`;
  }
  return (
    <Time dateTime={date.toISOString()} aria-label={label} className={className} style={style}>
      {text}
    </Time>
  );
}
