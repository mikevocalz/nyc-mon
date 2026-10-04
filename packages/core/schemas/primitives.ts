import { z } from 'zod';

/** Opaque identifier. Ids are minted by the server or by a deterministic function in `sim/`. */
export const IdSchema = z.string().min(1).max(128);

/** Milliseconds since the Unix epoch. Every timestamp in core uses this unit. */
export const EpochMsSchema = z.number().int().nonnegative();

/** A care meter or bond value, clamped to the closed unit interval. */
export const UnitIntervalSchema = z.number().min(0).max(1);
